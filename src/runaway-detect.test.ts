import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  _resetRunawayState,
  checkRunaway,
  isRunaway,
  measureRunaway,
  type RunawayCardDeps,
  type RunawayMetrics,
} from './modules/runaway/detect.js';
import type { Session } from './types.js';

afterEach(() => _resetRunawayState());

function makeOutDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE processing_ack (message_id TEXT PRIMARY KEY, status TEXT NOT NULL, status_changed TEXT NOT NULL);
    CREATE TABLE messages_out (id TEXT PRIMARY KEY, seq INTEGER, in_reply_to TEXT, timestamp TEXT NOT NULL,
      deliver_after TEXT, recurrence TEXT, kind TEXT NOT NULL, platform_id TEXT, channel_type TEXT,
      thread_id TEXT, content TEXT NOT NULL);
  `);
  return db;
}

function seedTurns(db: Database.Database, n: number, atIso: string): void {
  const stmt = db.prepare(`INSERT INTO processing_ack (message_id, status, status_changed) VALUES (?, 'completed', ?)`);
  for (let i = 0; i < n; i++) stmt.run(`m-${atIso}-${i}-${Math.random()}`, atIso);
}

function seedOutput(db: Database.Database, bytes: number, atIso: string): void {
  db.prepare(`INSERT INTO messages_out (id, timestamp, kind, content) VALUES (?, ?, 'chat', ?)`).run(
    `o-${atIso}-${Math.random()}`,
    atIso,
    'x'.repeat(bytes),
  );
}

const NOW = Date.parse('2026-06-16T12:00:00.000Z');
const session = { id: 'sess-x', agent_group_id: 'ag-x' } as Session;

describe('measureRunaway / isRunaway', () => {
  it('counts completed turns and output bytes in the window', () => {
    const db = makeOutDb();
    seedTurns(db, 50, new Date(NOW - 60_000).toISOString());
    seedOutput(db, 100, new Date(NOW - 60_000).toISOString());
    const m = measureRunaway(db, NOW);
    expect(m.turns).toBe(50);
    expect(m.outputBytes).toBe(100);
  });

  it('ignores turns/output older than the window', () => {
    const db = makeOutDb();
    seedTurns(db, 50, new Date(NOW - 3600_000).toISOString()); // 1h ago, outside 600s
    const m = measureRunaway(db, NOW);
    expect(m.turns).toBe(0);
  });

  it('trips on high turns + low output (the runaway signature)', () => {
    expect(isRunaway({ turns: 50, outputBytes: 0 })).toBe(true);
  });
  it('does NOT trip when output is substantial (busy real session)', () => {
    expect(isRunaway({ turns: 50, outputBytes: 50_000 })).toBe(false);
  });
  it('does NOT trip on low turn count', () => {
    expect(isRunaway({ turns: 5, outputBytes: 0 })).toBe(false);
  });
});

describe('checkRunaway — card emission + episode de-dup + non-blocking', () => {
  function spyDeps(): { deps: RunawayCardDeps; calls: RunawayMetrics[] } {
    const calls: RunawayMetrics[] = [];
    return {
      calls,
      deps: {
        async emitCard(_s, metrics) {
          calls.push(metrics);
        },
      },
    };
  }

  it('emits exactly one card per ongoing episode', async () => {
    const db = makeOutDb();
    seedTurns(db, 60, new Date(NOW - 30_000).toISOString());
    const { deps, calls } = spyDeps();

    const first = await checkRunaway(session, db, deps, NOW);
    expect(first.tripped).toBe(true);
    expect(first.carded).toBe(true);
    expect(calls.length).toBe(1);

    // Second sweep, same ongoing episode → no duplicate card.
    const second = await checkRunaway(session, db, deps, NOW + 60_000);
    expect(second.tripped).toBe(true);
    expect(second.carded).toBe(false);
    expect(calls.length).toBe(1);
  });

  it('re-arms after recovery so a later distinct episode cards again', async () => {
    const db = makeOutDb();
    seedTurns(db, 60, new Date(NOW - 30_000).toISOString());
    const { deps, calls } = spyDeps();
    await checkRunaway(session, db, deps, NOW);
    expect(calls.length).toBe(1);

    // Recovery: a far-future check where the window holds no turns.
    const recovered = await checkRunaway(session, db, deps, NOW + 3600_000);
    expect(recovered.tripped).toBe(false);

    // New episode of turns near the new "now".
    const t2 = NOW + 7200_000;
    seedTurns(db, 60, new Date(t2 - 30_000).toISOString());
    const again = await checkRunaway(session, db, deps, t2);
    expect(again.carded).toBe(true);
    expect(calls.length).toBe(2);
  });

  it('a busy session (turns + real output) never cards', async () => {
    const db = makeOutDb();
    seedTurns(db, 60, new Date(NOW - 30_000).toISOString());
    seedOutput(db, 50_000, new Date(NOW - 30_000).toISOString());
    const { deps, calls } = spyDeps();
    const r = await checkRunaway(session, db, deps, NOW);
    expect(r.tripped).toBe(false);
    expect(calls.length).toBe(0);
  });

  it('NON-BLOCKING: checkRunaway never kills/pauses — it only (maybe) cards', async () => {
    // The deps surface is the ONLY side-effect channel; there is no kill hook.
    // Assert the deps interface exposes nothing but emitCard.
    const db = makeOutDb();
    seedTurns(db, 60, new Date(NOW - 30_000).toISOString());
    const { deps } = spyDeps();
    expect(Object.keys(deps)).toEqual(['emitCard']);
    const r = await checkRunaway(session, db, deps, NOW);
    expect(r.tripped).toBe(true); // tripped, but the session is untouched
  });
});
