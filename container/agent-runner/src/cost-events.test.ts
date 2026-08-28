/**
 * #65 durable cost ledger — write path, pricing, and the DUAL-RUN reconciliation
 * premise: the ledger (tokens × RATE_TABLE) must reproduce the live counter
 * (priceUsage / priceCodexEvent) so ledger$ ≈ counter$ during the bake.
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';

import { type CostEvent, createCostEventsTable, priceTokens, recordCostEvent, sumWindow } from './cost-events.js';
import { RATE_TABLE, RATE_VERSION } from './cost-rate-table.js';
import { claudeMessageToEvent, codexCallToEvent } from './cost-events-integration.js';
import { priceUsage } from './pricing.js';
import { priceCodexEvent, codexEventKey, type CodexUsageEvent } from './codex-cost.js';
import type { ProviderEvent } from './providers/types.js';

const NOW = '2026-08-28T12:00:00.000Z';

function ev(over: Partial<CostEvent> = {}): CostEvent {
  return {
    id: 'claude:m1', ts: '2026-08-28T12:00:00.000Z', provider: 'claude', model: 'claude-opus-4-8',
    inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite5mTokens: 0, cacheWrite1hTokens: 0,
    outputTokens: 0, reasoningTokens: 0, ...over,
  };
}
function msgUsage(over: Partial<Extract<ProviderEvent, { type: 'message_usage' }>> = {}): Extract<ProviderEvent, { type: 'message_usage' }> {
  return {
    type: 'message_usage', messageId: 'm1', model: 'claude-opus-4-8', inputTokens: 0, outputTokens: 0,
    cacheCreationInputTokens: 0, cacheReadInputTokens: 0, ephemeral1hInputTokens: 0, ephemeral5mInputTokens: 0,
    isSubagent: false, ...over,
  };
}

let db: Database;
beforeEach(() => { db = new Database(':memory:'); createCostEventsTable(db); });

describe('RATE_TABLE (built from current pricing for clean dual-run reconciliation)', () => {
  it('carries the fleet Claude + codex models', () => {
    expect(RATE_TABLE['claude-opus-4-8']).toBeDefined();
    expect(RATE_TABLE['gpt-5.6-sol']).toBeDefined();
    expect(RATE_VERSION).toBe(1);
  });
});

describe('DUAL-RUN reconciliation premise: ledger $ == counter $', () => {
  it('Claude: priceTokens reproduces priceUsage (flat cache-create)', () => {
    const usage = { input_tokens: 123, output_tokens: 45, cache_read_input_tokens: 6789, cache_creation_input_tokens: 250 };
    const counter = priceUsage('claude-opus-4-8', usage);
    const ledger = priceTokens(ev({ inputTokens: 123, outputTokens: 45, cacheReadTokens: 6789, cacheWriteTokens: 250 }), RATE_TABLE).usd;
    expect(ledger).toBeCloseTo(counter, 10);
  });

  it('Claude: priceTokens reproduces priceUsage with the 1h TTL split (input×2)', () => {
    const usage = { input_tokens: 100, output_tokens: 0, cache_read_input_tokens: 0, cache_creation: { ephemeral_1h_input_tokens: 1000, ephemeral_5m_input_tokens: 500 } };
    const counter = priceUsage('claude-opus-4-8', usage);
    const ledger = priceTokens(ev({ inputTokens: 100, cacheWrite1hTokens: 1000, cacheWrite5mTokens: 500 }), RATE_TABLE).usd;
    expect(ledger).toBeCloseTo(counter, 10);
  });

  it('Codex: priceTokens(codexCallToEvent) reproduces priceCodexEvent', () => {
    const call: CodexUsageEvent = { day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 10_000, cached: 8_000, output: 500 };
    const counter = priceCodexEvent(call);
    const ledger = priceTokens(codexCallToEvent(call, NOW), RATE_TABLE).usd;
    expect(ledger).toBeCloseTo(counter, 10);
  });
});

describe('integration mappers', () => {
  it('claudeMessageToEvent stores the effective model, GEN-SCOPES the id, + skips a null-id message', () => {
    const e = claudeMessageToEvent(msgUsage({ messageId: 'abc', inputTokens: 5, ephemeral1hInputTokens: 9 }), '2026-08-28T00:00:00Z', 'claude-opus-4-8', 0)!;
    expect(e.id).toBe('claude:0:abc'); // finding-2 fix: id carries the generation
    expect(e.cacheWrite1hTokens).toBe(9);
    expect(e.model).toBe('claude-opus-4-8'); // finding 3: the effective model, never ''
    // The SAME wire id in a DIFFERENT generation is a DISTINCT ledger id, so a
    // post-/clear window re-admits it instead of INSERT OR IGNORE-deduping it away.
    const e2 = claudeMessageToEvent(msgUsage({ messageId: 'abc' }), '2026-08-28T00:00:00Z', 'claude-opus-4-8', 1)!;
    expect(e2.id).toBe('claude:1:abc');
    expect(claudeMessageToEvent(msgUsage({ messageId: null }), 'now', 'claude-opus-4-8', 0)).toBeNull();
  });

  it('priceTokens reuses the shipped normalizers + codex default (findings 4/5)', () => {
    // Finding 4: a -vN Claude id keys the same as its bare form (normalizeModel).
    const bare = priceTokens(ev({ inputTokens: 1_000_000, model: 'claude-opus-4-8' }), RATE_TABLE).usd;
    const versioned = priceTokens(ev({ inputTokens: 1_000_000, model: 'aws/anthropic/claude-opus-4-8-v1' }), RATE_TABLE).usd;
    expect(versioned).toBeCloseTo(bare, 12);
    expect(versioned).toBeGreaterThan(0); // not the pre-fix $0/unpriced
    // Finding 5: an unknown codex model prices at DEFAULT_CODEX_RATE (like the
    // counter's priceCodexEvent), flagged unpriced — not a silent $0.
    const unknownCodex = priceTokens(ev({ provider: 'codex', model: 'future-codex', inputTokens: 1_000_000 }), RATE_TABLE);
    expect(unknownCodex.usd).toBeCloseTo(priceCodexEvent({ day: '2026-08-28', rawModel: 'future-codex', input: 1_000_000, cached: 0, output: 0 }), 10);
    expect(unknownCodex.usd).toBeGreaterThan(0);
    expect(unknownCodex.unpriced).toBe(true);
  });

  it('codexCallToEvent keys by the VERIFIED tuple identity and stores NET input', () => {
    const call: CodexUsageEvent = { day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 3_000, cached: 2_000, output: 100 };
    const e = codexCallToEvent(call, NOW);
    expect(e.id).toBe(`codex:${codexEventKey(call)}`); // tuple, not ts
    expect(e.inputTokens).toBe(1_000); // 3000 − 2000 cached
    expect(e.cacheReadTokens).toBe(2_000);
  });
});

describe('write path: dedup + reprice', () => {
  it('INSERT OR IGNORE dedups a re-scanned/replayed call', () => {
    const call: CodexUsageEvent = { day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000, cached: 0, output: 0 };
    expect(recordCostEvent(db, codexCallToEvent(call, NOW), RATE_VERSION, RATE_TABLE, 'now')).toBe(true);
    expect(recordCostEvent(db, codexCallToEvent(call, NOW), RATE_VERSION, RATE_TABLE, 'now')).toBe(false);
    expect((db.prepare('SELECT COUNT(*) c FROM cost_events').get() as { c: number }).c).toBe(1);
  });

  it('sumWindow reprices stored tokens at the CURRENT table (dollars are a view)', () => {
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 }, NOW), RATE_VERSION, RATE_TABLE, 'now');
    const base = sumWindow(db, RATE_TABLE, '2026-08-28', '2026-08-29').usd;
    const bumped = sumWindow(db, { ...RATE_TABLE, 'gpt-5.6-sol': { ...RATE_TABLE['gpt-5.6-sol'], input_cost_per_token: RATE_TABLE['gpt-5.6-sol'].input_cost_per_token * 2 } }, '2026-08-28', '2026-08-29').usd;
    expect(bumped).toBeCloseTo(base * 2, 10);
  });

  it('C9: a dateless codex call buckets to the fold day (matches the counter), not out of every window', () => {
    // Pre-fix the ts was the literal MISSING_DAY_KEY ('unknown-day'), which sorts
    // above every real date and fell out of BOTH the daily and lifetime windows
    // while the live counter charged it to today — a phantom ledger<counter delta
    // the dual-run bake would chase as a pricing bug. Now it carries the fold ts.
    const now = '2026-08-28T09:00:00.000Z';
    const dateless: CodexUsageEvent = { day: 'unknown-day', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 };
    const e = codexCallToEvent(dateless, now);
    expect(e.ts).toBe(now); // bucketed to the fold time, not 'unknown-day'
    recordCostEvent(db, e, RATE_VERSION, RATE_TABLE, now);
    expect(sumWindow(db, RATE_TABLE, '2026-08-28', '2026-08-29').usd).toBeGreaterThan(0); // fold-day daily window
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99').usd).toBeGreaterThan(0); // lifetime window
    expect(sumWindow(db, RATE_TABLE, '2026-08-27', '2026-08-28').usd).toBe(0); // NOT charged to yesterday
  });
});

// The LEDGER_BASELINE_GEN sentinel (poll-loop.ts): pre-existing / baselined rows
// are stamped at -1, a gen the reconcile (which passes the live gen ≥ 0) never
// selects. Kept as a literal here — cost-events.ts does not export it.
const BASELINE_GEN = -1;

describe('#65 dual-run reconciliation — adjustments + window generation (findings 1 & 2)', () => {
  const GEN = 0;

  it('adjustment_usd is summed as a STORED dollar, never repriced (finding 2)', () => {
    // Token fields all 0 → priceTokens returns $0 (a zero-token event legitimately
    // costs $0, NOT unpriced), so the sum is exactly the stored dollar, and the
    // priced_usd cache reflects the adjustment too.
    expect(recordCostEvent(db, ev({ id: 'adj:s:1', adjustmentUsd: 4.2 }), RATE_VERSION, RATE_TABLE, 'now', GEN)).toBe(true);
    const r = sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', GEN);
    expect(r.usd).toBeCloseTo(4.2, 10);
    expect(r.unpricedModels).toEqual([]); // an adjustment row is never flagged unpriced
    const row = db.prepare('SELECT priced_usd, adjustment_usd FROM cost_events WHERE id = ?').get('adj:s:1') as {
      priced_usd: number;
      adjustment_usd: number;
    };
    expect(row.priced_usd).toBeCloseTo(4.2, 10);
    expect(row.adjustment_usd).toBeCloseTo(4.2, 10);
  });

  it('a token row and an adjustment row do not cross-contaminate (each contributes ONE term)', () => {
    // A token row has adjustment 0; an adjustment row has 0 tokens. The sum is the
    // repriced tokens PLUS the stored dollar — exactly what a DEGRADED turn needs.
    const usage = { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 5000, cache_creation_input_tokens: 300 };
    const messageUsd = priceUsage('claude-opus-4-8', usage);
    const residualUsd = 3.5;

    recordCostEvent(db, ev({ id: 'claude:m1', inputTokens: 1000, outputTokens: 200, cacheReadTokens: 5000, cacheWriteTokens: 300 }), RATE_VERSION, RATE_TABLE, 'now', GEN);
    recordCostEvent(db, ev({ id: 'adj:s:1', adjustmentUsd: residualUsd }), RATE_VERSION, RATE_TABLE, 'now', GEN);

    // Counter path: charge messageUsd per-message, then settle residualUsd. The
    // ledger reproduces messageUsd + residualUsd to the cent — reconcile delta ≈ 0.
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', GEN).usd).toBeCloseTo(messageUsd + residualUsd, 10);
  });

  it('reconcile sums only the ACTIVE generation — a /clear rotation starts empty (finding 1)', () => {
    // Gen 0 carries a priced row; a /clear rotates to gen 1. WITHOUT the gen filter
    // the lifetime sum would keep counting gen 0 forever while the counter reset to
    // $0 — the `ledger=$10 counter=$0` defect. With it, gen 1 starts empty.
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 }, NOW), RATE_VERSION, RATE_TABLE, 'now', 0);
    const gen0 = sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 0).usd;
    expect(gen0).toBeGreaterThan(0);
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 1).usd).toBe(0); // post-/clear gen: empty == counter $0

    // A fresh charge in gen 1 reconciles against a counter that only counts it.
    const freshUsd = priceCodexEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 500_000, cached: 0, output: 0 });
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 500_000, cached: 0, output: 0 }, NOW), RATE_VERSION, RATE_TABLE, 'now', 1);
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 1).usd).toBeCloseTo(freshUsd, 10);
  });

  it('a migration baseline seeds the ledger to the persisted counter (finding 1)', () => {
    // Existing session: counter $10, ledger empty. ONE baseline adjustment = $10 at
    // the current gen makes the lifetime reconcile read ledger == counter instead
    // of $0 vs $10 forever. Older-gen rows never leak in.
    recordCostEvent(db, ev({ id: 'adj:s:base:1', adjustmentUsd: 10 }), RATE_VERSION, RATE_TABLE, 'now', GEN);
    recordCostEvent(db, ev({ id: 'old:gen', inputTokens: 999_999, model: 'claude-opus-4-8' }), RATE_VERSION, RATE_TABLE, 'now', BASELINE_GEN);
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', GEN).usd).toBeCloseTo(10, 10);
  });

  it('codex baseline rows sit OUT of the reconciled gen; new charges land IN it (finding 1)', () => {
    // Pre-existing history the counter never charges is stamped at BASELINE_GEN, so
    // the reconcile (current gen 0) reads ledger==counter==$0 DURING the baseline —
    // no phantom ledger>counter. A genuinely-new charged call at gen 0 then reconciles.
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 4_000_000, cached: 0, output: 0 }, NOW), RATE_VERSION, RATE_TABLE, 'now', BASELINE_GEN);
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 0).usd).toBe(0); // during baseline

    const freshUsd = priceCodexEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 });
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 }, NOW), RATE_VERSION, RATE_TABLE, 'now', 0);
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 0).usd).toBeCloseTo(freshUsd, 10); // after baseline
  });

  it('first-write-wins keeps a baselined call OUT of a later real gen (finding 1)', () => {
    // The baseline fold writes a call at BASELINE_GEN; a later fold re-sees the same
    // call and tries to write it at gen 0. INSERT OR IGNORE no-ops on the id, so it
    // stays sentinel'd — a baselined call can never be promoted into a charged gen.
    const call: CodexUsageEvent = { day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 2_000_000, cached: 0, output: 0 };
    expect(recordCostEvent(db, codexCallToEvent(call, NOW), RATE_VERSION, RATE_TABLE, 'now', BASELINE_GEN)).toBe(true);
    expect(recordCostEvent(db, codexCallToEvent(call, NOW), RATE_VERSION, RATE_TABLE, 'now', 0)).toBe(false); // deduped
    expect(sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 0).usd).toBe(0);
  });

  it('the gen-less sumWindow (no gen arg) stays behavior-preserving for existing callers', () => {
    // Existing tests/callers pass no gen. Every historical row is window_gen 0, so
    // the unfiltered sum equals the gen-0 sum — the default is a no-op change.
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 }, NOW), RATE_VERSION, RATE_TABLE, 'now');
    const noGen = sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99').usd;
    const gen0 = sumWindow(db, RATE_TABLE, '0000-00-00', '9999-99-99', 0).usd;
    expect(noGen).toBeCloseTo(gen0, 12);
    expect(noGen).toBeGreaterThan(0);
  });
});

describe('#65 createCostEventsTable — old-schema migration (codex-reproduced HIGH bug)', () => {
  // The prior-commit `cost_events`: no `adjustment_usd` / `window_gen`, ts index only.
  const OLD_SCHEMA = `
    CREATE TABLE cost_events (
      id TEXT PRIMARY KEY, ts TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens INTEGER NOT NULL DEFAULT 0, cache_write_5m_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens INTEGER NOT NULL DEFAULT 0, priced_usd REAL NOT NULL, rate_version INTEGER NOT NULL,
      thread_id TEXT, gh_ref TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX cost_events_ts ON cost_events(ts);`;

  it('brings a pre-columns table forward: adds BOTH columns + the gen index, then inserts/reads work', () => {
    const old = new Database(':memory:');
    old.exec(OLD_SCHEMA);
    // A legacy row that predates the new columns.
    old.prepare(
      `INSERT INTO cost_events (id, ts, provider, model, input_tokens, priced_usd, rate_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run('legacy:1', '2026-08-28T00:00:00.000Z', 'codex', 'gpt-5.6-sol', 1_000_000, 5, 1, '2026-08-28T00:00:00.000Z');

    // PRE-FIX: the gen index was created in the SAME batch as the table, so on this
    // old table it threw `no such column: window_gen`, the caller swallowed it, and
    // NEITHER column was added — every later insert/reconcile silently failed. This
    // must not throw and must complete the migration.
    expect(() => createCostEventsTable(old)).not.toThrow();

    const cols = new Set(
      (old.prepare("PRAGMA table_info('cost_events')").all() as Array<{ name: string }>).map((c) => c.name),
    );
    expect(cols.has('adjustment_usd')).toBe(true);
    expect(cols.has('window_gen')).toBe(true);
    // The gen index now exists (it can only be created once the column is present).
    expect(old.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='cost_events_gen_ts'").get()).toBeDefined();
    // The legacy row got the column defaults (adjustment 0, gen 0).
    const legacy = old.prepare('SELECT adjustment_usd, window_gen FROM cost_events WHERE id = ?').get('legacy:1') as {
      adjustment_usd: number;
      window_gen: number;
    };
    expect(legacy.adjustment_usd).toBe(0);
    expect(legacy.window_gen).toBe(0);

    // The new write path + gen-filtered read now work against the migrated table.
    expect(recordCostEvent(old, ev({ id: 'new:1', provider: 'codex', model: 'gpt-5.6-sol', inputTokens: 1_000_000 }), RATE_VERSION, RATE_TABLE, 'now', 3)).toBe(true);
    expect(sumWindow(old, RATE_TABLE, '0000-00-00', '9999-99-99', 3).usd).toBeGreaterThan(0);
    old.close();
  });

  it('is idempotent on the already-migrated (fresh) schema', () => {
    const fresh = new Database(':memory:');
    createCostEventsTable(fresh);
    expect(() => createCostEventsTable(fresh)).not.toThrow(); // second call: columns present, no duplicate-add
    const cols = new Set(
      (fresh.prepare("PRAGMA table_info('cost_events')").all() as Array<{ name: string }>).map((c) => c.name),
    );
    expect(cols.has('adjustment_usd') && cols.has('window_gen')).toBe(true);
    fresh.close();
  });
});
