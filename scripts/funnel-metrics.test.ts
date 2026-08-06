/**
 * Fixture tests for the review-cycle metric traps.
 *
 * Each trap below is one where the number looks perfectly reasonable while being
 * wrong in a direction that flatters the bot. That is exactly the kind of bug a
 * dashboard never surfaces on its own, so it gets a test.
 */
import { describe, expect, it } from 'vitest';

import {
  REVIEW_PAGE_CAP,
  SESSION_GAP_MS,
  TTL_LONG,
  TTL_MED,
  TTL_SHORT,
  type ReviewCycleInput,
  type TerminalLookup,
  aggregateReviewCycles,
  countHumanReview,
  diskCacheTtl,
  fetchAllReviewsWith,
  isBotLogin,
  isOurBotLogin,
  normaliseLogin,
  parentResource,
  reviewsApiPath,
} from './funnel-metrics.js';

const merged = (o: Partial<ReviewCycleInput> = {}): ReviewCycleInput => ({
  prState: 'merged',
  authoredByBot: true,
  humanFeedbackRounds: 0,
  humanChangesRequested: 0,
  humanReviewers: 1,
  ...o,
});

describe('trap 1 — zero cycles is ambiguous (unreviewed ≠ clean)', () => {
  it('excludes merged-unreviewed PRs from the mean instead of scoring them 0', () => {
    // One genuinely reviewed PR that took 2 rounds, plus three merged with no
    // human review at all. The naive mean would be 2/4 = 0.5 and would IMPROVE
    // as more work merges unreviewed. The honest mean is 2.
    const r = aggregateReviewCycles([
      merged({ humanFeedbackRounds: 2, humanReviewers: 1 }),
      merged({ humanFeedbackRounds: 0, humanReviewers: 0 }),
      merged({ humanFeedbackRounds: 0, humanReviewers: 0 }),
      merged({ humanFeedbackRounds: 0, humanReviewers: 0 }),
    ]);
    expect(r.bot.meanFeedbackRounds).toBe(2);
    expect(r.bot.reviewedPrs).toBe(1);
    expect(r.bot.unreviewedPrs).toBe(3);
    expect(r.bot.coveragePct).toBe(25); // the denominator is visible, not hidden
  });

  it('does not let unreviewed volume drag the mean toward zero', () => {
    const oneUnreviewed = aggregateReviewCycles([
      merged({ humanFeedbackRounds: 3, humanReviewers: 1 }),
      merged({ humanFeedbackRounds: 0, humanReviewers: 0 }),
    ]);
    const manyUnreviewed = aggregateReviewCycles([
      merged({ humanFeedbackRounds: 3, humanReviewers: 1 }),
      ...Array.from({ length: 50 }, () => merged({ humanFeedbackRounds: 0, humanReviewers: 0 })),
    ]);
    expect(oneUnreviewed.bot.meanFeedbackRounds).toBe(3);
    expect(manyUnreviewed.bot.meanFeedbackRounds).toBe(3); // unchanged
    expect(manyUnreviewed.bot.coveragePct).toBe(2); // but coverage collapses, loudly
  });
});

describe('trap 2 — a failed fetch is not zero review', () => {
  it('routes null rounds/reviewers to unknownPrs, out of the mean', () => {
    const r = aggregateReviewCycles([
      merged({ humanFeedbackRounds: 4, humanReviewers: 2 }),
      merged({ humanFeedbackRounds: null, humanChangesRequested: null, humanReviewers: null }),
    ]);
    expect(r.bot.meanFeedbackRounds).toBe(4);
    expect(r.bot.unknownPrs).toBe(1);
    expect(r.bot.reviewedPrs).toBe(1);
  });

  it('treats a null in ANY review field as unknown, not as zero', () => {
    // The three fields are filled from one fetch, but a partial object must not
    // be able to contribute a zero to either mean.
    const r = aggregateReviewCycles([
      merged({ humanFeedbackRounds: 2, humanChangesRequested: null, humanReviewers: 1 }),
      merged({ humanFeedbackRounds: null, humanChangesRequested: 0, humanReviewers: 1 }),
    ]);
    expect(r.bot.unknownPrs).toBe(2);
    expect(r.bot.reviewedPrs).toBe(0);
    expect(r.bot.meanFeedbackRounds).toBeNull();
  });

  it('reports a failed PR lookup as unclassified rather than dropping it', () => {
    // Regression test: an earlier version skipped authoredByBot===null entirely,
    // so a degraded run was indistinguishable from a clean smaller one.
    const r = aggregateReviewCycles([
      merged(),
      {
        prState: null,
        authoredByBot: null,
        humanFeedbackRounds: null,
        humanChangesRequested: null,
        humanReviewers: null,
      },
      { prState: 'merged', authoredByBot: null, humanFeedbackRounds: 1, humanChangesRequested: 1, humanReviewers: 1 },
    ]);
    expect(r.unclassifiedPrs).toBe(2);
  });
});

describe('trap 3 — scope is merged-only', () => {
  it('excludes open/draft/closed-unmerged PRs and says how many', () => {
    const r = aggregateReviewCycles([
      merged({ humanFeedbackRounds: 1, humanReviewers: 1 }),
      merged({ prState: 'open', humanFeedbackRounds: 0, humanReviewers: 0 }),
      merged({ prState: 'closed', humanFeedbackRounds: 0, humanReviewers: 0 }),
    ]);
    expect(r.scope).toBe('merged-only');
    expect(r.notMergedExcluded).toBe(2);
    expect(r.bot.reviewedPrs).toBe(1);
    expect(r.bot.unreviewedPrs).toBe(0); // an unmerged PR is NOT "merged unreviewed"
  });

  it('keeps the deliberate exclusion separate from the failure', () => {
    const r = aggregateReviewCycles([
      merged({ prState: 'open' }),
      {
        prState: null,
        authoredByBot: null,
        humanFeedbackRounds: null,
        humanChangesRequested: null,
        humanReviewers: null,
      },
    ]);
    expect(r.notMergedExcluded).toBe(1);
    expect(r.unclassifiedPrs).toBe(1); // conflating these would hide a broken run
  });
});

describe('trap 4 — the field name is the definition', () => {
  it('publishes both means, so neither can be read as the other', () => {
    // The same PR cost 5 feedback sessions and exactly 1 CHANGES_REQUESTED. A
    // single field called "rounds" would have to lie about one of them.
    const r = aggregateReviewCycles([merged({ humanFeedbackRounds: 5, humanChangesRequested: 1, humanReviewers: 2 })]);
    expect(r.bot.meanFeedbackRounds).toBe(5);
    expect(r.bot.meanChangesRequested).toBe(1);
  });

  it('states the round definition inside the artifact', () => {
    // A consumer reading the JSON must not have to guess which rule produced it.
    const r = aggregateReviewCycles([merged()]);
    expect(r.roundDefinition).toBe('feedback-session');
    expect(r.sessionGapMinutes).toBe(SESSION_GAP_MS / 60000);
  });
});

describe('bot vs human split', () => {
  it('keeps the classes independent', () => {
    const r = aggregateReviewCycles([
      merged({ authoredByBot: true, humanFeedbackRounds: 3, humanReviewers: 1 }),
      merged({ authoredByBot: false, humanFeedbackRounds: 1, humanReviewers: 1 }),
    ]);
    expect(r.bot.meanFeedbackRounds).toBe(3);
    expect(r.human.meanFeedbackRounds).toBe(1);
  });

  it('returns null rather than 0 when a class has no reviewed PRs', () => {
    // 0 would read as "no review needed"; null reads as "no data".
    const r = aggregateReviewCycles([merged({ authoredByBot: true })]);
    expect(r.human.meanFeedbackRounds).toBeNull();
    expect(r.human.meanChangesRequested).toBeNull();
    expect(r.human.coveragePct).toBeNull();
  });
});

describe('countHumanReview', () => {
  const rev = (login: string, state: string, submittedAt?: string) => ({
    user: { login },
    state,
    submitted_at: submittedAt,
  });

  it('counts rounds, not comments', () => {
    // One human, one CHANGES_REQUESTED review (which may carry many comments).
    const r = countHumanReview([rev('alice', 'CHANGES_REQUESTED')], 'nv-slang-bot[bot]');
    expect(r.feedbackRounds).toBe(1);
    expect(r.changesRequestedRounds).toBe(1);
  });

  it('ignores bot reviewers', () => {
    const r = countHumanReview(
      [rev('github-actions[bot]', 'CHANGES_REQUESTED'), rev('alice', 'CHANGES_REQUESTED')],
      'nv-slang-bot[bot]',
    );
    expect(r.feedbackRounds).toBe(1);
    expect(r.reviewers).toBe(1);
  });

  it('ignores self-reviews', () => {
    // GitHub does record these; counting them would inflate a bot's own cost.
    expect(countHumanReview([rev('alice', 'CHANGES_REQUESTED')], 'alice').feedbackRounds).toBe(0);
  });

  it('ignores a self-review spelled differently from the author field', () => {
    // `pulls/N` reported the author bare while the review carries the suffix.
    expect(countHumanReview([rev('Alice', 'COMMENTED')], 'alice').feedbackRounds).toBe(0);
  });

  it('does not count APPROVED as a round', () => {
    expect(countHumanReview([rev('alice', 'APPROVED')], 'bot').feedbackRounds).toBe(0);
    expect(countHumanReview([rev('alice', 'APPROVED')], 'bot').changesRequestedRounds).toBe(0);
    expect(countHumanReview([rev('alice', 'APPROVED')], 'bot').reviewers).toBe(1);
  });

  it('does not count DISMISSED or PENDING as rounds', () => {
    // Neither is submitted feedback; a dismissed review's cost was already paid
    // and counted when it was submitted.
    const r = countHumanReview([rev('alice', 'DISMISSED'), rev('bob', 'PENDING')], 'bot');
    expect(r.feedbackRounds).toBe(0);
  });

  it('COUNTS a COMMENTED review as a feedback round', () => {
    // THE regression. In the reviewed census there were 5 CHANGES_REQUESTED
    // against 1,178 COMMENTED, so a CHANGES_REQUESTED-only rule scored ~96% of
    // reviewed PRs at zero and reported "review is nearly free".
    const r = countHumanReview([rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z')], 'bot');
    expect(r.feedbackRounds).toBe(1);
    expect(r.changesRequestedRounds).toBe(0); // and the strict count still says 0, honestly
  });

  it('keeps the strict CHANGES_REQUESTED count as a subset of feedback rounds', () => {
    const r = countHumanReview(
      [
        rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z'),
        rev('alice', 'CHANGES_REQUESTED', '2026-07-02T10:00:00Z'),
        rev('bob', 'COMMENTED', '2026-07-03T10:00:00Z'),
      ],
      'bot',
    );
    expect(r.feedbackRounds).toBe(3);
    expect(r.changesRequestedRounds).toBe(1);
    expect(r.changesRequestedRounds).toBeLessThanOrEqual(r.feedbackRounds);
  });

  it('collapses one reviewer replying to many threads into a single round', () => {
    // GitHub records standalone inline replies as separate COMMENTED reviews.
    // Six replies in twenty minutes is one sitting, not six rounds of cost.
    const r = countHumanReview(
      [
        rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z'),
        rev('alice', 'COMMENTED', '2026-07-01T10:04:00Z'),
        rev('alice', 'COMMENTED', '2026-07-01T10:09:00Z'),
        rev('alice', 'COMMENTED', '2026-07-01T10:20:00Z'),
      ],
      'bot',
    );
    expect(r.feedbackRounds).toBe(1);
    expect(r.reviewers).toBe(1);
  });

  it('counts a reviewer coming back later as a second round', () => {
    // This is the cost the metric exists to price: the bot pushed, the human
    // had to read it again.
    const r = countHumanReview(
      [rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z'), rev('alice', 'COMMENTED', '2026-07-03T09:00:00Z')],
      'bot',
    );
    expect(r.feedbackRounds).toBe(2);
  });

  it('does not merge two reviewers into one session', () => {
    // Sessions are per reviewer; alice and bob commenting minutes apart are two
    // people paying attention, not one.
    const r = countHumanReview(
      [rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z'), rev('bob', 'COMMENTED', '2026-07-01T10:05:00Z')],
      'bot',
    );
    expect(r.feedbackRounds).toBe(2);
    expect(r.reviewers).toBe(2);
  });

  it('never merges undated feedback into a session', () => {
    // Without a timestamp we cannot PROVE two submissions share a sitting, and
    // guessing "same session" would silently deflate the cost.
    const r = countHumanReview([rev('alice', 'COMMENTED'), rev('alice', 'COMMENTED')], 'bot');
    expect(r.feedbackRounds).toBe(2);
  });

  it('does not let an unparseable timestamp swallow a round', () => {
    const r = countHumanReview(
      [rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z'), rev('alice', 'COMMENTED', 'not-a-date')],
      'bot',
    );
    expect(r.feedbackRounds).toBe(2);
  });

  it('does not bill the BARE nv-slang-bot identity as human review', () => {
    // THE other regression: isBotLogin only matched the "[bot]" suffix, so our
    // own bot's reviews (which arrive bare on some API surfaces) were counted as
    // a human paying attention — inflating exactly the number we report.
    const r = countHumanReview(
      [rev('nv-slang-bot', 'COMMENTED', '2026-07-01T10:00:00Z'), rev('alice', 'COMMENTED', '2026-07-01T10:00:00Z')],
      'someone-else',
    );
    expect(r.feedbackRounds).toBe(1);
    expect(r.reviewers).toBe(1);
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
    expect(countHumanReview(all, 'bot').changesRequestedRounds).toBe(105);
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

  it('leaves page= off page 1 so it shares the canonical cache key', () => {
    // `&page=1` minted a second key for identical bytes AND tripped the cache's
    // "contains page= ⇒ volatile listing" rule. Both are gone.
    expect(reviewsApiPath(12, 1)).toBe('pulls/12/reviews?per_page=100');
    expect(reviewsApiPath(12, 2)).toBe('pulls/12/reviews?per_page=100&page=2');
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
  it('catches our own bot without the suffix', () => {
    // The reported defect: a bare nv-slang-bot review was scored as human cost.
    expect(isBotLogin('nv-slang-bot')).toBe(true);
  });
  it('normalises case and stray whitespace before deciding', () => {
    expect(isBotLogin('NV-Slang-Bot')).toBe(true);
    expect(isBotLogin(' nv-slang-bot[BOT] ')).toBe(true);
  });
  it('does not misclassify humans', () => {
    expect(isBotLogin('alice')).toBe(false);
    expect(isBotLogin('robotics-fan')).toBe(false); // substring match would fail here
    expect(isBotLogin('')).toBe(false);
  });
});

describe('isOurBotLogin', () => {
  it('matches both spellings of our bot', () => {
    expect(isOurBotLogin('nv-slang-bot')).toBe(true);
    expect(isOurBotLogin('nv-slang-bot[bot]')).toBe(true);
  });
  it('is narrower than isBotLogin — other bots are not OUR bot', () => {
    // Author class asks "was this PR ours?", not "was it automated?".
    expect(isBotLogin('dependabot[bot]')).toBe(true);
    expect(isOurBotLogin('dependabot[bot]')).toBe(false);
    expect(isOurBotLogin('alice')).toBe(false);
    expect(isOurBotLogin(null)).toBe(false);
  });
  it('normalises the same way isBotLogin does', () => {
    expect(normaliseLogin('NV-Slang-Bot[bot]')).toBe('nv-slang-bot');
  });
});

describe('disk cache TTL', () => {
  const knows =
    (state: Record<string, boolean>): TerminalLookup =>
    (p) =>
      p in state ? state[p] : null;

  it('long-caches a MERGED PR’s reviews, on every page', () => {
    // The reported defect: the old rule was `path.includes('page=') ⇒ short`,
    // and review requests always carried page=N — so the one class of genuinely
    // immutable data was the one class that could never be long-cached.
    const terminal = knows({ 'pulls/12': true });
    expect(diskCacheTtl(reviewsApiPath(12, 1), [], terminal)).toBe(TTL_LONG);
    expect(diskCacheTtl(reviewsApiPath(12, 2), [], terminal)).toBe(TTL_LONG);
  });

  it('does not long-cache an OPEN PR’s reviews', () => {
    expect(diskCacheTtl(reviewsApiPath(12, 1), [], knows({ 'pulls/12': false }))).toBe(TTL_SHORT);
  });

  it('never buys a long TTL with ignorance', () => {
    // Parent not in the cache ⇒ unknown ⇒ shortest safe answer.
    expect(diskCacheTtl(reviewsApiPath(12, 2), [], () => null)).toBe(TTL_SHORT);
  });

  it('keeps real listings short whatever page they are on', () => {
    // A listing's MEMBERSHIP changes even when every member is terminal.
    expect(diskCacheTtl('issues?labels=bug&state=all&per_page=100&page=3', [])).toBe(TTL_SHORT);
    expect(diskCacheTtl('pulls?state=closed&per_page=100&page=2', [])).toBe(TTL_SHORT);
  });

  it('reads terminality off the item itself for a single PR or issue', () => {
    expect(diskCacheTtl('pulls/12', { merged: true, state: 'closed' })).toBe(TTL_LONG);
    expect(diskCacheTtl('pulls/12', { merged: false, state: 'open' })).toBe(TTL_SHORT);
    expect(diskCacheTtl('issues/9', { state: 'closed' })).toBe(TTL_LONG);
    expect(diskCacheTtl('issues/9', { state: 'open' })).toBe(TTL_SHORT);
  });

  it('lets a closed issue’s comments inherit the long TTL', () => {
    expect(diskCacheTtl('issues/9/comments?per_page=100', [], knows({ 'issues/9': true }))).toBe(TTL_LONG);
    expect(diskCacheTtl('issues/9/comments?per_page=100', [], knows({ 'issues/9': false }))).toBe(TTL_MED);
  });

  it('still gives check-runs the medium TTL', () => {
    // Not a PR/issue sub-resource — it hangs off a commit — so the old rule stands.
    expect(diskCacheTtl('commits/deadbeef/check-runs', {})).toBe(TTL_MED);
  });

  it('resolves the parent resource, and only for sub-resources', () => {
    expect(parentResource('pulls/12/reviews?per_page=100&page=2')).toBe('pulls/12');
    expect(parentResource('issues/9/timeline?per_page=100')).toBe('issues/9');
    expect(parentResource('pulls/12')).toBeNull();
    expect(parentResource('commits/deadbeef/check-runs')).toBeNull();
  });
});
