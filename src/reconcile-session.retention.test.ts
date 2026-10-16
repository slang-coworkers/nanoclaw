import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapSqliteInbound } from './mailbox/sqlite/index.js';
import { ensureSchema, openInboundDb } from './mailbox/sqlite/session-db.js';
import type { MailboxReclaimResult } from './mailbox/types.js';
import {
  DEFAULT_MAILBOX_RETENTION_DAYS,
  _resetMailboxGcForTesting,
  gcMailboxHistory,
  reclaimMailboxSpace,
  resolveMailboxRetentionDays,
} from './reconcile-session.js';

// Mailbox retention is ON by default (30 d) since 2026-10-16; the env var is an
// override where 0 = off. Pins the default, the override, that the GC only
// reaches consumed system frames, and that the inbound reclaim (VACUUM) runs
// only when the host is the file's sole live user: no container, no session
// claim, nothing due.

const NOW = Date.parse('2026-10-16T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

let dir: string;
let inboundPath: string;

beforeEach(() => {
  _resetMailboxGcForTesting();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-retention-'));
  inboundPath = path.join(dir, 'inbound.db');
  ensureSchema(inboundPath, 'inbound');
  const db = new Database(inboundPath);
  const ins = db.prepare(
    'INSERT INTO messages_in (id, seq, kind, timestamp, status, recurrence, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  ins.run('sys-45d-done', 2, 'system', daysAgo(45), 'completed', null, '{}'); // past default window → gone
  ins.run('sys-31d-failed', 4, 'system', daysAgo(31), 'failed', null, '{}'); // → gone
  ins.run('sys-20d-done', 6, 'system', daysAgo(20), 'completed', null, '{}'); // inside 30 d → kept
  ins.run('sys-45d-pending', 8, 'system', daysAgo(45), 'pending', null, '{}'); // unconsumed → kept
  ins.run('sys-45d-processing', 10, 'system', daysAgo(45), 'processing', null, '{}'); // in flight → kept
  ins.run('task-45d-recurring', 12, 'task', daysAgo(45), 'completed', '0 9 * * *', '{}'); // task → kept
  ins.run('task-45d-pending', 14, 'task', daysAgo(45), 'pending', null, '{}'); // task → kept
  ins.run('chat-45d-done', 16, 'chat', daysAgo(45), 'completed', null, '{}'); // conversation → kept
  ins.run('chat-now', 18, 'chat', daysAgo(0), 'pending', null, '{}');
  db.close();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function ids(): string[] {
  const db = new Database(inboundPath, { readonly: true });
  try {
    return (db.prepare('SELECT id FROM messages_in ORDER BY seq').all() as Array<{ id: string }>).map((r) => r.id);
  } finally {
    db.close();
  }
}

describe('resolveMailboxRetentionDays', () => {
  it('defaults to 30 days when unset, blank or invalid; honours an explicit value; 0 = off', () => {
    expect(DEFAULT_MAILBOX_RETENTION_DAYS).toBe(30);
    expect(resolveMailboxRetentionDays(undefined)).toBe(30);
    expect(resolveMailboxRetentionDays('')).toBe(30);
    expect(resolveMailboxRetentionDays('nope')).toBe(30);
    expect(resolveMailboxRetentionDays('-3')).toBe(30);
    expect(resolveMailboxRetentionDays('90')).toBe(90);
    expect(resolveMailboxRetentionDays('0')).toBe(0);
  });
});

describe('gcMailboxHistory (default retention)', () => {
  it('applies the 30-day default: only consumed system frames past the window go', () => {
    const db = openInboundDb(inboundPath);
    const result = gcMailboxHistory(wrapSqliteInbound(db), { id: 's1' }, resolveMailboxRetentionDays(undefined), NOW);
    db.close();
    expect(result).toEqual({ systemRows: 2, deliveredRows: 0 });
    expect(ids()).toEqual([
      'sys-20d-done',
      'sys-45d-pending',
      'sys-45d-processing',
      'task-45d-recurring',
      'task-45d-pending',
      'chat-45d-done',
      'chat-now',
    ]);
  });

  it('override 0 disables GC entirely', () => {
    const db = openInboundDb(inboundPath);
    const result = gcMailboxHistory(wrapSqliteInbound(db), { id: 's1' }, resolveMailboxRetentionDays('0'), NOW);
    db.close();
    expect(result).toBeNull();
    expect(ids()).toHaveLength(9);
  });

  it('runs at most once a day per session', () => {
    const gcHistory = vi.fn(() => ({ systemRows: 0, deliveredRows: 0 }));
    expect(gcMailboxHistory({ gcHistory }, { id: 's1' }, 30, NOW)).not.toBeNull();
    expect(gcMailboxHistory({ gcHistory }, { id: 's1' }, 30, NOW + 60_000)).toBeNull();
    expect(gcMailboxHistory({ gcHistory }, { id: 's1' }, 30, NOW + 25 * 3_600_000)).not.toBeNull();
    expect(gcHistory).toHaveBeenCalledTimes(2);
  });
});

describe('reclaimMailboxSpace (inbound.db, host = sole writer)', () => {
  const result: MailboxReclaimResult = {
    action: 'vacuum',
    fileBytesBefore: 100,
    fileBytesAfter: 10,
    freeBytesBefore: 90,
    liveBytes: 10,
    durationMs: 1,
  };
  const quiet = {
    retentionDays: 30,
    now: NOW,
    containerRunning: () => false,
    sessionClaimed: async () => false,
  };

  it('reclaims when the session is quiet', async () => {
    const reclaimSpace = vi.fn(() => result);
    const r = await reclaimMailboxSpace({ reclaimSpace, countDueMessages: () => 0 }, { id: 's1' }, quiet);
    expect(r).toEqual(result);
    expect(reclaimSpace).toHaveBeenCalledTimes(1);
  });

  it('never vacuums while a container runs, a claim is held, or work is due', async () => {
    const reclaimSpace = vi.fn(() => result);
    const mb = { reclaimSpace, countDueMessages: () => 0 };
    expect(await reclaimMailboxSpace(mb, { id: 'a' }, { ...quiet, containerRunning: () => true })).toBeNull();
    expect(await reclaimMailboxSpace(mb, { id: 'b' }, { ...quiet, sessionClaimed: async () => true })).toBeNull();
    expect(await reclaimMailboxSpace({ reclaimSpace, countDueMessages: () => 1 }, { id: 'c' }, quiet)).toBeNull();
    // Container registered while the claim lookup was in flight.
    let calls = 0;
    expect(await reclaimMailboxSpace(mb, { id: 'd' }, { ...quiet, containerRunning: () => calls++ > 0 })).toBeNull();
    expect(reclaimSpace).not.toHaveBeenCalled();
  });

  it('is off when retention is 0', async () => {
    const reclaimSpace = vi.fn(() => result);
    expect(
      await reclaimMailboxSpace(
        { reclaimSpace, countDueMessages: () => 0 },
        { id: 's1' },
        { ...quiet, retentionDays: 0 },
      ),
    ).toBeNull();
    expect(reclaimSpace).not.toHaveBeenCalled();
  });

  it('end to end on a real legacy file: GC then VACUUM shrinks the file and converts it to INCREMENTAL', async () => {
    const legacy = path.join(dir, 'legacy-inbound.db');
    ensureSchema(legacy, 'inbound');
    // ensureSchema on a fresh file makes it INCREMENTAL; rebuild it as a
    // pre-2026-10-16 (auto_vacuum = NONE) file like every prod session DB.
    const conv = new Database(legacy);
    conv.pragma('auto_vacuum = NONE');
    conv.exec('VACUUM');
    expect(conv.pragma('auto_vacuum', { simple: true })).toBe(0);
    const pad = 'x'.repeat(16 * 1024);
    const ins = conv.prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, 'system', ?, 'completed', ?)",
    );
    conv.transaction(() => {
      for (let i = 0; i < 6000; i++) ins.run(`cli-${i}`, i * 2 + 2, daysAgo(60), pad);
    })();
    conv
      .prepare(
        "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES ('chat', 20000, 'chat', ?, 'completed', '{}')",
      )
      .run(daysAgo(0));
    conv.close();
    const sizeBefore = fs.statSync(legacy).size;
    expect(sizeBefore).toBeGreaterThan(90 * 1024 * 1024);

    const db = openInboundDb(legacy);
    const mailbox = wrapSqliteInbound(db);
    expect(gcMailboxHistory(mailbox, { id: 'e2e' }, 30, NOW)).toEqual({ systemRows: 6000, deliveredRows: 0 });
    const r = await reclaimMailboxSpace(mailbox, { id: 'e2e' }, { ...quiet, now: NOW });
    expect(r?.action).toBe('vacuum');
    expect(db.pragma('auto_vacuum', { simple: true })).toBe(2);
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
    db.close();
    expect(fs.statSync(legacy).size).toBeLessThan(sizeBefore / 20);
  });

  it('the host reclaims inbound.db only — outbound.db (container-owned) is never vacuumed by the host', () => {
    const inP = path.join(dir, 'in2.db');
    const outP = path.join(dir, 'out2.db');
    const pad = 'y'.repeat(16 * 1024);
    for (const [p, schema, table] of [
      [inP, 'inbound', 'messages_in'],
      [outP, 'outbound', 'messages_out'],
    ] as const) {
      ensureSchema(p, schema);
      const db = new Database(p);
      db.pragma('auto_vacuum = NONE');
      db.exec('VACUUM');
      const ins = db.prepare(
        `INSERT INTO ${table} (id, seq, kind, timestamp, content) VALUES (?, ?, 'system', '2026-01-01T00:00:00.000Z', ?)`,
      );
      db.transaction(() => {
        for (let i = 0; i < 6000; i++) ins.run(`r-${i}`, i + 1, pad);
      })();
      db.exec(`DELETE FROM ${table} WHERE seq < 6000`);
      db.close();
    }
    const outBefore = fs.statSync(outP);
    const db = openInboundDb(inP);
    const r = wrapSqliteInbound(db, undefined, { outboundPath: outP }).reclaimSpace!();
    db.close();
    expect(r.action).toBe('vacuum');
    expect(fs.statSync(inP).size).toBeLessThan(outBefore.size / 20);
    const outAfter = fs.statSync(outP);
    expect(outAfter.size).toBe(outBefore.size);
    expect(outAfter.mtimeMs).toBe(outBefore.mtimeMs);
    const o = new Database(outP, { readonly: true });
    expect(o.pragma('auto_vacuum', { simple: true })).toBe(0);
    o.close();
  });
});
