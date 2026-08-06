/**
 * Fixture tests for the review-cycle metric traps.
 *
 * Each trap below is one where the number looks perfectly reasonable while being
 * wrong in a direction that flatters the bot. That is exactly the kind of bug a
 * dashboard never surfaces on its own, so it gets a test.
 */
import { describe, expect, it } from 'vitest';

import {
  aggregateReviewCycles,
  countHumanReview,
  fetchAllReviewsWith,
  isBotLogin,
  REVIEW_PAGE_CAP,
  type ReviewCycleInput,
} from './funnel-metrics.js';

const merged = (o: Partial<ReviewCycleInput> = {}): ReviewCycleInput => ({
  prState: 'merged',
  authoredByBot: true,
  humanReviewRounds: 0,
  humanReviewers: 1,
  ...o,
});

describe('trap 1 — zero cycles is ambiguous (unreviewed ≠ clean)', () => {
  it('excludes merged-unreviewed PRs from the mean instead of scoring them 0', () => {
    // One genuinely reviewed PR that took 2 rounds, plus three merged with no
    // human review at all. The naive mean would be 2/4 = 0.5 and would IMPROVE
    // as more work merges unreviewed. The honest mean is 2.
    const r = aggregateReviewCycles([
      merged({ humanReviewRounds: 2, humanReviewers: 1 }),
      merged({ humanReviewRounds: 0, humanReviewers: 0 }),
      merged({ humanReviewRounds: 0, humanReviewers: 0 }),
      merged({ humanReviewRounds: 0, humanReviewers: 0 }),
    ]);
    expect(r.bot.meanRounds).toBe(2);
    expect(r.bot.reviewedPrs).toBe(1);
    expect(r.bot.unreviewedPrs).toBe(3);
    expect(r.bot.coveragePct).toBe(25); // the denominator is visible, not hidden
  });

  it('does not let unreviewed volume drag the mean toward zero', () => {
    const oneUnreviewed = aggregateReviewCycles([
      merged({ humanReviewRounds: 3, humanReviewers: 1 }),
      merged({ humanReviewRounds: 0, humanReviewers: 0 }),
    ]);
    const manyUnreviewed = aggregateReviewCycles([
      merged({ humanReviewRounds: 3, humanReviewers: 1 }),
      ...Array.from({ length: 50 }, () => merged({ humanReviewRounds: 0, humanReviewers: 0 })),
    ]);
    expect(oneUnreviewed.bot.meanRounds).toBe(3);
    expect(manyUnreviewed.bot.meanRounds).toBe(3); // unchanged
    expect(manyUnreviewed.bot.coveragePct).toBe(2); // but coverage collapses, loudly
  });
});

describe('trap 2 — a failed fetch is not zero review', () => {
  it('routes null rounds/reviewers to unknownPrs, out of the mean', () => {
    const r = aggregateReviewCycles([
      merged({ humanReviewRounds: 4, humanReviewers: 2 }),
      merged({ humanReviewRounds: null, humanReviewers: null }),
    ]);
    expect(r.bot.meanRounds).toBe(4);
    expect(r.bot.unknownPrs).toBe(1);
    expect(r.bot.reviewedPrs).toBe(1);
  });

  it('reports a failed PR lookup as unclassified rather than dropping it', () => {
    // Regression test: an earlier version skipped authoredByBot===null entirely,
    // so a degraded run was indistinguishable from a clean smaller one.
    const r = aggregateReviewCycles([
      merged(),
      { prState: null, authoredByBot: null, humanReviewRounds: null, humanReviewers: null },
      { prState: 'merged', authoredByBot: null, humanReviewRounds: 1, humanReviewers: 1 },
    ]);
    expect(r.unclassifiedPrs).toBe(2);
  });
});

describe('trap 3 — scope is merged-only', () => {
  it('excludes open/draft/closed-unmerged PRs and says how many', () => {
    const r = aggregateReviewCycles([
      merged({ humanReviewRounds: 1, humanReviewers: 1 }),
      merged({ prState: 'open', humanReviewRounds: 0, humanReviewers: 0 }),
      merged({ prState: 'closed', humanReviewRounds: 0, humanReviewers: 0 }),
    ]);
    expect(r.scope).toBe('merged-only');
    expect(r.notMergedExcluded).toBe(2);
    expect(r.bot.reviewedPrs).toBe(1);
    expect(r.bot.unreviewedPrs).toBe(0); // an unmerged PR is NOT "merged unreviewed"
  });

  it('keeps the deliberate exclusion separate from the failure', () => {
    const r = aggregateReviewCycles([
      merged({ prState: 'open' }),
      { prState: null, authoredByBot: null, humanReviewRounds: null, humanReviewers: null },
    ]);
    expect(r.notMergedExcluded).toBe(1);
    expect(r.unclassifiedPrs).toBe(1); // conflating these would hide a broken run
  });
});

describe('bot vs human split', () => {
  it('keeps the classes independent', () => {
    const r = aggregateReviewCycles([
      merged({ authoredByBot: true, humanReviewRounds: 3, humanReviewers: 1 }),
      merged({ authoredByBot: false, humanReviewRounds: 1, humanReviewers: 1 }),
    ]);
    expect(r.bot.meanRounds).toBe(3);
    expect(r.human.meanRounds).toBe(1);
  });

  it('returns null rather than 0 when a class has no reviewed PRs', () => {
    // 0 would read as "no review needed"; null reads as "no data".
    const r = aggregateReviewCycles([merged({ authoredByBot: true })]);
    expect(r.human.meanRounds).toBeNull();
    expect(r.human.coveragePct).toBeNull();
  });
});

describe('countHumanReview', () => {
  const rev = (login: string, state: string) => ({ user: { login }, state });

  it('counts rounds, not comments', () => {
    // One human, one CHANGES_REQUESTED review (which may carry many comments).
    expect(countHumanReview([rev('alice', 'CHANGES_REQUESTED')], 'nv-slang-bot[bot]').rounds).toBe(1);
  });

  it('ignores bot reviewers', () => {
    const r = countHumanReview(
      [rev('github-actions[bot]', 'CHANGES_REQUESTED'), rev('alice', 'CHANGES_REQUESTED')],
      'nv-slang-bot[bot]',
    );
    expect(r.rounds).toBe(1);
    expect(r.reviewers).toBe(1);
  });

  it('ignores self-reviews', () => {
    // GitHub does record these; counting them would inflate a bot's own cost.
    expect(countHumanReview([rev('alice', 'CHANGES_REQUESTED')], 'alice').rounds).toBe(0);
  });

  it('does not count APPROVED as a round', () => {
    expect(countHumanReview([rev('alice', 'APPROVED')], 'bot').rounds).toBe(0);
    expect(countHumanReview([rev('alice', 'APPROVED')], 'bot').reviewers).toBe(1);
  });
});

describe('review pagination', () => {
  it('follows pages until a short page', () => {
    const pages: Record<number, any[]> = {
      1: Array.from({ length: 100 }, (_, i) => ({ id: i })),
      2: Array.from({ length: 42 }, (_, i) => ({ id: 100 + i })),
    };
    expect(fetchAllReviewsWith((p) => pages[p] ?? [])).toHaveLength(142);
  });

  it('does not truncate a >100-review PR at 100', () => {
    // The whole point: heavily-reviewed PRs are exactly the expensive ones.
    const pages: Record<number, any[]> = {
      1: Array.from({ length: 100 }, () => ({ state: 'CHANGES_REQUESTED', user: { login: 'a' } })),
      2: Array.from({ length: 5 }, () => ({ state: 'CHANGES_REQUESTED', user: { login: 'a' } })),
    };
    const all = fetchAllReviewsWith((p) => pages[p] ?? [])!;
    expect(countHumanReview(all, 'bot').rounds).toBe(105);
  });

  it('returns null when the first page fails, so it reads as unknown not zero', () => {
    expect(fetchAllReviewsWith(() => null)).toBeNull();
  });

  it('keeps what it has when a LATER page fails', () => {
    const r = fetchAllReviewsWith((p) => (p === 1 ? Array.from({ length: 100 }, () => ({})) : null));
    expect(r).toHaveLength(100);
  });

  it('reports hitting the page cap instead of silently truncating', () => {
    let capped: number | null = null;
    fetchAllReviewsWith(
      () => Array.from({ length: 100 }, () => ({})),
      (n) => {
        capped = n;
      },
    );
    expect(capped).toBe(REVIEW_PAGE_CAP * 100);
  });
});

describe('isBotLogin', () => {
  it('treats any [bot] suffix as automated', () => {
    expect(isBotLogin('github-actions[bot]')).toBe(true);
    expect(isBotLogin('nv-slang-bot[bot]')).toBe(true);
  });
  it('catches known bots without the suffix', () => {
    expect(isBotLogin('devin-ai-integration')).toBe(true);
  });
  it('does not misclassify humans', () => {
    expect(isBotLogin('alice')).toBe(false);
    expect(isBotLogin('robotics-fan')).toBe(false); // substring match would fail here
  });
});
