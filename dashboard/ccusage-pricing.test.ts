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

import { ccusageDailyArgs, codexDayKey, FALLBACK_PRICING, normalizeCodexEntry } from './server.js';

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

describe('normalizeCodexEntry', () => {
  // Context: ccusage 20.x changed the Codex row's token fields, and the old
  // normalisation kept producing a well-formed, self-consistent, WRONG answer —
  // the same failure mode as the $0 opus-5 above, in the token columns instead
  // of the cost ones. Cost was never affected (`costUSD` is verbatim), which is
  // precisely why nothing looked wrong. Found by scripts/cost-parity.ts, which
  // compares TOKENS before dollars for exactly this reason.

  /** Verbatim from a real `ccusage@20.0.19 codex daily --json --offline` run. */
  const ccusage20Row = {
    date: '2026-08-01',
    costUSD: 0.0092,
    inputTokens: 600, // ALREADY net of cache in 20.x
    cacheReadTokens: 400,
    cacheCreationTokens: 0,
    outputTokens: 200,
    reasoningOutputTokens: 0,
    totalTokens: 1200,
    models: {
      'azure/openai/gpt-5.6-sol': {
        inputTokens: 600,
        cacheReadTokens: 400,
        cacheCreationTokens: 0,
        outputTokens: 200,
        reasoningOutputTokens: 0,
        totalTokens: 1200,
        isFallback: false,
      },
    },
  };

  it('keeps ccusage 20.x cache reads instead of zeroing them', () => {
    // The regression: `cachedInputTokens` does not exist in 20.x, so reading it
    // yielded 0 and the Metrics UI showed every Codex coworker as doing no cache
    // reads at all — while `totalTokens` beside it still counted them.
    const e = normalizeCodexEntry(ccusage20Row);
    expect(e.cacheReadTokens).toBe(400);
    expect(e.inputTokens).toBe(600);
    expect(e.outputTokens).toBe(200);
  });

  it('makes the token columns sum to the totalTokens rendered beside them', () => {
    // The user-visible symptom of the bug, stated as an invariant: a row whose
    // parts do not add up to its own total is the tell.
    const e = normalizeCodexEntry(ccusage20Row);
    expect(e.inputTokens + e.outputTokens + e.cacheReadTokens + e.cacheCreationTokens).toBe(e.totalTokens);
  });

  it('applies the same fix per model, not just to the day total', () => {
    const [mb] = normalizeCodexEntry(ccusage20Row).modelBreakdowns;
    expect(mb).toMatchObject({ modelName: 'azure/openai/gpt-5.6-sol', inputTokens: 600, cacheReadTokens: 400 });
    expect(mb.cost).toBeCloseTo(0.0092, 10);
  });

  it('still nets the LEGACY @ccusage/codex shape, where inputTokens included cache', () => {
    // Both shapes must land on the same answer; the discriminator is which
    // field is present, not a version number.
    const e = normalizeCodexEntry({
      date: 'Aug 01, 2026',
      costUSD: 0.0092,
      inputTokens: 1000, // inclusive of the 400 cached
      cachedInputTokens: 400,
      outputTokens: 200,
      totalTokens: 1600,
      models: { 'gpt-5.6-sol': { inputTokens: 1000, cachedInputTokens: 400, outputTokens: 200, totalTokens: 1600 } },
    });
    expect(e.inputTokens).toBe(600);
    expect(e.cacheReadTokens).toBe(400);
    expect(e.modelBreakdowns[0]).toMatchObject({ inputTokens: 600, cacheReadTokens: 400 });
  });

  it('never touches cost — ccusage computes it with the correct split', () => {
    expect(normalizeCodexEntry(ccusage20Row).totalCost).toBe(0.0092);
  });
});

describe('codexDayKey', () => {
  it('anchors a bare calendar date at UTC so the host timezone cannot shift the day', () => {
    // `new Date('Aug 01, 2026').toISOString()` reads that as LOCAL midnight, so
    // on any host east of UTC the key slides back to 2026-07-31 — moving a whole
    // day of spend across a --since boundary and between chart buckets. Prod is
    // Etc/UTC (latent); the lego/dev box is not.
    expect(codexDayKey('Aug 01, 2026')).toBe('2026-08-01');
    expect(codexDayKey('Jan 1, 2026')).toBe('2026-01-01');
  });

  it('passes an already-ISO date through untouched, and refuses junk', () => {
    expect(codexDayKey('2026-08-01')).toBe('2026-08-01');
    expect(codexDayKey('2026-08-01T04:00:00Z')).toBe('2026-08-01');
    expect(codexDayKey('not a date')).toBe('');
    expect(codexDayKey(undefined)).toBe('');
  });
});
