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

const utcDay = (ts: string) => ts.slice(0, 10);

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
    const ledger = priceTokens(codexCallToEvent(call), RATE_TABLE).usd;
    expect(ledger).toBeCloseTo(counter, 10);
  });
});

describe('integration mappers', () => {
  it('claudeMessageToEvent maps + skips a null-id message', () => {
    const e = claudeMessageToEvent(msgUsage({ messageId: 'abc', inputTokens: 5, ephemeral1hInputTokens: 9 }), '2026-08-28T00:00:00Z')!;
    expect(e.id).toBe('claude:abc');
    expect(e.cacheWrite1hTokens).toBe(9);
    expect(claudeMessageToEvent(msgUsage({ messageId: null }), 'now')).toBeNull();
  });

  it('codexCallToEvent keys by the VERIFIED tuple identity and stores NET input', () => {
    const call: CodexUsageEvent = { day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 3_000, cached: 2_000, output: 100 };
    const e = codexCallToEvent(call);
    expect(e.id).toBe(`codex:${codexEventKey(call)}`); // tuple, not ts
    expect(e.inputTokens).toBe(1_000); // 3000 − 2000 cached
    expect(e.cacheReadTokens).toBe(2_000);
  });
});

describe('write path: dedup + reprice', () => {
  it('INSERT OR IGNORE dedups a re-scanned/replayed call', () => {
    const call: CodexUsageEvent = { day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000, cached: 0, output: 0 };
    expect(recordCostEvent(db, codexCallToEvent(call), RATE_VERSION, RATE_TABLE, 'now')).toBe(true);
    expect(recordCostEvent(db, codexCallToEvent(call), RATE_VERSION, RATE_TABLE, 'now')).toBe(false);
    expect((db.prepare('SELECT COUNT(*) c FROM cost_events').get() as { c: number }).c).toBe(1);
  });

  it('sumWindow reprices stored tokens at the CURRENT table (dollars are a view)', () => {
    recordCostEvent(db, codexCallToEvent({ day: '2026-08-28', rawModel: 'gpt-5.6-sol', input: 1_000_000, cached: 0, output: 0 }), RATE_VERSION, RATE_TABLE, 'now');
    const base = sumWindow(db, RATE_TABLE, utcDay, '2026-08-28', '2026-08-29').usd;
    const bumped = sumWindow(db, { ...RATE_TABLE, 'gpt-5.6-sol': { ...RATE_TABLE['gpt-5.6-sol'], input_cost_per_token: RATE_TABLE['gpt-5.6-sol'].input_cost_per_token * 2 } }, utcDay, '2026-08-28', '2026-08-29').usd;
    expect(bumped).toBeCloseTo(base * 2, 10);
  });
});
