/**
 * getPendingTriggerRows decides which pending trigger rows the host may retire
 * as stuck. "Passed over" is read from the mailbox alone: a row is listed only
 * when the runner consumed an ordinary trigger row written at least
 * `passedOverMs` after the row fell due. These pin that a session which
 * consumed nothing newer (a paused group, a cost stop, a host outage) never has
 * its held rows listed, however old they are.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureSchema, getPendingTriggerRows } from './session-db.js';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-09-30T05:10:06.000Z');
const at = (days: number) => new Date(T0 + days * DAY).toISOString();

let dir: string;
let db: Database.Database;
let seq = 0;

function row(
  id: string,
  opts: {
    kind?: string;
    status?: string;
    trigger?: 0 | 1;
    timestamp: string;
    processAfter?: string | null;
  },
): void {
  seq += 2;
  db.prepare(
    `INSERT INTO messages_in (id, seq, kind, timestamp, status, process_after, trigger, content)
     VALUES (?, ?, ?, ?, ?, ?, ?, '{}')`,
  ).run(
    id,
    seq,
    opts.kind ?? 'chat',
    opts.timestamp,
    opts.status ?? 'pending',
    opts.processAfter ?? null,
    opts.trigger ?? 1,
  );
}

const ids = (opts?: { passedOverMs?: number; dueForMs?: number }) => getPendingTriggerRows(db, opts).map((r) => r.id);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-pending-trigger-'));
  const file = path.join(dir, 'inbound.db');
  ensureSchema(file, 'inbound');
  db = new Database(file);
  seq = 0;
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('getPendingTriggerRows', () => {
  it('without passedOverMs lists every pending trigger row, scheduled or due, oldest first', () => {
    row('due-chat', { timestamp: at(0) });
    row('future-task', { kind: 'task', timestamp: at(0), processAfter: at(35) });
    row('context', { timestamp: at(0), trigger: 0 });
    row('done', { timestamp: at(0), status: 'completed' });
    row('failed', { timestamp: at(0), status: 'failed' });

    expect(getPendingTriggerRows(db)).toEqual([
      { id: 'due-chat', kind: 'chat', dueAt: '2026-09-30 05:10:06' },
      { id: 'future-task', kind: 'task', dueAt: '2026-11-04 05:10:06' },
    ]);
  });

  it('lists a row the runner passed over for the window while consuming newer work (prod: qr-msg, 47 days)', () => {
    row('qr-late-answer', { kind: 'system', timestamp: at(0) }); // a legacy system trigger
    row('newer-chat', { timestamp: at(47), status: 'completed' });

    expect(ids({ passedOverMs: 7 * DAY })).toEqual(['qr-late-answer']);
    expect(ids({ passedOverMs: 48 * DAY })).toEqual([]);
  });

  it('measures from process_after when the row was scheduled or backed off', () => {
    // Written long ago but re-armed to fire at day 40: due for 7 days by day 47.
    row('rearmed', { timestamp: at(0), processAfter: at(40) });
    row('newer-chat', { timestamp: at(46), status: 'completed' });
    expect(ids({ passedOverMs: 7 * DAY })).toEqual([]);

    row('newest-chat', { timestamp: at(47), status: 'completed' });
    expect(ids({ passedOverMs: 7 * DAY })).toEqual(['rearmed']);
  });

  it('never lists held rows: nothing newer was consumed (paused group, cost stop, host down)', () => {
    row('older-done', { timestamp: at(-3), status: 'completed' });
    row('held-webhook', { kind: 'webhook', timestamp: at(0) });
    row('held-chat', { timestamp: at(1) });

    expect(ids({ passedOverMs: 7 * DAY })).toEqual([]);
    expect(ids({ passedOverMs: 0 })).toEqual([]);
  });

  it('does not count control rows a cost-stopped runner still consumes, nor system replies, as consumption', () => {
    row('held-webhook', { kind: 'webhook', timestamp: at(0) });
    row('cost-continue', { kind: 'cost_override', timestamp: at(30), status: 'completed' });
    row('cli-reply', { kind: 'system', timestamp: at(30), status: 'completed', trigger: 0 });
    row('legacy-qr-consumed', { kind: 'system', timestamp: at(30), status: 'completed' });

    expect(ids({ passedOverMs: 7 * DAY })).toEqual([]);
  });

  it('counts a gated task run as consumption: the runner polled and claimed it', () => {
    row('stuck-ping', { kind: 'system', timestamp: at(0) });
    row('gated-task', { kind: 'task', timestamp: at(20), processAfter: at(20), status: 'completed' });

    expect(ids({ passedOverMs: 7 * DAY })).toEqual(['stuck-ping']);
  });

  it('counts a row as due from its write when its process_after is earlier', () => {
    // A row cannot be passed over before it exists.
    row('written-late', { timestamp: at(5), processAfter: at(0) });
    row('newer-chat', { timestamp: at(10), status: 'completed' });

    expect(getPendingTriggerRows(db)[0]).toMatchObject({ id: 'written-late', dueAt: '2026-10-05 05:10:06' });
    expect(ids({ passedOverMs: 7 * DAY })).toEqual([]);
  });

  it('with dueForMs lists only rows due for that long now (the closed-session floor)', () => {
    const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
    row('old', { timestamp: ago(8 * DAY) });
    row('just-landed', { timestamp: ago(0), processAfter: new Date(Date.now() + 5000).toISOString() });
    row('six-days', { timestamp: ago(6 * DAY) });
    row('old-but-due-tomorrow', { kind: 'task', timestamp: ago(30 * DAY), processAfter: ago(-DAY) });

    expect(ids({ dueForMs: 7 * DAY })).toEqual(['old']);
    expect(ids({ dueForMs: 0 })).toEqual(['old', 'six-days']);
  });

  it('compares SQLite-style and ISO timestamps alike', () => {
    row('sqlite-ts', { timestamp: at(0).replace('T', ' ').slice(0, 19) });
    row('newer-chat', { timestamp: at(10), status: 'completed' });

    expect(ids({ passedOverMs: 7 * DAY })).toEqual(['sqlite-ts']);
  });
});
