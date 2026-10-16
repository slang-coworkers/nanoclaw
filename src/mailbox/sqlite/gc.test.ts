import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureSchema, gcInboundHistory, openInboundDb } from './session-db.js';

// Host-side history GC. Pins the two safety rules: conversation rows (chat/task)
// and unconsumed frames are never touched, and a `delivered` row is removed only
// when its messages_out row is already gone (otherwise it would be redelivered).

let dir: string;
let inboundPath: string;
let outboundPath: string;
const OLD = '2026-08-01T00:00:00.000Z';
const NEW = '2026-09-27T00:00:00.000Z';
const CUTOFF = '2026-09-20T00:00:00.000Z';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-gc-inbound-'));
  inboundPath = path.join(dir, 'inbound.db');
  outboundPath = path.join(dir, 'outbound.db');
  ensureSchema(inboundPath, 'inbound');
  ensureSchema(outboundPath, 'outbound');
  const inb = new Database(inboundPath);
  const ins = inb.prepare(
    "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, ?, ?, ?, '{}')",
  );
  ins.run('sys-old-done', 2, 'system', OLD, 'completed'); // → gone
  ins.run('sys-old-failed', 4, 'system', OLD, 'failed'); // → gone
  ins.run('sys-old-pending', 6, 'system', OLD, 'pending'); // unconsumed → kept
  ins.run('sys-new-done', 8, 'system', NEW, 'completed'); // inside window → kept
  ins.run('chat-old-done', 10, 'chat', OLD, 'completed'); // conversation → kept
  ins.run('task-old-done', 12, 'task', OLD, 'completed'); // conversation → kept
  const del = inb.prepare(
    "INSERT INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, NULL, 'delivered', ?)",
  );
  del.run('out-old-gone', OLD); // messages_out row gone → orphan → removed
  del.run('out-old-present', OLD); // messages_out row still there → kept (else redelivery)
  del.run('out-new-gone', NEW); // inside window → kept
  inb.close();
  const outb = new Database(outboundPath);
  outb
    .prepare("INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, 1, 'chat', ?, '{}')")
    .run('out-old-present', OLD);
  outb.close();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('gcInboundHistory', () => {
  it('drops only consumed system frames and orphan delivered rows older than the cutoff', () => {
    const db = openInboundDb(inboundPath);
    const result = gcInboundHistory(db, { cutoffIso: CUTOFF, outboundPath });
    expect(result).toEqual({ systemRows: 2, deliveredRows: 1, more: false });
    const left = (db.prepare('SELECT id FROM messages_in ORDER BY seq').all() as Array<{ id: string }>).map(
      (r) => r.id,
    );
    expect(left).toEqual(['sys-old-pending', 'sys-new-done', 'chat-old-done', 'task-old-done']);
    const delivered = (
      db.prepare('SELECT message_out_id FROM delivered ORDER BY message_out_id').all() as Array<{
        message_out_id: string;
      }>
    ).map((r) => r.message_out_id);
    expect(delivered).toEqual(['out-new-gone', 'out-old-present']);
    // Idempotent.
    expect(gcInboundHistory(db, { cutoffIso: CUTOFF, outboundPath })).toEqual({
      systemRows: 0,
      deliveredRows: 0,
      more: false,
    });
    db.close();
  });

  it('never touches delivered rows when the outbound side cannot be consulted', () => {
    const db = openInboundDb(inboundPath);
    const result = gcInboundHistory(db, { cutoffIso: CUTOFF, outboundPath: path.join(dir, 'missing.db') });
    expect(result).toEqual({ systemRows: 2, deliveredRows: 0, more: false });
    expect(db.prepare('SELECT COUNT(*) AS n FROM delivered').get()).toEqual({ n: 3 });
    expect(fs.existsSync(path.join(dir, 'missing.db'))).toBe(false);
    db.close();
  });

  it('never touches pending/processing/paused rows, task rows (incl. recurring), or the newest row', () => {
    const db = openInboundDb(inboundPath);
    db.exec('DELETE FROM messages_in');
    const ins = db.prepare(
      'INSERT INTO messages_in (id, seq, kind, timestamp, status, recurrence, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    ins.run('sys-processing', 2, 'system', OLD, 'processing', null, '{}');
    ins.run('sys-paused', 4, 'system', OLD, 'paused', null, '{}');
    ins.run('task-recurring-done', 6, 'task', OLD, 'completed', '0 9 * * *', '{}');
    ins.run('task-recurring-pending', 8, 'task', OLD, 'pending', '0 9 * * *', '{}');
    ins.run('chat-failed', 10, 'chat', OLD, 'failed', null, '{}');
    ins.run('sys-old-done', 12, 'system', OLD, 'completed', null, '{}'); // → gone
    ins.run('sys-newest-old-done', 14, 'system', OLD, 'completed', null, '{}'); // MAX(seq) → kept
    expect(gcInboundHistory(db, { cutoffIso: CUTOFF }).systemRows).toBe(1);
    const left = (db.prepare('SELECT id FROM messages_in ORDER BY seq').all() as Array<{ id: string }>).map(
      (r) => r.id,
    );
    expect(left).toEqual([
      'sys-processing',
      'sys-paused',
      'task-recurring-done',
      'task-recurring-pending',
      'chat-failed',
      'sys-newest-old-done',
    ]);
    db.close();
  });

  it('deletes in bounded chunks: progress on every call, `more` until the backlog is gone', () => {
    const db = openInboundDb(inboundPath);
    const ins = db.prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, 'system', ?, 'completed', '{}')",
    );
    db.transaction(() => {
      for (let i = 0; i < 1050; i++) ins.run(`bulk-${i}`, 1000 + i * 2, OLD);
    })();
    db.prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES ('top', 99999, 'chat', ?, 'completed', '{}')",
    ).run(NEW);
    const counts: number[] = [];
    let r;
    do {
      r = gcInboundHistory(db, { cutoffIso: CUTOFF, chunkRows: 100, maxChunks: 2 });
      counts.push(r.systemRows);
    } while (r.more && counts.length < 20);
    // 1050 bulk + 2 old system rows from the fixture = 1052, 200 per call.
    expect(counts).toEqual([200, 200, 200, 200, 200, 52]);
    expect(r.more).toBe(false);
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages_in WHERE id LIKE 'bulk-%'").get()).toEqual({ n: 0 });
    db.close();
  });
});
