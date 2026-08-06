/**
 * Pure metric helpers for scripts/funnel.ts.
 *
 * Split out because funnel.ts invokes main() at import time — importing it from
 * a test would run the whole ~180-call funnel. Everything here is side-effect
 * free and unit-testable; see funnel-metrics.test.ts, which exercises each of
 * the traps documented below.
 */

// Deliberately broader than funnel.ts's BOT_LOGIN. For "was this PR ours?" only
// nv-slang-bot counts, but for "did a HUMAN pay review attention?" any automated
// reviewer (github-actions, dependabot, Copilot, a coworker fork's own app) is
// not human cost. GitHub suffixes App identities with "[bot]".
export const EXTRA_BOT_LOGINS = new Set(['devin-ai-integration', 'copilot-pull-request-reviewer']);
export const isBotLogin = (login: string): boolean =>
  login.endsWith('[bot]') || EXTRA_BOT_LOGINS.has(login.replace(/\[bot\]$/, ''));

// Reviews must be PAGINATED. `per_page=100` alone silently truncates at 100
// submissions — and it truncates precisely the heavily-argued PRs whose review
// cost this metric exists to measure, biasing the mean DOWNWARD exactly where it
// matters most. Returns null when the FIRST page fails, so the caller records
// "unknown" rather than mistaking a fetch failure for zero review.
export const REVIEW_PAGE_CAP = 10; // 1000 reviews; an infinite-loop backstop, not a real limit

export function fetchAllReviewsWith(fetchPage: (page: number) => unknown, onCap?: (n: number) => void): any[] | null {
  const all: any[] = [];
  for (let page = 1; page <= REVIEW_PAGE_CAP; page++) {
    const batch = fetchPage(page);
    if (!Array.isArray(batch)) return page === 1 ? null : all;
    all.push(...batch);
    if (batch.length < 100) return all;
  }
  onCap?.(all.length); // never truncate silently — say so
  return all;
}

/** Count human review rounds on one PR's review list. */
export function countHumanReview(reviews: any[], prAuthor: string | null): { rounds: number; reviewers: number } {
  // Reviews by a bot, and self-reviews (GitHub does record those), are not human
  // cost. Without the self-review exclusion a bot that reviews its own PR would
  // inflate its own apparent review cost.
  const human = reviews.filter((r: any) => {
    const login = r?.user?.login ?? '';
    return login && !isBotLogin(login) && login !== prAuthor;
  });
  return {
    // Rounds, not comments: nine line-comments inside ONE review is one round.
    rounds: human.filter((r: any) => r?.state === 'CHANGES_REQUESTED').length,
    reviewers: new Set(human.map((r: any) => r.user.login)).size,
  };
}

export interface ReviewCycleInput {
  prState: string | null;
  authoredByBot: boolean | null;
  humanReviewRounds: number | null;
  humanReviewers: number | null;
}

export interface ReviewCycleClass {
  reviewedPrs: number;
  unreviewedPrs: number;
  unknownPrs: number;
  meanRounds: number | null;
  coveragePct: number | null;
}

/**
 * Aggregate human review cost by author class.
 *
 * Three traps encoded here, each of which silently distorts the number:
 *
 * 1. ZERO CYCLES IS AMBIGUOUS. A PR merged with no human review scores zero
 *    rounds, which reads as flawless but means UNREVIEWED. Averaging those in
 *    makes a bot look better the less anyone looks at its work — backwards. The
 *    mean is over REVIEWED PRs only, with unreviewedPrs + coveragePct beside it
 *    so the denominator can never hide.
 * 2. A FAILED FETCH IS NOT ZERO REVIEW. Null rounds/reviewers mean the lookup
 *    failed; they land in unknownPrs and are excluded from the mean.
 * 3. SCOPE IS MERGED-ONLY. This prices SHIPPED throughput. An open PR with no
 *    reviews yet is "not reviewed YET", not "merged unreviewed"; counting it
 *    would dilute the mean with in-flight work. Excluded PRs are reported, split
 *    into a deliberate exclusion (notMergedExcluded) and a failure
 *    (unclassifiedPrs), because those mean very different things.
 */
export function aggregateReviewCycles(decisions: ReviewCycleInput[]): {
  scope: 'merged-only';
  notMergedExcluded: number;
  unclassifiedPrs: number;
  bot: ReviewCycleClass;
  human: ReviewCycleClass;
} {
  const acc = {
    bot: { reviewed: 0, unreviewed: 0, rounds: 0, unknown: 0 },
    human: { reviewed: 0, unreviewed: 0, rounds: 0, unknown: 0 },
  };
  let notMerged = 0;
  let unclassified = 0;
  for (const d of decisions) {
    if (d.prState === null || d.authoredByBot === null) {
      unclassified++; // PR fetch failed — a FAILURE, not a judgement
      continue;
    }
    if (d.prState !== 'merged') {
      notMerged++; // out of scope BY DESIGN
      continue;
    }
    const k = d.authoredByBot ? 'bot' : 'human';
    if (d.humanReviewers === null || d.humanReviewRounds === null) {
      acc[k].unknown++;
    } else if (d.humanReviewers === 0) {
      acc[k].unreviewed++;
    } else {
      acc[k].reviewed++;
      acc[k].rounds += d.humanReviewRounds;
    }
  }
  const shape = (k: 'bot' | 'human'): ReviewCycleClass => {
    const a = acc[k];
    const decided = a.reviewed + a.unreviewed;
    return {
      reviewedPrs: a.reviewed,
      unreviewedPrs: a.unreviewed,
      unknownPrs: a.unknown,
      meanRounds: a.reviewed ? Math.round((a.rounds / a.reviewed) * 100) / 100 : null,
      coveragePct: decided ? Math.round((a.reviewed / decided) * 100) : null,
    };
  };
  return {
    scope: 'merged-only',
    notMergedExcluded: notMerged,
    unclassifiedPrs: unclassified,
    bot: shape('bot'),
    human: shape('human'),
  };
}
