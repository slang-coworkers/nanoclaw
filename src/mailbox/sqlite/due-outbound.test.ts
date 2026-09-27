import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureSchema, getDueOutboundMessages, markDelivered, openOutboundDb } from './session-db.js';

// getDueOutboundMessages used to read every outbound row on every poll and let
// the caller drop the delivered ones in JS. On prod (2026-09-27) that was 193k
// rows + a 193k-entry Set per second for one session. These pin the SQL-side
// filter and the one rule that keeps it safe: a LIMIT is only ever applied
// together with the delivered filter.

let dir: string;
let inboundPath: string;
let outboundPath: string;

function seedOutbound(rows: Array<{ id: string; ts: string; deliverAfter?: string }>) {
  const db = new Database(outboundPath);
  for (const [i, r] of rows.entries()) {
    db.prepare(
      'INSERT INTO messages_out (id, seq, kind, timestamp, deliver_after, content) VALUES (?, ?, \'chat\', ?, ?, \'{"text":"x"}\')',
    ).run(r.id, 2 * i + 1, r.ts, r.deliverAfter ?? null);
  }
  db.close();
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-due-outbound-'));
  inboundPath = path.join(dir, 'inbound.db');
  outboundPath = path.join(dir, 'outbound.db');
  ensureSchema(inboundPath, 'inbound');
  ensureSchema(outboundPath, 'outbound');
  seedOutbound([
    { id: 'out-1', ts: '2026-09-27 10:00:00' },
    { id: 'out-2', ts: '2026-09-27 10:00:01' },
    { id: 'out-3', ts: '2026-09-27 10:00:02' },
    { id: 'out-later', ts: '2026-09-27 10:00:03', deliverAfter: '2999-01-01 00:00:00' },
  ]);
  const inbound = new Database(inboundPath);
  markDelivered(inbound, 'out-1', null);
  inbound.close();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('getDueOutboundMessages', () => {
  it('excludes delivered rows in SQL and honours the cap, oldest first', () => {
    const db = openOutboundDb(outboundPath);
    const onFallback = vi.fn();
    expect(getDueOutboundMessages(db, { inboundPath, onFallback }).map((r) => r.id)).toEqual(['out-2', 'out-3']);
    expect(getDueOutboundMessages(db, { inboundPath, limit: 1, onFallback }).map((r) => r.id)).toEqual(['out-2']);
    expect(onFallback).not.toHaveBeenCalled();
    // The read-only connection is left usable (ATTACH/DETACH balanced).
    expect(db.prepare('SELECT COUNT(*) AS n FROM messages_out').get()).toEqual({ n: 4 });
    db.close();
  });

  it('never applies a LIMIT on the unfiltered fallback (it would starve undelivered rows)', () => {
    const db = openOutboundDb(outboundPath);
    const onFallback = vi.fn();
    const rows = getDueOutboundMessages(db, { inboundPath: path.join(dir, 'does-not-exist.db'), limit: 1, onFallback });
    expect(rows.map((r) => r.id)).toEqual(['out-1', 'out-2', 'out-3']);
    expect(onFallback).toHaveBeenCalledTimes(1);
    // …and it must not have created the missing file as a side effect of ATTACH.
    expect(fs.existsSync(path.join(dir, 'does-not-exist.db'))).toBe(false);
    db.close();
  });

  it('keeps the pre-existing behaviour when no inbound path is given', () => {
    const db = openOutboundDb(outboundPath);
    expect(getDueOutboundMessages(db).map((r) => r.id)).toEqual(['out-1', 'out-2', 'out-3']);
    expect(getDueOutboundMessages(db, { limit: 1 }).map((r) => r.id)).toEqual(['out-1', 'out-2', 'out-3']);
    db.close();
  });
});
