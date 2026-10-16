/**
 * Free-page reclaim for outbound.db, run by its single writer — this runner.
 * Mirrors the host's src/mailbox/sqlite/reclaim.ts (no shared modules across
 * the runtime split); the host never vacuums outbound.db.
 *
 * Deleted rows leave free pages; the file only shrinks on a vacuum:
 *   - `auto_vacuum = INCREMENTAL` file (every session DB created since
 *     2026-10-16) → `PRAGMA incremental_vacuum(N)` in bounded steps, each its
 *     own short transaction.
 *   - legacy file (auto_vacuum = NONE) → ONE full VACUUM that also switches it
 *     to INCREMENTAL. VACUUM rebuilds from the live pages (temp copy ≈ live
 *     bytes + rollback journal ≈ live bytes) under an exclusive lock, during
 *     which the host's read-only polls of this file wait on busy_timeout. So it
 *     is bounded: only when enough is free, only when live content is under
 *     the cap, only with ~2× live free on disk, and only at runner start before
 *     the first turn.
 *
 * journal_mode stays DELETE (see connection.ts header).
 */
import type { Database } from 'bun:sqlite';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ReclaimOptions {
  minFreeBytes: number;
  minFreeRatio: number;
  /** 0 = never run a full VACUUM. */
  maxFullVacuumLiveBytes: number;
  incrementalStepPages?: number;
  /**
   * Cap on pages released per call (the work is synchronous — on the host it
   * blocks the event loop for every session). The rest goes on later passes.
   */
  maxIncrementalPagesPerCall?: number;
  freeDiskBytes?: (dir: string) => number | null;
}

export type ReclaimAction = 'none' | 'incremental' | 'vacuum' | 'skipped';

export interface ReclaimResult {
  action: ReclaimAction;
  reason?: string;
  fileBytesBefore: number;
  fileBytesAfter: number;
  freeBytesBefore: number;
  liveBytes: number;
  durationMs: number;
}

export const DEFAULT_RECLAIM_OPTIONS: ReclaimOptions = {
  minFreeBytes: 64 * 1024 * 1024,
  minFreeRatio: 0.25,
  maxFullVacuumLiveBytes: 256 * 1024 * 1024,
  incrementalStepPages: 4096,
  maxIncrementalPagesPerCall: 16384, // 64 MiB at the default 4 KiB page size
};

/** Same override as the host: NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB (0 = no full VACUUM). */
export function mailboxReclaimOptions(env: Record<string, string | undefined> = process.env): ReclaimOptions {
  const raw = env.NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB;
  const mb = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return {
    ...DEFAULT_RECLAIM_OPTIONS,
    ...(Number.isFinite(mb) && mb >= 0 ? { maxFullVacuumLiveBytes: mb * 1024 * 1024 } : {}),
  };
}

const AUTO_VACUUM_INCREMENTAL = 2;
const VACUUM_DISK_MARGIN_BYTES = 64 * 1024 * 1024;

export function statfsFreeBytes(dir: string): number | null {
  try {
    const s = fs.statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

function pragmaNumber(db: Database, name: string): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | null;
  return row ? Number(Object.values(row)[0]) : 0;
}

export function sqliteSpace(db: Database): {
  pageSize: number;
  fileBytes: number;
  freeBytes: number;
  autoVacuum: number;
} {
  const pageSize = pragmaNumber(db, 'page_size');
  return {
    pageSize,
    fileBytes: pragmaNumber(db, 'page_count') * pageSize,
    freeBytes: pragmaNumber(db, 'freelist_count') * pageSize,
    autoVacuum: pragmaNumber(db, 'auto_vacuum'),
  };
}

/**
 * Reclaim free pages of `db`, which MUST be the runner's own writable
 * outbound.db handle. `dbPath` is used only for the disk-space check.
 */
export function reclaimFreePages(
  db: Database,
  dbPath: string,
  opts: ReclaimOptions = DEFAULT_RECLAIM_OPTIONS,
): ReclaimResult {
  const started = Date.now();
  const before = sqliteSpace(db);
  const liveBytes = before.fileBytes - before.freeBytes;
  const done = (action: ReclaimAction, reason?: string): ReclaimResult => ({
    action,
    ...(reason ? { reason } : {}),
    fileBytesBefore: before.fileBytes,
    fileBytesAfter: sqliteSpace(db).fileBytes,
    freeBytesBefore: before.freeBytes,
    liveBytes,
    durationMs: Date.now() - started,
  });

  if (before.freeBytes < opts.minFreeBytes || before.freeBytes < opts.minFreeRatio * before.fileBytes) {
    return done('none', 'below-threshold');
  }

  if (before.autoVacuum === AUTO_VACUUM_INCREMENTAL) {
    const step = Math.max(1, opts.incrementalStepPages ?? 4096);
    // Each PRAGMA is its own autocommit transaction (lock released between
    // steps), but the calls are synchronous, so the total per call is capped;
    // what is left is reclaimed on the next pass.
    let budget = Math.max(step, opts.maxIncrementalPagesPerCall ?? 16384);
    while (budget > 0 && pragmaNumber(db, 'freelist_count') > 0) {
      const n = Math.min(step, budget);
      db.exec(`PRAGMA incremental_vacuum(${n})`);
      budget -= n;
    }
    return done('incremental');
  }

  if (opts.maxFullVacuumLiveBytes <= 0) return done('skipped', 'full-vacuum-disabled');
  if (liveBytes > opts.maxFullVacuumLiveBytes) return done('skipped', 'live-too-large');
  const need = 2 * liveBytes + VACUUM_DISK_MARGIN_BYTES;
  const freeDisk = opts.freeDiskBytes ?? statfsFreeBytes;
  for (const dir of new Set([path.dirname(dbPath), os.tmpdir()])) {
    const free = freeDisk(dir);
    if (free === null || free < need) return done('skipped', `low-disk:${dir}`);
  }
  db.exec('PRAGMA auto_vacuum = INCREMENTAL');
  db.exec('VACUUM');
  return done('vacuum');
}
