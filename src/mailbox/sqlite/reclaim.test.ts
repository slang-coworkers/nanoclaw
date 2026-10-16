import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { mailboxReclaimOptions, reclaimFreePages, sqliteSpace, type ReclaimOptions } from './reclaim.js';
import { INBOUND_SCHEMA } from './schema.js';
import { ensureSchema, openInboundDb } from './session-db.js';

// inbound.db free-page reclaim (host = the file's single writer). Pins: below
// threshold nothing runs; a legacy (auto_vacuum=NONE) file gets ONE bounded full
// VACUUM that converts it to INCREMENTAL and keeps journal_mode=DELETE; later
// reclaims are incremental; the live-size cap and the disk check skip instead
// of vacuuming; new session files are born INCREMENTAL.

let dir: string;
const PAD = 'x'.repeat(8 * 1024);
const SMALL: ReclaimOptions = {
  minFreeBytes: 256 * 1024,
  minFreeRatio: 0.25,
  maxFullVacuumLiveBytes: 64 * 1024 * 1024,
  incrementalStepPages: 64,
  freeDiskBytes: () => Number.MAX_SAFE_INTEGER,
};

function legacyInbound(name = 'inbound.db'): string {
  // Pre-2026-10-16 file: schema created without auto_vacuum.
  const p = path.join(dir, name);
  const db = new Database(p);
  db.pragma('journal_mode = DELETE');
  db.exec(INBOUND_SCHEMA);
  db.close();
  return p;
}

function fill(db: Database.Database, n: number, from = 0): void {
  const ins = db.prepare(
    "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, 'system', '2026-01-01T00:00:00.000Z', 'completed', ?)",
  );
  db.transaction(() => {
    for (let i = from; i < from + n; i++) ins.run(`m-${i}`, i * 2 + 2, PAD);
  })();
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-reclaim-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('reclaimFreePages', () => {
  it('does nothing below the free-space threshold', () => {
    const db = openInboundDb(legacyInbound());
    fill(db, 100);
    db.exec('DELETE FROM messages_in WHERE seq <= 10');
    const r = reclaimFreePages(db, SMALL);
    expect(r).toMatchObject({ action: 'none', reason: 'below-threshold' });
    expect(db.pragma('auto_vacuum', { simple: true })).toBe(0);
    db.close();
  });

  it('runs one full VACUUM on a legacy file, converts it to INCREMENTAL, keeps journal_mode=DELETE', () => {
    const p = legacyInbound();
    const db = openInboundDb(p);
    fill(db, 400);
    db.exec('DELETE FROM messages_in WHERE seq < 760'); // keep 21 rows
    const sizeBefore = fs.statSync(p).size;
    const r = reclaimFreePages(db, SMALL);
    expect(r.action).toBe('vacuum');
    expect(r.fileBytesAfter).toBeLessThan(r.fileBytesBefore / 4);
    expect(fs.statSync(p).size).toBeLessThan(sizeBefore / 4);
    expect(db.pragma('auto_vacuum', { simple: true })).toBe(2);
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
    expect(db.prepare('SELECT COUNT(*) AS n FROM messages_in').get()).toEqual({ n: 21 });

    // Second round on the converted file is incremental.
    fill(db, 400, 1000);
    db.exec('DELETE FROM messages_in WHERE seq >= 2002 AND seq < 2700');
    const r2 = reclaimFreePages(db, SMALL);
    expect(r2.action).toBe('incremental');
    expect(r2.fileBytesAfter).toBeLessThan(r2.fileBytesBefore);
    expect(sqliteSpace(db).freeBytes).toBe(0);
    db.close();
  });

  it('skips the full VACUUM when the live content is over the cap', () => {
    const db = openInboundDb(legacyInbound());
    fill(db, 400);
    db.exec('DELETE FROM messages_in WHERE seq < 400');
    const r = reclaimFreePages(db, { ...SMALL, maxFullVacuumLiveBytes: 1024 });
    expect(r).toMatchObject({ action: 'skipped', reason: 'live-too-large' });
    expect(r.fileBytesAfter).toBe(r.fileBytesBefore);
    expect(db.pragma('auto_vacuum', { simple: true })).toBe(0);
    db.close();
  });

  it('skips the full VACUUM when free disk is short or unknown, or full VACUUM is disabled', () => {
    const db = openInboundDb(legacyInbound());
    fill(db, 400);
    db.exec('DELETE FROM messages_in WHERE seq < 400');
    expect(reclaimFreePages(db, { ...SMALL, freeDiskBytes: () => 1024 }).reason).toMatch(/^low-disk:/);
    expect(reclaimFreePages(db, { ...SMALL, freeDiskBytes: () => null }).reason).toMatch(/^low-disk:/);
    expect(reclaimFreePages(db, { ...SMALL, maxFullVacuumLiveBytes: 0 }).reason).toBe('full-vacuum-disabled');
    expect(db.pragma('auto_vacuum', { simple: true })).toBe(0);
    db.close();
  });

  it('new session files are created INCREMENTAL (no one-time VACUUM ever needed)', () => {
    for (const side of ['inbound', 'outbound'] as const) {
      const p = path.join(dir, `${side}.db`);
      ensureSchema(p, side);
      const db = new Database(p);
      expect(db.pragma('auto_vacuum', { simple: true })).toBe(2);
      expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
      db.close();
    }
  });

  it('ensureSchema on an existing legacy file leaves its mode alone', () => {
    const p = legacyInbound();
    ensureSchema(p, 'inbound');
    const db = new Database(p);
    expect(db.pragma('auto_vacuum', { simple: true })).toBe(0);
    db.close();
  });
});

describe('mailboxReclaimOptions', () => {
  it('defaults to a 256 MB live cap; NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB overrides; 0 disables full VACUUM', () => {
    expect(mailboxReclaimOptions({}).maxFullVacuumLiveBytes).toBe(256 * 1024 * 1024);
    expect(mailboxReclaimOptions({ NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB: '1024' }).maxFullVacuumLiveBytes).toBe(
      1024 * 1024 * 1024,
    );
    expect(mailboxReclaimOptions({ NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB: '0' }).maxFullVacuumLiveBytes).toBe(0);
    expect(mailboxReclaimOptions({ NANOCLAW_MAILBOX_VACUUM_MAX_LIVE_MB: 'junk' }).maxFullVacuumLiveBytes).toBe(
      256 * 1024 * 1024,
    );
  });
});
