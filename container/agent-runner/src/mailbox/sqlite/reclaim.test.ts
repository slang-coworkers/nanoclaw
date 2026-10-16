import { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { resolveMailboxRetentionDays } from '../../db/container-state.js';
import { mailboxReclaimOptions, reclaimFreePages, sqliteSpace, type ReclaimOptions } from './reclaim.js';

// outbound.db free-page reclaim — the runner is that file's only writer, so it
// is the only side that vacuums it (the host never does). Pins: below threshold
// nothing runs; a legacy file gets one bounded full VACUUM that converts it to
// INCREMENTAL with journal_mode still DELETE; later rounds are incremental; the
// live-size cap and the disk check skip instead of vacuuming.

let dir: string;
const PAD = 'x'.repeat(8 * 1024);
const SMALL: ReclaimOptions = {
  minFreeBytes: 256 * 1024,
  minFreeRatio: 0.25,
  maxFullVacuumLiveBytes: 64 * 1024 * 1024,
  incrementalStepPages: 64,
  freeDiskBytes: () => Number.MAX_SAFE_INTEGER,
};

function legacyOutbound(): { db: Database; p: string } {
  const p = path.join(dir, 'outbound.db');
  const db = new Database(p);
  db.exec('PRAGMA journal_mode = DELETE');
  db.exec('CREATE TABLE processing_ack (message_id TEXT PRIMARY KEY, status TEXT, status_changed TEXT, pad TEXT)');
  return { db, p };
}

function fill(db: Database, n: number, from = 0): void {
  const ins = db.prepare("INSERT INTO processing_ack VALUES (?, 'completed', '2026-01-01 00:00:00', ?)");
  db.transaction(() => {
    for (let i = from; i < from + n; i++) ins.run(`m-${i}`, PAD);
  })();
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-reclaim-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('reclaimFreePages (outbound.db)', () => {
  it('does nothing below threshold', () => {
    const { db, p } = legacyOutbound();
    fill(db, 100);
    db.exec("DELETE FROM processing_ack WHERE message_id IN ('m-1','m-2')");
    expect(reclaimFreePages(db, p, SMALL)).toMatchObject({ action: 'none', reason: 'below-threshold' });
    db.close();
  });

  it('VACUUMs a legacy file once (→ INCREMENTAL, journal DELETE), then reclaims incrementally', () => {
    const { db, p } = legacyOutbound();
    fill(db, 400);
    db.exec("DELETE FROM processing_ack WHERE message_id <> 'm-7'");
    const before = fs.statSync(p).size;
    const r = reclaimFreePages(db, p, SMALL);
    expect(r.action).toBe('vacuum');
    expect(fs.statSync(p).size).toBeLessThan(before / 4);
    expect(sqliteSpace(db).autoVacuum).toBe(2);
    expect((db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode).toBe('delete');
    expect(db.prepare('SELECT COUNT(*) AS n FROM processing_ack').get()).toEqual({ n: 1 });

    fill(db, 400, 1000);
    db.exec("DELETE FROM processing_ack WHERE message_id <> 'm-7'");
    const r2 = reclaimFreePages(db, p, SMALL);
    expect(r2.action).toBe('incremental');
    expect(r2.fileBytesAfter).toBeLessThan(r2.fileBytesBefore);
    expect(sqliteSpace(db).freeBytes).toBe(0);
    db.close();
  });

  it('skips the full VACUUM over the live cap, on short/unknown disk, or when disabled', () => {
    const { db, p } = legacyOutbound();
    fill(db, 400);
    db.exec('DELETE FROM processing_ack WHERE rowid <= 200');
    expect(reclaimFreePages(db, p, { ...SMALL, maxFullVacuumLiveBytes: 1024 }).reason).toBe('live-too-large');
    expect(reclaimFreePages(db, p, { ...SMALL, freeDiskBytes: () => 1024 }).reason).toMatch(/^low-disk:/);
    expect(reclaimFreePages(db, p, { ...SMALL, freeDiskBytes: () => null }).reason).toMatch(/^low-disk:/);
    expect(reclaimFreePages(db, p, { ...SMALL, maxFullVacuumLiveBytes: 0 }).reason).toBe('full-vacuum-disabled');
    expect(sqliteSpace(db).autoVacuum).toBe(0);
    db.close();
  });
});

describe('runner retention + reclaim options', () => {
  it('retention defaults to 30 d, honours an override, 0 = off', () => {
    expect(resolveMailboxRetentionDays(undefined)).toBe(30);
    expect(resolveMailboxRetentionDays('')).toBe(30);
    expect(resolveMailboxRetentionDays('x')).toBe(30);
    expect(resolveMailboxRetentionDays('7')).toBe(7);
    expect(resolveMailboxRetentionDays('0')).toBe(0);
  });

  it('full-VACUUM live cap defaults to 256 MB; env overrides; 0 disables', () => {
    expect(mailboxReclaimOptions({}).maxFullVacuumLiveBytes).toBe(256 * 1024 * 1024);
    expect(mailboxReclaimOptions({ NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB: '0' }).maxFullVacuumLiveBytes).toBe(0);
  });

  it('statfs is available in this runtime (else the full VACUUM would always skip)', () => {
    expect(typeof fs.statfsSync).toBe('function');
  });
});
