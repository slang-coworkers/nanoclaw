/**
 * Regression tests for the cost-pricing paths.
 *
 * Context, so the assertions below don't read as arbitrary trivia: on
 * slang-coworkers prod the dashboard reported ~$603 of spend since 2026-08-01
 * against ~$31,511 actual — a 52x understatement — because `claude-opus-5` was
 * absent from the pricing data both cost paths relied on. ccusage does not
 * error on an unknown model; it emits cost 0 with the token counts intact. So
 * the panel rendered a confident, wrong, small number and nothing went red.
 *
 * Both defects were data, not logic. Neither would have been caught by testing
 * the parsers, which is why these tests assert on the argv and the rate table
 * directly.
 */
import { describe, expect, it } from 'vitest';

import { ccusageDailyArgs, FALLBACK_PRICING } from './server.js';

describe('ccusageDailyArgs', () => {
  it('does NOT pass --offline', () => {
    // The whole bug. `--offline` prices from the snapshot bundled inside
    // ccusage 20.0.19 — already the latest release, so no version bump fixes
    // it — and that snapshot has no claude-opus-5. Live pricing resolves
    // against LiteLLM, which has had opus-5 all along.
    expect(ccusageDailyArgs()).not.toContain('--offline');
    expect(ccusageDailyArgs('20260801')).not.toContain('--offline');
  });

  it('requests JSON daily rows, with --since only when given', () => {
    expect(ccusageDailyArgs()).toEqual(['daily', '--json']);
    expect(ccusageDailyArgs('20260801')).toEqual(['daily', '--json', '--since', '20260801']);
  });
});

describe('FALLBACK_PRICING', () => {
  // scanSkillTranscriptCosts does `if (!FALLBACK_PRICING[model]) continue`, so
  // a missing model is DROPPED rather than merely unpriced. Prod's skill
  // transcripts held 2,002 opus-5 records against 205 sonnet-5 ones, so the
  // previous single-entry table discarded ~90% of them and reported the rest
  // as the total.
  it('prices the models actually in use, opus-5 above all', () => {
    for (const model of ['claude-opus-5', 'aws/anthropic/bedrock-claude-opus-5', 'claude-sonnet-5']) {
      expect(FALLBACK_PRICING[model], `${model} would be silently dropped`).toBeDefined();
    }
  });

  it('matches LiteLLM rates — the same source ccusage prices against', () => {
    // Divergence here means the ccusage path and the skill-transcript path
    // disagree about what the same tokens cost.
    expect(FALLBACK_PRICING['claude-opus-5']).toEqual({
      input: 5e-6,
      output: 25e-6,
      cacheCreate: 6.25e-6,
      cacheRead: 5e-7,
    });
    expect(FALLBACK_PRICING['claude-sonnet-5']).toEqual({
      input: 2e-6,
      output: 10e-6,
      cacheCreate: 2.5e-6,
      cacheRead: 2e-7,
    });
  });

  it('does not price sonnet-5 at sonnet-4-6 rates', () => {
    // The second defect found in this table: sonnet-5 carried
    // 3e-6/15e-6/3.75e-6/3e-7, which is claude-sonnet-4-6's price list
    // verbatim — a 50% markup. A wrong rate is worse than a missing one; it
    // renders with full confidence and invites no scrutiny.
    const sonnet5 = FALLBACK_PRICING['claude-sonnet-5'];
    const sonnet46 = FALLBACK_PRICING['claude-sonnet-4-6'];
    expect(sonnet46).toBeDefined();
    expect(sonnet5).not.toEqual(sonnet46);
    expect(sonnet5.input).toBeLessThan(sonnet46.input);
  });

  it('keeps every rate a positive, plausible per-token USD figure', () => {
    // Guards the units. A rate entered per-million rather than per-token would
    // still be a number and would still render — six orders of magnitude out.
    for (const [model, p] of Object.entries(FALLBACK_PRICING)) {
      for (const [field, rate] of Object.entries(p)) {
        expect(rate, `${model}.${field}`).toBeGreaterThan(0);
        expect(rate, `${model}.${field} looks per-million, not per-token`).toBeLessThan(1e-3);
      }
      expect(p.output, `${model}: output should cost more than input`).toBeGreaterThan(p.input);
      expect(p.cacheRead, `${model}: cache reads should be the cheapest rate`).toBeLessThan(p.input);
    }
  });
});
