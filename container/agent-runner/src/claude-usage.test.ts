/**
 * The token math behind exact Claude accounting (claude-usage.ts): merging a
 * snapshot with its final usage, credit consumption, and the per-query segment
 * backstop against the SDK's cumulative `modelUsage`. Every rule that decides
 * "charge or not" has a case here; the transactional poll-loop side lives in
 * poll-loop.final-usage.test.ts and the real-capture replay in
 * providers/claude.final-usage.test.ts.
 */
import { describe, it, expect } from 'bun:test';

import {
  cleanCount,
  consumeCredit,
  cumFromModelUsage,
  decreased,
  mergeUsage,
  newBackstopState,
  priceVec,
  pricingKey,
  saveCheckpoint,
  segmentModel,
  settleClosingSegment,
  settleSegment,
  startSegment,
  subVec,
  vecFromUsage,
  zeroCum,
  zeroVec,
  type TokenVec,
} from './claude-usage.js';
import { MODEL_PRICING } from './pricing.js';

const OPUS = 'claude-opus-5-5';
const R = MODEL_PRICING[OPUS];

function vec(p: Partial<TokenVec>): TokenVec {
  return { ...zeroVec(), ...p };
}

const cum = (input: number, output: number, cacheRead: number, cacheWrite: number, costUSD = 0) => ({
  [OPUS]: {
    inputTokens: input,
    outputTokens: output,
    cacheReadInputTokens: cacheRead,
    cacheCreationInputTokens: cacheWrite,
    costUSD,
  },
});

describe('mergeUsage — snapshot → final', () => {
  it('takes the final output while keeping input/cache (the prod shape: 8 → 8,178)', () => {
    const snap = vec({ input: 78, output: 8, cacheRead: 419_091, cw5: 683 });
    const fin = vec({ input: 78, output: 8_178, cacheRead: 419_091, cw5: 683 });
    expect(subVec(mergeUsage(snap, fin), snap)).toEqual(vec({ output: 8_170 }));
  });

  it('never goes down: an older report after the final changes nothing', () => {
    const fin = vec({ input: 2, output: 283, cw1h: 18_197, cacheRead: 11_672 });
    expect(mergeUsage(fin, vec({ input: 2, output: 7, cw1h: 18_197, cacheRead: 11_672 }))).toEqual(fin);
  });

  it('a cache write reported once unsplit and once split is ONE write — and the split wins on equal totals', () => {
    const flat = vec({ cwFlat: 1_000 });
    const split = vec({ cw1h: 1_000 });
    expect(mergeUsage(flat, split)).toEqual(split); // authoritative TTL replaces the 5m-priced guess
    expect(mergeUsage(split, flat)).toEqual(split);
    expect(priceVec(OPUS, subVec(mergeUsage(flat, split), flat))).toBeCloseTo(
      1_000 * (2 * R.input - R.cacheCreate),
      12,
    );
  });

  it('a zero-output call merges to itself', () => {
    const v = vec({ input: 5, cacheRead: 100 });
    expect(subVec(mergeUsage(v, v), v)).toEqual(zeroVec());
  });
});

describe('priceVec / pricingKey / input hygiene', () => {
  it('prices like priceUsage: 1h write = 2x input, 5m and unsplit = cacheCreate; signed', () => {
    const v = vec({ input: 1, output: 1, cacheRead: 1, cw5: 1, cw1h: 1, cwFlat: 1 });
    expect(priceVec(OPUS, v)).toBeCloseTo(R.input + R.output + R.cacheRead + 2 * R.cacheCreate + 2 * R.input, 15);
    expect(priceVec(OPUS, vec({ output: -10 }))).toBeCloseTo(-10 * R.output, 15);
  });

  it('keys wire variants together and unpriced models apart', () => {
    expect(pricingKey('aws/anthropic/bedrock-claude-opus-5-5')).toBe(OPUS);
    expect(pricingKey('claude-sonnet-5-5[1m]')).toBe('claude-sonnet-5-5');
    expect(pricingKey('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
    expect(pricingKey('claude-future-9')).toBe('raw:claude-future-9');
    expect(priceVec('claude-future-9', vec({ input: 1_000 }))).toBe(0);
  });

  it('drops non-finite, negative and non-numeric counts', () => {
    expect([cleanCount(NaN), cleanCount(-5), cleanCount('7'), cleanCount(Infinity), cleanCount(3.9)]).toEqual([
      0, 0, 0, 0, 3,
    ]);
    expect(cumFromModelUsage({ x: { inputTokens: -1, outputTokens: Number.NaN, costUSD: -2 } })['raw:x']).toEqual(
      zeroCum(),
    );
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

  it('a decrease is per token field; a costUSD revision of a priced model is not one', () => {
    const a = { input: 10, output: 10, cacheRead: 10, cacheWrite: 10, costUsd: 5 };
    expect(decreased({ ...a, costUsd: 4 }, a, true)).toBe(false);
    expect(decreased({ ...a, output: 9 }, a, true)).toBe(true);
    expect(decreased({ ...a, costUsd: 4 }, a, false)).toBe(true);
  });
});

describe('consumeCredit — a late final is not paid twice', () => {
  it('consumes credit field by field and charges only the rest', () => {
    const st = newBackstopState();
    const m = segmentModel(startSegment(st, 's', 'fresh', null), OPUS);
    m.credit = vec({ output: 100, cw1h: 50 });
    const { charge, consumed } = consumeCredit(m, vec({ output: 150, cw1h: 10 }));
    expect(consumed).toEqual(vec({ output: 100, cw1h: 10 }));
    expect(charge).toEqual(vec({ output: 50 }));
    expect(m.credit).toEqual(vec({ cw1h: 40 }));
  });

  it('cache writes are one pool: a call claiming a residual guessed at the other TTL is re-priced, signed', () => {
    const st = newBackstopState();
    const m = segmentModel(startSegment(st, 's', 'fresh', null), OPUS);
    m.credit = vec({ cw1h: 15_691 }); // residual guessed 1h
    const { charge, consumed } = consumeCredit(m, vec({ cw5: 15_691 })); // the call was 5m
    expect(consumed).toEqual(vec({ cw1h: 15_691 }));
    expect(charge).toEqual(vec({ cw5: 15_691, cw1h: -15_691 }));
    expect(priceVec(OPUS, charge)).toBeCloseTo(15_691 * (R.cacheCreate - 2 * R.input), 12); // a refund
  });

  it('the same TTL bucket is consumed first', () => {
    const st = newBackstopState();
    const m = segmentModel(startSegment(st, 's', 'fresh', null), OPUS);
    m.credit = vec({ cw5: 10, cw1h: 10 });
    expect(consumeCredit(m, vec({ cw1h: 10 })).consumed).toEqual(vec({ cw1h: 10 }));
  });

  it('a pure shape change (unsplit → split, same total) consumes nothing', () => {
    const st = newBackstopState();
    const m = segmentModel(startSegment(st, 's', 'fresh', null), OPUS);
    m.credit = vec({ cw5: 100 });
    expect(consumeCredit(m, vec({ cw5: 100, cwFlat: -100 })).consumed).toEqual(zeroVec());
    expect(m.credit.cw5).toBe(100);
  });
});

describe('settleSegment — the modelUsage backstop', () => {
  it('fresh session: charges exactly what the stream did not report (a helper/compaction call)', () => {
    const st = newBackstopState();
    const seg = startSegment(st, 's', 'fresh', null);
    const m = segmentModel(seg, OPUS);
    m.p = vec({ input: 10, output: 500, cacheRead: 1_000, cw1h: 200 });
    m.mainCw1h = 200;
    const out = settleSegment(seg, cumFromModelUsage(cum(12, 700, 1_500, 250)), 'T1');
    expect(out.residuals).toHaveLength(1);
    expect(out.residuals[0].tokens).toEqual(vec({ input: 2, output: 200, cacheRead: 500, cw1h: 50 }));
    expect(seg.epoch).toBe(1);
    expect(seg.lastResultAt).toBe('T1');
  });

  it('nothing to settle when per-message already covers the totals', () => {
    const st = newBackstopState();
    const seg = startSegment(st, 's', 'fresh', null);
    segmentModel(seg, OPUS).p = vec({ input: 12, output: 700, cacheRead: 1_500, cw5: 250 });
    expect(settleSegment(seg, cumFromModelUsage(cum(12, 700, 1_500, 250)), 'T').residuals).toHaveLength(0);
  });

  it('cumulative across turns: the second result only charges its own increase', () => {
    const seg = startSegment(newBackstopState(), 's', 'fresh', null);
    settleSegment(seg, cumFromModelUsage(cum(0, 100, 0, 0)), 'T1');
    expect(settleSegment(seg, cumFromModelUsage(cum(0, 130, 0, 0)), 'T2').residuals[0].tokens.output).toBe(30);
  });

  it('a resumed segment differences against the RESTORED totals: a compaction in its first turn is charged', () => {
    const st = newBackstopState();
    const restored = cumFromModelUsage(cum(6, 589, 50_316, 26_698));
    const seg = startSegment(st, 's', 'transcript', restored);
    // The prod shape of an isolated compaction call: no stream events at all.
    const out = settleSegment(seg, cumFromModelUsage(cum(6 + 245_000, 589 + 6_000, 50_316, 26_698 + 525_000)), 'T');
    expect(out.residuals[0].tokens).toEqual(vec({ input: 245_000, output: 6_000, cw5: 525_000 }));
    expect(out.absorbed).toEqual([]);
  });

  it('an ABSORBING segment (no baseline at all) absorbs only its first result', () => {
    const seg = startSegment(newBackstopState(), 's', 'absorb', null);
    segmentModel(seg, OPUS).p = vec({ output: 40 });
    const out = settleSegment(seg, cumFromModelUsage(cum(5_000, 90_000, 1e7, 1e5)), 'T');
    expect(out.residuals).toHaveLength(0);
    expect(out.absorbed).toEqual([OPUS]);
    expect(settleSegment(seg, cumFromModelUsage(cum(5_000, 90_100, 1e7, 1e5)), 'T2').residuals[0].tokens.output).toBe(
      100,
    );
  });

  it('totals going BACKWARDS restart from the spend since the last result — earlier p cannot mask later spend', () => {
    // The codex scenario: S=500=p; a partial restore returns 50 = 30 streamed + 20 helper.
    const seg = startSegment(newBackstopState(), 's', 'checkpoint', cumFromModelUsage(cum(0, 0, 0, 0)));
    const m = segmentModel(seg, OPUS);
    m.p = vec({ output: 500 });
    settleSegment(seg, cumFromModelUsage(cum(0, 500, 0, 0)), 'T1');
    m.p = vec({ output: 530 }); // 30 streamed since
    const out = settleSegment(seg, cumFromModelUsage(cum(0, 50, 0, 0)), 'T2');
    expect(out.rebased).toEqual([OPUS]);
    expect(out.residuals).toHaveLength(0); // the unobservable part of that one result
    expect(m.p).toEqual(vec({ output: 30 }));
    // The next helper call (+20) is charged in full — not masked by the old 500.
    expect(settleSegment(seg, cumFromModelUsage(cum(0, 70, 0, 0)), 'T3').residuals[0].tokens.output).toBe(20);
  });

  it('a costUSD-only revision does not rebase a priced model', () => {
    const seg = startSegment(newBackstopState(), 's', 'fresh', null);
    settleSegment(seg, cumFromModelUsage(cum(0, 100, 0, 0, 0.5)), 'T1');
    const out = settleSegment(seg, cumFromModelUsage(cum(0, 110, 0, 0, 0.4)), 'T2');
    expect(out.rebased).toEqual([]);
    expect(out.residuals[0].tokens.output).toBe(10);
  });

  it('a model first seen in a known-base segment has no history: base 0', () => {
    const seg = startSegment(newBackstopState(), 's', 'transcript', cumFromModelUsage(cum(1, 1, 1, 1)));
    const out = settleSegment(
      seg,
      cumFromModelUsage({ ...cum(1, 1, 1, 1), 'claude-haiku-4-5-20251001': { inputTokens: 900, outputTokens: 12 } }),
      'T',
    );
    expect(out.residuals.map((x) => x.key)).toEqual(['claude-haiku-4-5']);
    expect(out.residuals[0].tokens).toEqual(vec({ input: 900, output: 12 }));
  });

  it('an unpriced model is charged from the SDK cost figure, cumulatively, against the restored cost', () => {
    const mu = (c: number) => ({ 'claude-future-9': { inputTokens: 100, outputTokens: 10, costUSD: c } });
    const seg = startSegment(newBackstopState(), 's', 'transcript', cumFromModelUsage(mu(2)));
    expect(settleSegment(seg, cumFromModelUsage(mu(2.5)), 'T1').residuals[0]).toMatchObject({
      unpriced: true,
      usd: 0.5,
    });
    expect(settleSegment(seg, cumFromModelUsage(mu(2.75)), 'T2').residuals[0].usd).toBeCloseTo(0.25, 12);
  });

  it('residual cache writes take the main-thread TTL of the model, else of the segment, else 5m', () => {
    const seg = startSegment(newBackstopState(), 's', 'fresh', null);
    segmentModel(seg, 'claude-sonnet-5-5').mainCw1h = 100; // another model's main thread writes 1h
    expect(settleSegment(seg, cumFromModelUsage(cum(0, 0, 0, 30)), 'T').residuals[0].tokens).toEqual(vec({ cw1h: 30 }));
    const seg2 = startSegment(newBackstopState(), 's', 'fresh', null);
    expect(settleSegment(seg2, cumFromModelUsage(cum(0, 0, 0, 30)), 'T').residuals[0].tokens).toEqual(vec({ cw5: 30 }));
  });

  it('credit counts as charged: a later settle does not re-charge it', () => {
    const seg = startSegment(newBackstopState(), 's', 'fresh', null);
    settleSegment(seg, cumFromModelUsage(cum(0, 100, 0, 0)), 'T1');
    expect(settleSegment(seg, cumFromModelUsage(cum(0, 100, 0, 0)), 'T2').residuals).toHaveLength(0);
  });
});

describe('settleClosingSegment — the replaced segment against its final cost-state', () => {
  it('a normal end: the cost-state equals the last result, nothing more is owed', () => {
    const seg = startSegment(newBackstopState(), 's', 'fresh', null);
    segmentModel(seg, OPUS).p = vec({ output: 100 });
    settleSegment(seg, cumFromModelUsage(cum(0, 130, 0, 0)), 'T1'); // 30 residual
    const out = settleClosingSegment(seg, cumFromModelUsage(cum(0, 130, 0, 0)), 'T2');
    expect(out).toMatchObject({ residuals: [], settled: true, skipped: [] });
  });

  it('a process that died before its result: charges the final it never reported, once', () => {
    const seg = startSegment(newBackstopState(), 's', 'transcript', cumFromModelUsage(cum(2, 100, 0, 0)));
    segmentModel(seg, OPUS).p = vec({ input: 2, output: 7 }); // the snapshot
    const out = settleClosingSegment(seg, cumFromModelUsage(cum(4, 1_100, 0, 0)), 'T');
    expect(out.residuals[0].tokens).toEqual(vec({ output: 993 }));
    expect(seg.epoch).toBe(1);
  });

  it('a cost-state older than the last result, or no baseline at all, settles nothing', () => {
    const seg = startSegment(newBackstopState(), 's', 'fresh', null);
    settleSegment(seg, cumFromModelUsage(cum(0, 100, 0, 0)), 'T1');
    const stale = settleClosingSegment(seg, cumFromModelUsage(cum(0, 60, 0, 0)), 'T2');
    expect(stale).toMatchObject({ residuals: [], settled: false, skipped: [OPUS] });
    expect(seg.epoch).toBe(1);
    const absorbing = startSegment(newBackstopState(), 's', 'absorb', null);
    expect(settleClosingSegment(absorbing, cumFromModelUsage(cum(0, 999, 0, 0)), 'T')).toMatchObject({
      residuals: [],
      settled: false,
    });
  });
});

describe('checkpoints', () => {
  it('keeps the latest cumulative per session, bounded', () => {
    const st = newBackstopState();
    for (let i = 0; i < 20; i++)
      saveCheckpoint(
        st,
        `s${i}`,
        cumFromModelUsage(cum(i, i, 0, 0)),
        `2026-10-14T00:00:${String(i).padStart(2, '0')}Z`,
      );
    expect(Object.keys(st.checkpoints)).toHaveLength(16);
    expect(st.checkpoints.s0).toBeUndefined();
    expect(st.checkpoints.s19.cum[OPUS].output).toBe(19);
  });
});
