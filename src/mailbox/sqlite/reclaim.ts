/**
 * Free-page reclaim for a session mailbox file, run ONLY by that file's single
 * writer (the host for inbound.db; the agent-runner mirrors this for its own
 * outbound.db in container/agent-runner/src/mailbox/sqlite/reclaim.ts — no
 * shared modules across the runtime split).
 *
 * Deleting rows never shrinks a SQLite file: freed pages go on the freelist.
 * Two ways to give them back:
 *
 *   - `auto_vacuum = INCREMENTAL` file → `PRAGMA incremental_vacuum(N)` in
 *     bounded steps. Cheap: moves pages from the end of the file into free
 *     slots and truncates; no temp copy. New session files are created in this
 *     mode (ensureSchema), so this is the steady state.
 *   - any other file (every pre-existing session DB — SQLite's default is
 *     auto_vacuum = NONE, and the mode can only be switched by a full VACUUM)
 *     → ONE full `VACUUM` that also switches the file to INCREMENTAL. VACUUM
 *     rebuilds the file from its LIVE pages: a temp copy (~live bytes, in the
 *     temp dir) plus a rollback journal (up to ~live bytes, next to the file),
 *     and it holds an exclusive lock for its whole duration. It is therefore
 *     bounded: only when enough is free to be worth it, only when the live
 *     content is under `maxFullVacuumLiveBytes`, and only when both filesystems
 *     have room for ~2× live. The caller additionally runs it only while the
 *     session's container is down, so no reader is locked out.
 *
 * journal_mode is untouched (DELETE stays DELETE — load-bearing for
 * cross-mount visibility; see agent-runner mailbox/sqlite/connection.ts).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import type Database from 'better-sqlite3';

export interface ReclaimOptions {
  /** Skip unless at least this many bytes are on the freelist. */
  minFreeBytes: number;
  /** …and at least this fraction of the file is free. */
  minFreeRatio: number;
  /** Full VACUUM only when live content is at most this large; 0 = never run a full VACUUM. */
  maxFullVacuumLiveBytes: number;
  /** Pages per incremental_vacuum step (each step is its own short transaction). */
  incrementalStepPages?: number;
  /** Free bytes on the filesystem holding `dir`; null when unknown (→ no full VACUUM). Injectable for tests. */
  freeDiskBytes?: (dir: string) => number | null;
}

export type ReclaimAction = 'none' | 'incremental' | 'vacuum' | 'skipped';

export interface ReclaimResult {
  action: ReclaimAction;
  /** Why nothing ran (action 'none' / 'skipped'). */
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
};

/**
 * Defaults with the operator override applied: NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB
 * caps the live size a one-time full VACUUM may rebuild (0 = never run a full
 * VACUUM; incremental reclaim on already-converted files still runs).
 */
export function mailboxReclaimOptions(env: NodeJS.ProcessEnv = process.env): ReclaimOptions {
  const raw = env.NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB;
  const mb = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  return {
    ...DEFAULT_RECLAIM_OPTIONS,
    ...(Number.isFinite(mb) && mb >= 0 ? { maxFullVacuumLiveBytes: mb * 1024 * 1024 } : {}),
  };
}

export const SQLITE_AUTO_VACUUM_INCREMENTAL = 2;
/** Headroom on top of the 2× live estimate for a full VACUUM. */
const VACUUM_DISK_MARGIN_BYTES = 64 * 1024 * 1024;

export function statfsFreeBytes(dir: string): number | null {
  try {
    const s = fs.statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

function pragmaNumber(db: Database.Database, name: string): number {
  return Number(db.pragma(name, { simple: true }));
}

/** File size per SQLite (page_count × page_size) and freelist bytes. */
export function sqliteSpace(db: Database.Database): {
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
 * Reclaim free pages of `db` (a connection the caller owns as the file's single
 * writer). Never throws for "not worth it"; throws only on SQLite errors (e.g.
 * SQLITE_BUSY from an external reader), which the caller logs and retries later.
 */
export function reclaimFreePages(db: Database.Database, opts: ReclaimOptions = DEFAULT_RECLAIM_OPTIONS): ReclaimResult {
  const started = Date.now();
  const before = sqliteSpace(db);
  const liveBytes = before.fileBytes - before.freeBytes;
  const base = {
    fileBytesBefore: before.fileBytes,
    freeBytesBefore: before.freeBytes,
    liveBytes,
  };
  const done = (action: ReclaimAction, reason?: string): ReclaimResult => ({
    action,
    ...(reason ? { reason } : {}),
    ...base,
    fileBytesAfter: sqliteSpace(db).fileBytes,
    durationMs: Date.now() - started,
  });

  if (before.freeBytes < opts.minFreeBytes || before.freeBytes < opts.minFreeRatio * before.fileBytes) {
    return done('none', 'below-threshold');
  }

  if (before.autoVacuum === SQLITE_AUTO_VACUUM_INCREMENTAL) {
    const step = Math.max(1, opts.incrementalStepPages ?? 4096);
    // Each PRAGMA is its own autocommit transaction: the lock is released
    // between steps. Bounded by the freelist size it started with.
    let guard = Math.ceil(before.freeBytes / before.pageSize / step) + 1;
    while (pragmaNumber(db, 'freelist_count') > 0 && guard-- > 0) {
      db.exec(`PRAGMA incremental_vacuum(${step})`);
    }
    return done('incremental');
  }

  if (opts.maxFullVacuumLiveBytes <= 0) return done('skipped', 'full-vacuum-disabled');
  if (liveBytes > opts.maxFullVacuumLiveBytes) return done('skipped', 'live-too-large');
  const need = 2 * liveBytes + VACUUM_DISK_MARGIN_BYTES;
  const freeDisk = opts.freeDiskBytes ?? statfsFreeBytes;
  const dbDir = path.dirname(db.name);
  for (const dir of new Set([dbDir, os.tmpdir()])) {
    const free = freeDisk(dir);
    if (free === null || free < need) return done('skipped', `low-disk:${dir}`);
  }
  // auto_vacuum must be set BEFORE the VACUUM that rebuilds the file for the
  // mode change to take; afterwards every reclaim is incremental.
  db.exec('PRAGMA auto_vacuum = INCREMENTAL');
  db.exec('VACUUM');
  return done('vacuum');
}
