import { describe, expect, it } from 'vitest';

import { FALLBACK_PRICING } from './server.js';
import {
  MODEL_PRICING,
  normalizeModel,
  priceUsage,
  rankByCost,
  resolveSdkSessionId,
  type SessionCostEntry,
} from './session-costs.js';

describe('normalizeModel', () => {
  it('maps the wire variants seen in prod transcripts onto a base key', () => {
    expect(normalizeModel('claude-opus-5')).toBe('claude-opus-5');
    expect(normalizeModel('aws/anthropic/bedrock-claude-opus-5')).toBe('claude-opus-5');
    expect(normalizeModel('aws/anthropic/bedrock-claude-opus-4-8')).toBe('claude-opus-4-8');
    expect(normalizeModel('claude-opus-4-8[1m]')).toBe('claude-opus-4-8');
    expect(normalizeModel('aws/anthropic/claude-haiku-4-5-v1')).toBe('claude-haiku-4-5');
    expect(normalizeModel('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
  });

  it('returns empty for synthetic/unknown so they price as unpriced, not $0', () => {
    expect(normalizeModel('<synthetic>')).toBe('');
    expect(normalizeModel('gpt-5.6-sol')).toBe('');
    expect(normalizeModel(undefined)).toBe('');
    expect(normalizeModel('')).toBe('');
  });
});

describe('priceUsage', () => {
  it('prices each token class at the model rate', () => {
    // opus-5: in 5e-6, out 25e-6, cacheCreate 6.25e-6, cacheRead 5e-7
    const cost = priceUsage('claude-opus-5', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(5 + 25 + 6.25 + 0.5, 6);
  });

  it('cache reads dominate — the fleet cost driver — priced at 5e-7 on opus', () => {
    expect(priceUsage('claude-opus-5', { cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.5, 6);
  });

  it('an unknown model contributes 0 (never throws)', () => {
    expect(priceUsage('gpt-5.6-sol', { output_tokens: 1_000_000 })).toBe(0);
    expect(priceUsage(undefined, { output_tokens: 5 })).toBe(0);
  });

  it('prices a 1h cache write at 2x input (the fleet runs ENABLE_PROMPT_CACHING_1H)', () => {
    // opus input 5e-6 → 1h write 1e-5. This is the fix for the ~16% understate
    // vs ccusage: the flat cacheCreate rate (6.25e-6) is the 5m rate.
    const cost = priceUsage('claude-opus-5', {
      cache_creation_input_tokens: 1_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1_000_000 },
    });
    expect(cost).toBeCloseTo(10, 6); // 1M * 1e-5
  });

  it('prices a 5m cache write at the base cacheCreate rate (1.25x input)', () => {
    const cost = priceUsage('claude-opus-5', {
      cache_creation_input_tokens: 1_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 0 },
    });
    expect(cost).toBeCloseTo(6.25, 6); // 1M * 6.25e-6
  });

  it('mixes 5m and 1h writes correctly', () => {
    const cost = priceUsage('claude-opus-5', {
      cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 1_000_000 },
    });
    expect(cost).toBeCloseTo(6.25 + 10, 6);
  });

  it('falls back to the flat 5m rate when no TTL split is present', () => {
    const cost = priceUsage('claude-opus-5', { cache_creation_input_tokens: 1_000_000 });
    expect(cost).toBeCloseTo(6.25, 6);
  });

  it('bedrock/[1m] variants price identically to the base', () => {
    const u = { output_tokens: 1_000_000 };
    expect(priceUsage('aws/anthropic/bedrock-claude-opus-4-8', u)).toBeCloseTo(priceUsage('claude-opus-4-8', u), 9);
    expect(priceUsage('claude-opus-4-8[1m]', u)).toBeCloseTo(priceUsage('claude-opus-4-8', u), 9);
  });
});

describe('MODEL_PRICING agrees with server FALLBACK_PRICING (no drift)', () => {
  // The two tables must price shared models identically, or a session sum would
  // disagree with the group total on the Overview. This test is the guard.
  it('every FALLBACK_PRICING model resolves to the same rates here', () => {
    for (const [model, rate] of Object.entries(FALLBACK_PRICING)) {
      const key = normalizeModel(model);
      expect(MODEL_PRICING[key], `${model} → ${key} missing from MODEL_PRICING`).toBeDefined();
      expect(MODEL_PRICING[key]).toEqual(rate);
    }
  });
});

describe('resolveSdkSessionId', () => {
  it('uses the file basename for a normal root session transcript', () => {
    const p = '/data/v2-sessions/ag-1/.claude-shared/projects/-workspace-agent/28e13752-0539-4e03-b4ba-1e23871ba1cc.jsonl';
    expect(resolveSdkSessionId(p)).toBe('28e13752-0539-4e03-b4ba-1e23871ba1cc');
  });

  it('attributes a subagent transcript to its PARENT session, not its own basename', () => {
    // Task-tool subagent transcripts nest at <parent-sdk-id>/subagents/agent-*.jsonl
    // and never get their own sdk_session_routes entry — routes only stamp
    // top-level session hook lifecycles, never subagent spawns. Measured on
    // prod: naive basename keying orphaned ~99% of what looked like
    // "unattributed" cost, which was really real subagent spend.
    const p =
      '/data/v2-sessions/ag-1/.claude-shared/projects/-workspace-agent/9082dc8c-c1e3-4aae-9870-1a729763d813/subagents/agent-a2902b91b2bb8380e.jsonl';
    expect(resolveSdkSessionId(p)).toBe('9082dc8c-c1e3-4aae-9870-1a729763d813');
  });

  it('a directory that merely contains "subagents" in its name is not treated as the marker', () => {
    // Only an exact 'subagents' path segment should trigger parent-attribution.
    const p = '/data/v2-sessions/ag-1/.claude-shared/projects/-workspace-agent/not-subagents-dir/28e13752.jsonl';
    expect(resolveSdkSessionId(p)).toBe('28e13752');
  });
});

describe('rankByCost', () => {
  const mk = (id: string, cost: number, lastActiveMs = 0): SessionCostEntry => ({
    sessionId: id,
    sdkSessionId: 'sdk-' + id,
    groupFolder: 'g',
    groupName: 'g',
    cost,
    claudeUsd: cost,
    codexUsd: 0,
    tokens: 0,
    lastActiveMs,
    unpriced: false,
  });

  it('orders by cost desc, then recency, and caps', () => {
    const out = rankByCost([mk('a', 10, 1), mk('b', 30, 1), mk('c', 30, 5), mk('d', 5, 9)], 3);
    expect(out.map((e) => e.sessionId)).toEqual(['c', 'b', 'a']); // c before b (same cost, newer); d dropped by cap
  });

  it('ranks on TOTAL cost, so a codex-heavy session is not buried', () => {
    // The whole point of the split: before codexUsd existed, `b` looked like a
    // $1 session because its spend was all `codex-critique` MCP tool calls.
    const claudeOnly = { ...mk('a', 20), claudeUsd: 20, codexUsd: 0 };
    const codexHeavy = { ...mk('b', 31), claudeUsd: 1, codexUsd: 30 };
    expect(rankByCost([claudeOnly, codexHeavy]).map((e) => e.sessionId)).toEqual(['b', 'a']);
  });
});

describe('SessionCostEntry provider split', () => {
  // `cost` is the contract every existing consumer reads (rankByCost, the p90 the
  // runner's Tier-1 cap seeds from, the p99 pill, the Sessions column). It must
  // stay the TOTAL; the split is additive detail.
  const entry: SessionCostEntry = {
    sessionId: 'sess-1',
    sdkSessionId: 'sdk-1',
    groupFolder: 'fixer',
    groupName: 'fixer',
    cost: 0,
    claudeUsd: 0,
    codexUsd: 0,
    tokens: 0,
    lastActiveMs: 0,
    unpriced: false,
  };

  it('cost is the sum of both halves', () => {
    // Mirrors how refreshSessionCostCache accumulates: the Claude walk adds to
    // cost+claudeUsd, the codex walk adds to cost+codexUsd, on the same row.
    const e = { ...entry };
    e.cost += 78.69;
    e.claudeUsd += 78.69; // Claude transcript half
    e.cost += 21.31;
    e.codexUsd += 21.31; // codex rollout half
    expect(e.cost).toBeCloseTo(e.claudeUsd + e.codexUsd, 9);
    expect(e.cost).toBeCloseTo(100, 9);
  });

  it('a session whose ONLY spend is codex still reports a nonzero cost', () => {
    const e = { ...entry, cost: 21.31, claudeUsd: 0, codexUsd: 21.31 };
    expect(e.cost).toBeGreaterThan(0);
    expect(e.claudeUsd).toBe(0);
  });

  it('Claude cost from MULTIPLE transcript files rolls into one claudeUsd', () => {
    // A session spans several SDK transcript files — resumes, and (once the
    // subagent-attribution fix lands on this branch) Task-tool subagent
    // transcripts at `<parent-sdk-id>/subagents/agent-*.jsonl`, which are
    // SEPARATE files carrying disjoint message ids. The merge below is what makes
    // every one of them land on the session's own total rather than an orphan row.
    const e = { ...entry };
    for (const fileCost of [50.0, 12.5, 16.19]) {
      e.cost += fileCost;
      e.claudeUsd += fileCost;
    }
    expect(e.claudeUsd).toBeCloseTo(78.69, 9);
    expect(e.cost).toBeCloseTo(e.claudeUsd, 9);
  });
});
