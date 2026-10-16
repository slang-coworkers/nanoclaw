import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './connection.js';
import { _resetOutboundGcCursorForTesting, sqliteGcOutboundHistory } from './operations.js';

// Runner-side history GC. Pins the safety rules: only `kind = 'system'` frames
// are ever pruned (a chat reply is conversation history, kept whatever its age),
// an undelivered row is never dropped (the host has not recorded it in
// `delivered`), rows inside the retention window stay, and an ack is dropped
// only when its inbound row is gone.

const OLD = '2026-08-01 00:00:00';
const NEW = '2026-09-27 00:00:00';
const CUTOFF = '2026-09-20T00:00:00.000Z';

beforeEach(() => {
  _resetOutboundGcCursorForTesting();
  initTestSessionDb();
  const inbound = getInboundDb();
  const outbound = getOutboundDb();
  const out = outbound.prepare(
    "INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, ?, ?, ?, '{}')",
  );
  out.run('sys-old-delivered', 1, 'system', OLD); // system frame, delivered + old → gone
  out.run('chat-old-delivered', 3, 'chat', OLD); // the agent's reply: conversation history → kept forever
  out.run('out-old-undelivered', 5, 'system', OLD); // never delivered → kept
  out.run('out-new-delivered', 7, 'system', NEW); // inside window → kept
  const del = inbound.prepare(
    "INSERT INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, NULL, 'delivered', ?)",
  );
  del.run('sys-old-delivered', OLD);
  del.run('chat-old-delivered', OLD);
  del.run('out-new-delivered', NEW);
  inbound
    .prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES ('in-live', 2, 'chat', ?, 'completed', '{}')",
    )
    .run(OLD);
  const ack = outbound.prepare('INSERT INTO processing_ack (message_id, status, status_changed) VALUES (?, ?, ?)');
  ack.run('in-live', 'completed', OLD); // inbound row exists → kept
  ack.run('in-gone-old', 'completed', OLD); // inbound row gone + old → gone
  ack.run('in-gone-new', 'completed', NEW); // inbound row gone but inside window → kept
});

afterEach(() => {
  closeSessionDb();
});

describe('sqliteGcOutboundHistory', () => {
  it('drops delivered old SYSTEM messages_out rows and orphan old acks — never chat replies', () => {
    expect(sqliteGcOutboundHistory(CUTOFF)).toEqual({ messagesOut: 1, acks: 1, more: false });
    const outIds = (
      getOutboundDb().prepare('SELECT id FROM messages_out ORDER BY seq').all() as Array<{ id: string }>
    ).map((r) => r.id);
    expect(outIds).toEqual(['chat-old-delivered', 'out-old-undelivered', 'out-new-delivered']);
    const ackIds = (
      getOutboundDb().prepare('SELECT message_id FROM processing_ack ORDER BY message_id').all() as Array<{
        message_id: string;
      }>
    ).map((r) => r.message_id);
    expect(ackIds).toEqual(['in-gone-new', 'in-live']);
    expect(sqliteGcOutboundHistory(CUTOFF)).toEqual({ messagesOut: 0, acks: 0, more: false });
  });

  it('never deletes the newest messages_out row (seq allocation reads MAX(seq))', () => {
    const outbound = getOutboundDb();
    outbound.exec("DELETE FROM messages_out WHERE id = 'out-new-delivered'");
    outbound
      .prepare(
        "INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES ('sys-newest', 9, 'system', ?, '{}')",
      )
      .run(OLD);
    getInboundDb()
      .prepare(
        "INSERT INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES ('sys-newest', NULL, 'delivered', ?)",
      )
      .run(OLD);
    expect(sqliteGcOutboundHistory(CUTOFF).messagesOut).toBe(1); // sys-old-delivered only
    const outIds = (outbound.prepare('SELECT id FROM messages_out ORDER BY seq').all() as Array<{ id: string }>).map(
      (r) => r.id,
    );
    expect(outIds).toEqual(['chat-old-delivered', 'out-old-undelivered', 'sys-newest']);
  });

  it('is bounded per call: a large backlog is worked off over several calls and then finishes', () => {
    const inbound = getInboundDb();
    const outbound = getOutboundDb();
    const out = outbound.prepare(
      "INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, ?, 'system', ?, '{}')",
    );
    const del = inbound.prepare(
      "INSERT INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, NULL, 'delivered', ?)",
    );
    const ack = outbound.prepare(
      "INSERT INTO processing_ack (message_id, status, status_changed) VALUES (?, 'completed', ?)",
    );
    for (let i = 0; i < 250; i++) {
      out.run(`bulk-${i}`, 101 + i * 2, OLD);
      del.run(`bulk-${i}`, OLD);
      ack.run(`gone-${i}`, OLD);
    }
    outbound
      .prepare("INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES ('top', 9999, 'chat', ?, '{}')")
      .run(NEW);
    let calls = 0;
    let removed = 0;
    let acks = 0;
    let r;
    do {
      r = sqliteGcOutboundHistory(CUTOFF, 100);
      removed += r.messagesOut;
      acks += r.acks;
      calls++;
      expect(r.messagesOut).toBeLessThanOrEqual(100);
      expect(r.acks).toBeLessThanOrEqual(100);
    } while (r.more && calls < 20);
    expect(r.more).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(removed).toBe(251); // 250 bulk + sys-old-delivered
    expect(acks).toBe(251); // 250 gone-* + in-gone-old
    expect(outbound.prepare("SELECT COUNT(*) AS n FROM messages_out WHERE id LIKE 'bulk-%'").get()).toEqual({ n: 0 });
  });
});
