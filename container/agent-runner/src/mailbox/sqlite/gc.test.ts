import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './connection.js';
import { sqliteGcOutboundHistory } from './operations.js';

// Runner-side history GC. Pins the safety rules: an undelivered messages_out row
// is never dropped (the host has not recorded it in `delivered`), rows inside
// the retention window stay, and an ack is dropped only when its inbound row is
// gone.

const OLD = '2026-08-01 00:00:00';
const NEW = '2026-09-27 00:00:00';
const CUTOFF = '2026-09-20T00:00:00.000Z';

beforeEach(() => {
  initTestSessionDb();
  const inbound = getInboundDb();
  const outbound = getOutboundDb();
  const out = outbound.prepare(
    "INSERT INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, ?, 'chat', ?, '{}')",
  );
  out.run('out-old-delivered', 1, OLD); // delivered + old → gone
  out.run('out-old-undelivered', 3, OLD); // never delivered → kept
  out.run('out-new-delivered', 5, NEW); // inside window → kept
  const del = inbound.prepare(
    "INSERT INTO delivered (message_out_id, platform_message_id, status, delivered_at) VALUES (?, NULL, 'delivered', ?)",
  );
  del.run('out-old-delivered', OLD);
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
  it('drops delivered old messages_out rows and orphan old acks, nothing else', () => {
    expect(sqliteGcOutboundHistory(CUTOFF)).toEqual({ messagesOut: 1, acks: 1 });
    const outIds = (
      getOutboundDb().prepare('SELECT id FROM messages_out ORDER BY seq').all() as Array<{ id: string }>
    ).map((r) => r.id);
    expect(outIds).toEqual(['out-old-undelivered', 'out-new-delivered']);
    const ackIds = (
      getOutboundDb().prepare('SELECT message_id FROM processing_ack ORDER BY message_id').all() as Array<{
        message_id: string;
      }>
    ).map((r) => r.message_id);
    expect(ackIds).toEqual(['in-gone-new', 'in-live']);
    expect(sqliteGcOutboundHistory(CUTOFF)).toEqual({ messagesOut: 0, acks: 0 });
  });
});
