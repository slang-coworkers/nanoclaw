/**
 * The token math behind exact Claude accounting (claude-usage.ts): merging a
 * snapshot with its final usage, credit consumption, and the `modelUsage`
 * backstop's baseline rules. Every rule that decides "charge or not" has a case
 * here; the end-to-end replay of real SDK captures lives in
 * providers/claude.final-usage.replay.test.ts.
 */
import { describe, it, expect } from 'bun:test';

import {
  consumeCredit,
  cumFromModelUsage,
  mergeUsage,
  modelState,
  newBackstopState,
  priceVec,
  pricingKey,
  settleResult,
  subVec,
  vecFromUsage,
  zeroVec,
  type TokenVec,
} from './claude-usage.js';
import { MODEL_PRICING } from './pricing.js';

const OPUS = 'claude-opus-5-5';
const R = MODEL_PRICING[OPUS];

function vec(p: Partial<TokenVec>): TokenVec {
  return { ...zeroVec(), ...p };
}

describe('mergeUsage — snapshot → final', () => {
  it('takes the final output while keeping input/cache (the prod shape: 8 → 8,178)', () => {
    const snap = vec({ input: 78, output: 8, cacheRead: 419_091, cw5: 683 });
    const fin = vec({ input: 78, output: 8_178, cacheRead: 419_091, cw5: 683 });
    expect(subVec(mergeUsage(snap, fin), snap)).toEqual(vec({ output: 8_170 }));
  });

  it('never goes down: an older report after the final changes nothing', () => {
    const fin = vec({ input: 2, output: 283, cw1h: 18_197, cacheRead: 11_672 });
    const snap = vec({ input: 2, output: 7, cw1h: 18_197, cacheRead: 11_672 });
    expect(mergeUsage(fin, snap)).toEqual(fin);
  });

  it('does not double a cache write reported once split and once unsplit', () => {
    const split = vec({ cw1h: 1_000 });
    const flat = vec({ cwFlat: 1_000 });
    const merged = mergeUsage(split, flat);
    expect(merged.cw1h + merged.cw5 + merged.cwFlat).toBe(1_000);
    expect(mergeUsage(flat, split).cw1h + mergeUsage(flat, split).cwFlat).toBe(1_000);
  });

  it('a zero-output call merges to itself', () => {
    const v = vec({ input: 5, cacheRead: 100 });
    expect(subVec(mergeUsage(v, v), v)).toEqual(zeroVec());
  });
});

describe('priceVec / pricingKey', () => {
  it('prices like priceUsage: 1h write = 2x input, 5m and unsplit = cacheCreate', () => {
    const v = vec({ input: 1, output: 1, cacheRead: 1, cw5: 1, cw1h: 1, cwFlat: 1 });
    expect(priceVec(OPUS, v)).toBeCloseTo(R.input + R.output + R.cacheRead + 2 * R.cacheCreate + 2 * R.input, 15);
  });

  it('keys wire variants together and unpriced models apart', () => {
    expect(pricingKey('aws/anthropic/bedrock-claude-opus-5-5')).toBe(OPUS);
    expect(pricingKey('claude-sonnet-5-5[1m]')).toBe('claude-sonnet-5-5');
    expect(pricingKey('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
    expect(pricingKey('claude-future-9')).toBe('raw:claude-future-9');
    expect(priceVec('claude-future-9', vec({ input: 1_000 }))).toBe(0);
  });

  it('vecFromUsage keeps the TTL split, or the flat figure when there is none', () => {
    const base = { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3 };
    expect(
      vecFromUsage({ ...base, cacheCreationInputTokens: 10, ephemeral1hInputTokens: 10, ephemeral5mInputTokens: 0 }),
    ).toEqual(vec({ input: 1, output: 2, cacheRead: 3, cw1h: 10 }));
    expect(
      vecFromUsage({ ...base, cacheCreationInputTokens: 10, ephemeral1hInputTokens: 0, ephemeral5mInputTokens: 0 }),
    ).toEqual(vec({ input: 1, output: 2, cacheRead: 3, cwFlat: 10 }));
  });
});

describe('consumeCredit — a late final is not paid twice', () => {
  it('consumes credit field by field and charges only the rest', () => {
    const st = newBackstopState(1, 's', false);
    const m = modelState(st, OPUS);
    m.credit = vec({ output: 100, cw1h: 50 });
    const { charge, consumed } = consumeCredit(m, vec({ output: 150, cw1h: 10 }));
    expect(consumed).toEqual(vec({ output: 100, cw1h: 10 }));
    expect(charge).toEqual(vec({ output: 50 }));
    expect(m.credit).toEqual(vec({ cw1h: 40 }));
  });

  it('cache writes are one pool: a never-streamed call claims a residual written at the other TTL', () => {
    const st = newBackstopState(1, 's', false);
    const m = modelState(st, OPUS);
    m.credit = vec({ cw1h: 15_691 }); // residual guessed 1h
    const { charge, consumed } = consumeCredit(m, vec({ cw5: 15_691 })); // the call was 5m
    expect(consumed.cw1h).toBe(15_691);
    expect(charge.cw5 + charge.cw1h + charge.cwFlat).toBe(0); // nothing more in tokens
    expect(m.credit.cw1h).toBe(0);
  });

  it('a pure shape change (unsplit → split, same total) consumes nothing', () => {
    const st = newBackstopState(1, 's', false);
    const m = modelState(st, OPUS);
    m.credit = vec({ cw5: 100 });
    const { consumed } = consumeCredit(m, vec({ cw5: 100, cwFlat: -100 }));
    expect(consumed).toEqual(zeroVec());
    expect(m.credit.cw5).toBe(100);
  });
});

describe('settleResult — the modelUsage backstop', () => {
  const cum = (input: number, output: number, cacheRead: number, cacheWrite: number, costUSD = 0) => ({
    [OPUS]: {
      inputTokens: input,
      outputTokens: output,
      cacheReadInputTokens: cacheRead,
      cacheCreationInputTokens: cacheWrite,
      costUSD,
    },
  });

  it('fresh session: charges exactly what the stream did not report (a helper/compaction call)', () => {
    const st = newBackstopState(0, 's', false);
    modelState(st, OPUS).p = vec({ input: 10, output: 500, cacheRead: 1_000, cw1h: 200 });
    const r = settleResult(st, cumFromModelUsage(cum(12, 700, 1_500, 250)), 'T1');
    expect(r).toHaveLength(1);
    expect(r[0].tokens).toEqual(vec({ input: 2, output: 200, cacheRead: 500, cw1h: 50 }));
    expect(r[0].usd).toBeCloseTo(priceVec(OPUS, r[0].tokens), 12);
    expect(st.epoch).toBe(1);
    expect(st.lastResultAt).toBe('T1');
  });

  it('nothing to settle when per-message already covers the totals', () => {
    const st = newBackstopState(0, 's', false);
    modelState(st, OPUS).p = vec({ input: 12, output: 700, cacheRead: 1_500, cw5: 250 });
    expect(settleResult(st, cumFromModelUsage(cum(12, 700, 1_500, 250)), 'T')).toHaveLength(0);
  });

  it('cumulative across turns: the second result only charges its own increase', () => {
    const st = newBackstopState(0, 's', false);
    settleResult(st, cumFromModelUsage(cum(0, 100, 0, 0)), 'T1');
    const r2 = settleResult(st, cumFromModelUsage(cum(0, 130, 0, 0)), 'T2');
    expect(r2[0].tokens.output).toBe(30);
  });

  it('a resumed session we were not tracking ABSORBS its restored history', () => {
    const st = newBackstopState(0, 's', true);
    modelState(st, OPUS).p = vec({ output: 40 });
    expect(settleResult(st, cumFromModelUsage(cum(5_000, 90_000, 1e7, 1e5)), 'T')).toHaveLength(0);
    // From then on, increases are exact.
    const r = settleResult(st, cumFromModelUsage(cum(5_000, 90_100, 1e7, 1e5)), 'T2');
    expect(r[0].tokens.output).toBe(100);
  });

  it('a full restore on resume (cum ≥ last seen) charges only the new turn', () => {
    const st = newBackstopState(0, 's', false);
    settleResult(st, cumFromModelUsage(cum(10, 500, 0, 0)), 'T1'); // charged 500 out as residual
    // New query resumes the same session: the SDK restores 10/500 and adds 0/20.
    const r = settleResult(st, cumFromModelUsage(cum(10, 520, 0, 0)), 'T2');
    expect(r[0].tokens).toEqual(vec({ output: 20 }));
  });

  it('a PARTIAL or absent restore never double-counts (totals went backwards → rebase, no residual)', () => {
    const st = newBackstopState(0, 's', false);
    settleResult(st, cumFromModelUsage(cum(10, 500, 0, 0)), 'T1');
    // Restore lost everything: the new query reports only its own 30.
    expect(settleResult(st, cumFromModelUsage(cum(0, 30, 0, 0)), 'T2')).toHaveLength(0);
    // The next turn in that query is exact again.
    expect(settleResult(st, cumFromModelUsage(cum(0, 45, 0, 0)), 'T3')[0].tokens.output).toBe(15);
  });

  it('a model first seen mid-session has no history: base 0', () => {
    const st = newBackstopState(0, 's', true);
    settleResult(st, cumFromModelUsage(cum(1, 1, 1, 1)), 'T1'); // absorbed
    const r = settleResult(
      st,
      cumFromModelUsage({ ...cum(1, 1, 1, 1), 'claude-haiku-4-5-20251001': { inputTokens: 900, outputTokens: 12 } }),
      'T2',
    );
    expect(r.map((x) => x.key)).toEqual(['claude-haiku-4-5']);
    expect(r[0].tokens).toEqual(vec({ input: 900, output: 12 }));
  });

  it('an unpriced model is charged from the SDK cost figure, cumulatively', () => {
    const st = newBackstopState(0, 's', false);
    const mu = (c: number) => ({ 'claude-future-9': { inputTokens: 100, outputTokens: 10, costUSD: c } });
    const r1 = settleResult(st, cumFromModelUsage(mu(0.5)), 'T1');
    expect(r1[0]).toMatchObject({ key: 'raw:claude-future-9', unpriced: true, usd: 0.5 });
    expect(settleResult(st, cumFromModelUsage(mu(0.75)), 'T2')[0].usd).toBeCloseTo(0.25, 12);
  });

  it('residual cache writes take the session TTL for that model', () => {
    const st = newBackstopState(0, 's', false);
    modelState(st, OPUS).p = vec({ cw5: 10 });
    expect(settleResult(st, cumFromModelUsage(cum(0, 0, 0, 30)), 'T')[0].tokens).toEqual(vec({ cw5: 20 }));
    const st2 = newBackstopState(0, 's', false);
    modelState(st2, OPUS).p = vec({ cw1h: 10 });
    expect(settleResult(st2, cumFromModelUsage(cum(0, 0, 0, 30)), 'T')[0].tokens).toEqual(vec({ cw1h: 20 }));
  });

  it('credit counts as charged: a later settle does not re-charge it', () => {
    const st = newBackstopState(0, 's', false);
    settleResult(st, cumFromModelUsage(cum(0, 100, 0, 0)), 'T1');
    expect(settleResult(st, cumFromModelUsage(cum(0, 100, 0, 0)), 'T2')).toHaveLength(0);
  });
});
