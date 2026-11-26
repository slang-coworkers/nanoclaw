/**
 * Pure metric helpers for scripts/funnel.ts.
 *
 * Split out because funnel.ts invokes main() at import time — importing it from
 * a test would run the whole ~180-call funnel. Everything here is side-effect
 * free and unit-testable; see funnel-metrics.test.ts, which exercises each of
 * the traps documented below.
 */

import fs from 'node:fs';
import readline from 'node:readline';

// ── bot identity ─────────────────────────────────────────────────────────────
// GitHub suffixes App identities with "[bot]", but the SAME actor also appears
// bare: the reviews API returns `nv-slang-bot[bot]` while other payloads (and
// the PAT-authenticated pushes) show plain `nv-slang-bot`. Matching only the
// suffixed form counted our own bot's reviews as HUMAN review cost — the exact
// direction that flatters the metric. So every comparison normalises first.
export const normaliseLogin = (login: string): string =>
  login
    .trim()
    .replace(/\[bot\]$/i, '')
    .toLowerCase();

// Deliberately broader than OUR_BOT_LOGIN. For "was this PR ours?" only
// nv-slang-bot counts, but for "did a HUMAN pay review attention?" any automated
// reviewer (github-actions, dependabot, Copilot, a coworker fork's own app) is
// not human cost. Stored normalised; compare with normaliseLogin.
export const EXTRA_BOT_LOGINS = new Set([
  'nv-slang-bot',
  'devin-ai-integration',
  'copilot-pull-request-reviewer',
  'github-actions',
  'dependabot',
]);
export const isBotLogin = (login: string): boolean =>
  !!login && (/\[bot\]$/i.test(login.trim()) || EXTRA_BOT_LOGINS.has(normaliseLogin(login)));

// "Is this OUR bot?" — the author-class question, narrower than isBotLogin. A
// human PR reviewed by dependabot is still human-authored.
export const OUR_BOT_LOGIN = 'nv-slang-bot';
export const isOurBotLogin = (login: string | null | undefined): boolean =>
  !!login && normaliseLogin(login) === OUR_BOT_LOGIN;

// ── review fetch ─────────────────────────────────────────────────────────────
// Reviews must be PAGINATED. `per_page=100` alone silently truncates at 100
// submissions — and it truncates precisely the heavily-argued PRs whose review
// cost this metric exists to measure, biasing the mean DOWNWARD exactly where it
// matters most. Returns null when the FIRST page fails, so the caller records
// "unknown" rather than mistaking a fetch failure for zero review.
export const REVIEW_PAGE_CAP = 10; // 1000 reviews; an infinite-loop backstop, not a real limit

/**
 * Canonical API path for one page of a PR's review list.
 *
 * Page 1 deliberately omits `page=`: it is the same resource GitHub serves by
 * default, so emitting `&page=1` minted a SECOND cache key for identical bytes
 * and — worse — tripped the cache's "anything with page= is a volatile listing"
 * heuristic. A merged PR's reviews are immutable; they must be able to reach the
 * long TTL. See diskCacheTtl.
 */
export function reviewsApiPath(pr: number, page: number): string {
  const base = `pulls/${pr}/reviews?per_page=100`;
  return page > 1 ? `${base}&page=${page}` : base;
}

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

// ── disk-cache TTL policy ────────────────────────────────────────────────────
// Terminal-state items (merged PRs, closed issues) rarely change — cache them
// for 24h. Open/active items get 15min. Real listings always refetch.
export const TTL_LONG = 24 * 60 * 60 * 1000; // 24h — merged PRs, closed issues, their sub-resources
export const TTL_MED = 60 * 60 * 1000; // 1h  — check-runs, timeline, comments of live items
export const TTL_SHORT = 15 * 60 * 1000; // 15m — open items, listings

/** `pulls/12/reviews?per_page=100` → `pulls/12`. Null when not a sub-resource. */
export function parentResource(apiPath: string): string | null {
  const m = apiPath.split('?')[0].match(/^(pulls|issues)\/(\d+)\/.+$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Is the parent PR/issue in a terminal state? null = not known (never assume). */
export type TerminalLookup = (parentPath: string) => boolean | null;

/**
 * TTL for one cached GitHub response.
 *
 * Classified by ROUTE (the path with its query string dropped), never by
 * substring. The previous rule was `apiPath.includes('page=') → short`, which
 * looks like "listings are volatile" but actually caught every paginated
 * sub-resource: a merged PR's reviews always carry `page=N`, so the one class of
 * genuinely immutable data was the one class that could never be long-cached.
 * A merged PR is terminal; so is everything hanging off it.
 */
export function diskCacheTtl(apiPath: string, data: any, isTerminal: TerminalLookup = () => null): number {
  const route = apiPath.split('?')[0];
  // Real listings enumerate a set whose MEMBERSHIP changes — always refetch,
  // whatever page they are on.
  if (route === 'issues' || route === 'pulls') return TTL_SHORT;
  if (/^pulls\/\d+$/.test(route) && data) return data.merged || data.state === 'closed' ? TTL_LONG : TTL_SHORT;
  if (/^issues\/\d+$/.test(route) && data) return data.state === 'closed' ? TTL_LONG : TTL_SHORT;
  // Sub-resource: it inherits its parent's terminality. Unknown parent falls
  // through — ignorance never buys a long TTL.
  const parent = parentResource(apiPath);
  if (parent && isTerminal(parent) === true) return TTL_LONG;
  if (route.includes('check-runs') || route.includes('timeline') || route.includes('comments')) return TTL_MED;
  return TTL_SHORT;
}

// ── review rounds ────────────────────────────────────────────────────────────
// WHAT COUNTS AS A ROUND. Restricting rounds to CHANGES_REQUESTED measured
// almost nothing: across the reviewed census there were 5 CHANGES_REQUESTED
// against 1,178 COMMENTED, so ~96% of reviewed PRs scored zero and the headline
// read "review is nearly free" when in fact almost all review arrives as
// COMMENTED. A COMMENTED review is a human reading the diff and writing back;
// that IS the cost being priced. So a round is a FEEDBACK SESSION and both
// states feed it. APPROVED is a verdict, not a round of feedback — it still
// makes its author a reviewer, but costs no cycle. DISMISSED/PENDING are not
// submitted feedback at all.
const FEEDBACK_STATES = new Set(['CHANGES_REQUESTED', 'COMMENTED']);

// Replying to six threads in five minutes is ONE session, not six rounds —
// GitHub records standalone inline replies as separate COMMENTED reviews, so
// without this collapse a chatty reviewer outscores a genuinely contested PR.
// Gap measured per reviewer, so interleaved reviewers never split each other.
export const SESSION_GAP_MS = 30 * 60 * 1000;

export interface HumanReviewCount {
  /** Distinct human feedback sessions (CHANGES_REQUESTED + COMMENTED, collapsed). */
  feedbackRounds: number;
  /** Strict CHANGES_REQUESTED submissions. Kept beside the headline, never as it. */
  changesRequestedRounds: number;
  /** Distinct human reviewers, including approve-only ones. */
  reviewers: number;
}

/** Count human review effort on one PR's review list. */
export function countHumanReview(reviews: any[], prAuthor: string | null): HumanReviewCount {
  // Reviews by a bot, and self-reviews (GitHub does record those), are not human
  // cost. Without the self-review exclusion a bot that reviews its own PR would
  // inflate its own apparent review cost. Compared normalised, so a bare
  // `nv-slang-bot` self-review is caught as readily as `nv-slang-bot[bot]`.
  const author = prAuthor ? normaliseLogin(prAuthor) : null;
  const human = reviews.filter((r: any) => {
    const login = r?.user?.login ?? '';
    return login && !isBotLogin(login) && normaliseLogin(login) !== author;
  });

  const feedback = human.filter((r: any) => FEEDBACK_STATES.has(r?.state));
  // Group each reviewer's submissions in time; a gap longer than SESSION_GAP_MS
  // means they came back to the PR, which is a new round of cost.
  const timesByReviewer = new Map<string, number[]>();
  let untimed = 0;
  for (const r of feedback) {
    const t = Date.parse(r?.submitted_at ?? '');
    if (Number.isNaN(t)) {
      untimed++; // no timestamp — cannot PROVE it shares a session, so don't merge it
      continue;
    }
    const k = normaliseLogin(r.user.login);
    const list = timesByReviewer.get(k);
    if (list) list.push(t);
    else timesByReviewer.set(k, [t]);
  }
  let feedbackRounds = untimed;
  for (const times of timesByReviewer.values()) {
    times.sort((a, b) => a - b);
    feedbackRounds++; // the first submission opens a round
    for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > SESSION_GAP_MS) feedbackRounds++;
  }

  return {
    feedbackRounds,
    changesRequestedRounds: human.filter((r: any) => r?.state === 'CHANGES_REQUESTED').length,
    reviewers: new Set(human.map((r: any) => normaliseLogin(r.user.login))).size,
  };
}

export interface ReviewCycleInput {
  prState: string | null;
  authoredByBot: boolean | null;
  humanFeedbackRounds: number | null;
  humanChangesRequested: number | null;
  humanReviewers: number | null;
}

export interface ReviewCycleClass {
  reviewedPrs: number;
  unreviewedPrs: number;
  unknownPrs: number;
  /** Headline: mean human feedback sessions per REVIEWED merged PR. */
  meanFeedbackRounds: number | null;
  /** The strict CHANGES_REQUESTED mean. Near-zero by construction — see above. */
  meanChangesRequested: number | null;
  coveragePct: number | null;
}

/**
 * Aggregate human review cost by author class.
 *
 * Four traps encoded here, each of which silently distorts the number:
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
 * 4. THE FIELD NAME IS THE DEFINITION. Two means ship side by side and neither
 *    is called "rounds" unqualified: meanFeedbackRounds is the headline,
 *    meanChangesRequested is the strict subset. roundDefinition states the rule
 *    inside the artifact so a consumer cannot infer the wrong one.
 */
export function aggregateReviewCycles(decisions: ReviewCycleInput[]): {
  scope: 'merged-only';
  roundDefinition: 'feedback-session';
  sessionGapMinutes: number;
  notMergedExcluded: number;
  unclassifiedPrs: number;
  bot: ReviewCycleClass;
  human: ReviewCycleClass;
} {
  const acc = {
    bot: { reviewed: 0, unreviewed: 0, feedback: 0, changesRequested: 0, unknown: 0 },
    human: { reviewed: 0, unreviewed: 0, feedback: 0, changesRequested: 0, unknown: 0 },
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
    if (d.humanReviewers === null || d.humanFeedbackRounds === null || d.humanChangesRequested === null) {
      acc[k].unknown++;
    } else if (d.humanReviewers === 0) {
      acc[k].unreviewed++;
    } else {
      acc[k].reviewed++;
      acc[k].feedback += d.humanFeedbackRounds;
      acc[k].changesRequested += d.humanChangesRequested;
    }
  }
  const mean = (total: number, n: number) => (n ? Math.round((total / n) * 100) / 100 : null);
  const shape = (k: 'bot' | 'human'): ReviewCycleClass => {
    const a = acc[k];
    const decided = a.reviewed + a.unreviewed;
    return {
      reviewedPrs: a.reviewed,
      unreviewedPrs: a.unreviewed,
      unknownPrs: a.unknown,
      meanFeedbackRounds: mean(a.feedback, a.reviewed),
      meanChangesRequested: mean(a.changesRequested, a.reviewed),
      coveragePct: decided ? Math.round((a.reviewed / decided) * 100) : null,
    };
  };
  return {
    scope: 'merged-only',
    roundDefinition: 'feedback-session',
    sessionGapMinutes: SESSION_GAP_MS / 60000,
    notMergedExcluded: notMerged,
    unclassifiedPrs: unclassified,
    bot: shape('bot'),
    human: shape('human'),
  };
}

// ── PR-approver (Verity) weekly agreement trend ──────────────────────────────
// Verity runs in SHADOW mode: it records a decision on every PR
// (WOULD_APPROVE | BLOCK | ABSTAIN_POLICY | ABSTAIN_INFRA) and we compare it
// against what the humans ultimately did. The question these helpers answer is
// "is Verity improving week over week, and is it safe to take out of shadow
// mode?" — i.e. is agreement trending up, are abstains falling, and is the
// SAFETY-critical error (Verity WOULD_APPROVE something a human wanted changed)
// trending to zero.
//
// The hard part is the human ground truth. `human` (human_verdict) is the
// authoritative recorded verdict from the GitHub webhook path, but it is null on
// most still-open PRs, so we fall back to the review-cost signals the funnel
// already computes for each PR. Precedence, strongest/most-authoritative signal
// first:
//   1. recorded human verdict (…APPROVED / …CHANGES_REQUESTED) — webhook ground truth
//   2. humanChangesRequested > 0                 — a human formally blocked (strict signal);
//                                                  wins even over a later merge, because Verity
//                                                  approving a PR a human flagged IS the miss we price
//   3. prState === 'merged'                      — shipped == the human accepted it
//   4. reviewed (humanReviewers > 0) with humanChangesRequested === 0 — reviewed, not blocked
//   5. humanFeedbackRounds > 0                   — human engaged but no acceptance yet → not a clean approve
//   6. otherwise                                 — no verdict yet (excluded from agreement math)
//
// A COMMENTED-only review is deliberately NOT read as "requested changes" when
// there is an acceptance signal (merge / reviewed-clean): the funnel keeps
// CHANGES_REQUESTED strictly separate from COMMENTED for exactly this reason
// (≈96% of reviewed PRs are COMMENTED-not-CHANGES_REQUESTED — see countHumanReview),
// so a merge after some comments reads as approval, not rejection. feedbackRounds
// only tips toward "changes" when there is NO acceptance signal at all.
export type HumanVerdict = 'approved' | 'changes' | null;

export interface ApproverWeeklyInput {
  decidedAt: string;
  decision: string;
  human: string | null;
  prState: string | null;
  humanChangesRequested: number | null;
  humanFeedbackRounds: number | null;
  humanReviewers: number | null;
}

/** Best-available human ground truth for one Verity decision. See the block above. */
export function humanVerdictOf(d: ApproverWeeklyInput): HumanVerdict {
  const rec = (d.human ?? '').toUpperCase();
  if (rec.includes('CHANGES')) return 'changes'; // CHANGES_REQUESTED
  if (rec.includes('APPROV')) return 'approved'; // APPROVED
  if ((d.humanChangesRequested ?? 0) > 0) return 'changes';
  if (d.prState === 'merged') return 'approved';
  if ((d.humanReviewers ?? 0) > 0 && d.humanChangesRequested === 0) return 'approved';
  if ((d.humanFeedbackRounds ?? 0) > 0) return 'changes';
  return null;
}

/**
 * Monday (UTC) of the ISO week containing `iso`, as YYYY-MM-DD. Returns '' when
 * `iso` does not parse to a real date.
 *
 * Decisions are stamped ISO-8601 UTC, so bucketing is UTC throughout — no
 * local-time drift, and a decision at 23:00 UTC Sunday lands in the week that
 * ends that Sunday, not the next one.
 *
 * The unparseable-input guard matters once LEGACY (pre-enforcement) rows are
 * bucketed: their decided_at was agent-supplied and never normalized, so a
 * malformed value reaches here. Without the guard `new Date(garbage)` yields an
 * Invalid Date whose `.toISOString()` THROWS — one bad legacy row would abort the
 * whole weekly aggregation. Returning '' lets the caller skip it the same way it
 * skips a missing timestamp.
 */
export function mondayUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

const isApproveDecision = (decision: string) => decision === 'WOULD_APPROVE';
const isBlockDecision = (decision: string) => decision === 'BLOCK';
const isAbstainDecision = (decision: string) => decision.startsWith('ABSTAIN');

export interface ApproverWeek {
  weekStart: string; // YYYY-MM-DD (Monday, UTC)
  total: number; // all decisions decided that week
  wouldApprove: number;
  block: number;
  abstain: number; // ABSTAIN_POLICY + ABSTAIN_INFRA
  withHumanVerdict: number; // decisions (any type) with a determinable human verdict
  agreedApprove: number; // WOULD_APPROVE and human-approved
  agreedBlock: number; // BLOCK and human-requested-changes
  falseApprove: number; // WOULD_APPROVE but human-requested-changes ← the SAFETY-critical error
  falseBlock: number; // BLOCK but human-approved
  agreementPct: number | null; // (agreedApprove+agreedBlock)/withHumanVerdict × 100; null when no verdicts
}

/**
 * Bucket Verity's decisions by the Monday (UTC) of `decidedAt` and, per week,
 * count the decision mix and its agreement with the human ground truth.
 *
 * Feed this the SAME decision array the snapshot's `approverDecisions` is built
 * from, so it inherits the provenance filter (trusted/agent_verified only) and
 * the migration-935 legacy quarantine for free — no separate filtering here.
 *
 * It is deliberately provenance-agnostic — it buckets and scores whatever rows
 * it is handed. The producer calls it TWICE: once on the trusted decisions
 * (`approverWeekly`) and once on the quarantined pre-enforcement rows
 * (`approverWeeklyLegacy`), so the two populations are aggregated by identical
 * math but kept in separate series. Trust lives at the CALL SITE (which array),
 * never here — mixing the two into one array would launder unverified rows into
 * the trusted trend, exactly what the split tables exist to prevent.
 *
 * `agreementPct` divides by withHumanVerdict — every decision with a determinable
 * human verdict, ABSTAINs included. An abstain on a PR a human DID rule on is a
 * coverage gap, not an agreement, so it belongs in the denominator but can never
 * reach the numerator. Divide-by-zero (no human verdicts that week) → null, not
 * 0: "no data" must never render as "0% agreement".
 */
export function aggregateApproverWeekly(decisions: ApproverWeeklyInput[]): ApproverWeek[] {
  const byWeek = new Map<string, ApproverWeek>();
  for (const d of decisions) {
    if (!d.decidedAt) continue;
    const wk = mondayUtc(d.decidedAt);
    if (!wk) continue; // unparseable decided_at (legacy rows) — cannot bucket, drop it
    let w = byWeek.get(wk);
    if (!w) {
      w = {
        weekStart: wk,
        total: 0,
        wouldApprove: 0,
        block: 0,
        abstain: 0,
        withHumanVerdict: 0,
        agreedApprove: 0,
        agreedBlock: 0,
        falseApprove: 0,
        falseBlock: 0,
        agreementPct: null,
      };
      byWeek.set(wk, w);
    }
    w.total++;
    if (isApproveDecision(d.decision)) w.wouldApprove++;
    else if (isBlockDecision(d.decision)) w.block++;
    else if (isAbstainDecision(d.decision)) w.abstain++;

    const hv = humanVerdictOf(d);
    if (hv === null) continue; // no-human-verdict-yet — counts for total, not for agreement
    w.withHumanVerdict++;
    if (isApproveDecision(d.decision)) {
      if (hv === 'approved') w.agreedApprove++;
      else w.falseApprove++;
    } else if (isBlockDecision(d.decision)) {
      if (hv === 'changes') w.agreedBlock++;
      else w.falseBlock++;
    }
  }
  const weeks = [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  for (const w of weeks) {
    // Round to 1 decimal so small-N weeks still show movement without noise.
    w.agreementPct =
      w.withHumanVerdict > 0 ? Math.round(((w.agreedApprove + w.agreedBlock) / w.withHumanVerdict) * 1000) / 10 : null;
  }
  return weeks;
}

// ── routed head from the host log ───────────────────────────────────────────
// The host log is one multi-day file and passes 512 MB, Node's string ceiling;
// a whole-file readFileSync then throws ERR_STRING_TOO_LONG and the funnel
// stops refreshing. Stream it line by line instead. The match never spans a
// line (no `s` flag), so per-line matching finds exactly what the whole-file
// regex did.
const ROUTED_RE = /dev-routed issue(?: comment)? to peer.*?repo="([^"]+)".*?issue=(\d+)/g;

export function collectRoutedFromLine(line: string, into: Set<string>): void {
  // eslint-disable-next-line no-control-regex
  const clean = line.replace(/\x1b\[[0-9;]*m/g, '');
  ROUTED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROUTED_RE.exec(clean))) into.add(`${m[1]}#${m[2]}`);
}

export async function collectRoutedIssues(logPath: string): Promise<Set<string>> {
  const out = new Set<string>();
  const rl = readline.createInterface({ input: fs.createReadStream(logPath, 'utf-8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.includes('dev-routed issue')) collectRoutedFromLine(line, out);
  }
  return out;
}

// ── GitHub response handling ─────────────────────────────────────────────────
// A REST error still carries a JSON body. A rate-limit 403 is
// `{"message": "API rate limit exceeded for installation ID …", "documentation_url": …}`,
// and parsed without its status it reads as data: a timeline that is not a list
// looks like "no linked PR", so the issue drops out of the merged count. Each
// response is therefore classified by its status first, and only a 2xx body is
// ever stored or used as data.

export interface CurlResponse {
  status: number;
  /** Header names lower-cased. */
  headers: Record<string, string>;
  body: string;
}

/**
 * Split the output of `curl -sS -D -` into the final status code, its headers
 * and the body. curl prints one header block per response it received (an
 * interim `100 Continue` or a redirect adds one), so we skip to the last block.
 * Returns null when the output does not start with a status line.
 */
export function parseCurlResponse(raw: string): CurlResponse | null {
  let rest = raw;
  let status = 0;
  let headers: Record<string, string> = {};
  let sawBlock = false;
  while (/^HTTP\/[\d.]+ \d{3}/.test(rest)) {
    const end = rest.search(/\r?\n\r?\n/);
    if (end < 0) return null;
    const block = rest.slice(0, end);
    rest = rest.slice(end).replace(/^\r?\n\r?\n/, '');
    const lines = block.split(/\r?\n/);
    status = Number(lines[0].split(' ')[1]);
    headers = {};
    for (const line of lines.slice(1)) {
      const i = line.indexOf(':');
      if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
    sawBlock = true;
  }
  return sawBlock ? { status, headers, body: rest } : null;
}

/**
 * True for the body GitHub sends with an error: a top-level `message` with a
 * `documentation_url` or `status`. No resource the funnel reads has a top-level
 * `message` (a commit's message is nested under `commit`), so a cached entry of
 * this shape is an error that was stored as data.
 */
export function isGithubErrorBody(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return typeof d.message === 'string' && ('documentation_url' in d || 'status' in d);
}

export type FetchOutcome =
  | { kind: 'ok'; data: unknown }
  | { kind: 'missing' } // 404/410: a definite answer that the resource is gone
  | { kind: 'failed'; reason: string };

/** Classify one REST response: only a 2xx body that parses and is not an error body is data. */
export function classifyGithubResponse(res: CurlResponse | null): FetchOutcome {
  if (!res) return { kind: 'failed', reason: 'unreadable response' };
  if (res.status === 404 || res.status === 410) return { kind: 'missing' };
  let data: unknown;
  try {
    data = JSON.parse(res.body);
  } catch {
    return { kind: 'failed', reason: `HTTP ${res.status}, body is not JSON` };
  }
  if (res.status < 200 || res.status > 299 || isGithubErrorBody(data)) {
    const message = isGithubErrorBody(data) ? String((data as { message: string }).message) : '';
    return { kind: 'failed', reason: `HTTP ${res.status}${message ? `: ${message.slice(0, 80)}` : ''}` };
  }
  return { kind: 'ok', data };
}

/**
 * The installation's remaining REST budget from a response, or null when the
 * headers do not carry it. The funnel shares this budget with the coworkers, so
 * it stops calling below a floor instead of spending the last of it.
 */
export function rateLimitState(headers: Record<string, string>): { remaining: number; resetAtMs: number } | null {
  const remaining = Number(headers['x-ratelimit-remaining']);
  const reset = Number(headers['x-ratelimit-reset']);
  if (!Number.isFinite(remaining) || !Number.isFinite(reset)) return null;
  return { remaining, resetAtMs: reset * 1000 };
}

// ── issue partition ──────────────────────────────────────────────────────────
// "Not our problem": issues that do not count against the bot's win-rate,
// state_reason not_planned or any of these labels (case-insensitive substring).
export const NOT_A_BUG_LABELS = [
  'not a slang bug',
  'not reproduced',
  'duplicate',
  'invalid',
  'wontfix',
  "won't fix",
  'question',
  'by design',
];

export function isNotOurProblem(stateReason: string | null, labels: string[]): boolean {
  if (stateReason === 'not_planned') return true;
  const lc = labels.map((l) => l.toLowerCase());
  return lc.some((l) => NOT_A_BUG_LABELS.some((bad) => l.includes(bad)));
}

/**
 * Terminal stage of a PR, given its state and draft flag and the linked issue's
 * state. The PR spine and the issue partition share it so the two agree.
 */
export function classifyPrStage(prState: string | null, isDraft: boolean | null, issueState: string | null): string {
  if (prState === 'merged') return 'merged';
  if (prState === 'closed') return issueState === 'closed' ? 'superseded' : 'pr-closed';
  if (isDraft === false) return 'pr-ready';
  if (isDraft === true) return 'shipped-draft';
  return 'pr-open';
}

export interface IssuePart {
  repo: string;
  number: number;
  url: string;
  bucket: string; // not_our_problem | never_engaged | triage_only | resolved_elsewhere | bot_pr
  stage?: string; // bot-PR sub-stage (merged|shipped-draft|pr-ready|pr-closed|superseded|pr-open)
  prNumber?: number;
  prUrl?: string;
  note?: string;
  createdAt?: string; // issue created_at, used for the weekly WIN trend
}

/** A PR that cross-references an issue, as the GraphQL timeline reports it. */
export interface LinkedPr {
  number: number;
  url: string | null;
  author: string | null;
  isBot: boolean;
  prState: 'merged' | 'open' | 'closed' | null;
  isDraft: boolean | null;
}

// The order in which a bot PR represents its issue. An issue often collects
// several bot PRs (a first attempt closed, a later one merged); the issue's
// outcome is the furthest any of them got, so a merged PR outranks an earlier
// closed one.
const BOT_PR_RANK: Record<string, number> = { merged: 0, ready: 1, draft: 2, open: 3, closed: 4 };
const botPrRank = (p: LinkedPr): number =>
  p.prState === 'merged'
    ? BOT_PR_RANK.merged
    : p.prState === 'closed'
      ? BOT_PR_RANK.closed
      : p.isDraft === false
        ? BOT_PR_RANK.ready
        : p.isDraft === true
          ? BOT_PR_RANK.draft
          : BOT_PR_RANK.open;

/** The bot PR that represents an issue: the furthest along, earliest first on a tie. */
export function pickBotPr(prs: LinkedPr[]): LinkedPr | undefined {
  let best: LinkedPr | undefined;
  for (const p of prs) {
    if (!p.isBot) continue;
    if (!best || botPrRank(p) < botPrRank(best)) best = p;
  }
  return best;
}

/** The issue fields the GraphQL issue scan reads (see ISSUE_SCAN_QUERY in funnel.ts). */
export interface GraphqlIssueNode {
  number: number;
  url: string;
  createdAt: string;
  state: string; // OPEN | CLOSED
  stateReason: string | null; // COMPLETED | NOT_PLANNED | REOPENED | DUPLICATE | null
  labels?: { nodes?: Array<{ name?: string } | null> };
  timelineItems?: { nodes?: Array<{ source?: Record<string, any> | null } | null> };
  /** PRs GitHub links as closing the issue (the issue's Development box), merged or not. */
  closedByPullRequestsReferences?: { nodes?: Array<Record<string, any> | null> };
  comments?: { nodes?: Array<{ author?: { login?: string } | null } | null> };
}

function linkedPrOf(src: Record<string, any>): LinkedPr {
  const author: string | null = src.author?.login ?? null;
  const state = typeof src.state === 'string' ? src.state.toLowerCase() : null;
  return {
    number: src.number,
    url: src.url ?? null,
    author,
    isBot: isOurBotLogin(author),
    prState: src.merged ? 'merged' : state === 'open' || state === 'closed' ? state : null,
    isDraft: typeof src.isDraft === 'boolean' ? src.isDraft : null,
  };
}

/** The PRs in an issue's cross-reference timeline, in timeline order. Non-PR sources are dropped. */
export function linkedPrsFromTimeline(node: GraphqlIssueNode): LinkedPr[] {
  const out: LinkedPr[] = [];
  for (const item of node.timelineItems?.nodes ?? []) {
    const src = item?.source;
    if (!src || src.__typename !== 'PullRequest' || typeof src.number !== 'number') continue;
    out.push(linkedPrOf(src));
  }
  return out;
}

/** The PRs GitHub links as closing the issue. */
export function closingPrsOf(node: GraphqlIssueNode): LinkedPr[] {
  return (node.closedByPullRequestsReferences?.nodes ?? [])
    .filter((n): n is Record<string, any> => !!n && typeof n.number === 'number')
    .map(linkedPrOf);
}

/**
 * The bot PRs that count for an issue. Every bot attempt counts (open, draft,
 * closed). A merged bot PR counts as the issue's fix only when GitHub links it
 * as closing the issue, or when no PR is linked as closing and the issue is
 * closed. A merged bot PR that only mentions an issue still open did not fix it.
 */
export function botPrCandidates(linked: LinkedPr[], closing: LinkedPr[], issueState: string): LinkedPr[] {
  const mentionMayFix = closing.length === 0 && issueState === 'closed';
  const out: LinkedPr[] = closing.filter((p) => p.isBot);
  const seen = new Set(out.map((p) => p.url ?? `#${p.number}`));
  for (const p of linked) {
    if (!p.isBot || seen.has(p.url ?? `#${p.number}`)) continue;
    if (p.prState === 'merged' && !mentionMayFix) continue;
    out.push(p);
  }
  return out;
}

/**
 * Place one issue in the partition. Buckets are exclusive and checked in order:
 *   not_our_problem    — not_planned, or a not-a-bug label
 *   bot_pr             — a bot PR counts for it (botPrCandidates; stage from pickBotPr)
 *   resolved_elsewhere — closed as completed with only human PRs linked, or
 *                        closed as completed with no bot artifact at all
 *   triage_only        — the bot commented but opened no PR
 *   never_engaged      — no bot comment and no bot PR
 * The node's timeline and comment lists must be complete (all pages).
 */
export function classifyIssue(node: GraphqlIssueNode, repo: string): IssuePart {
  const base = { repo, number: node.number, url: node.url, createdAt: node.createdAt };
  const issueState = node.state.toLowerCase();
  const stateReason = node.stateReason ? node.stateReason.toLowerCase() : null;
  const labels = (node.labels?.nodes ?? []).map((l) => l?.name).filter((n): n is string => !!n);
  if (isNotOurProblem(stateReason, labels)) {
    return { ...base, bucket: 'not_our_problem', note: stateReason || 'not-a-bug label' };
  }
  const linked = linkedPrsFromTimeline(node);
  const closing = closingPrsOf(node);
  const botPr = pickBotPr(botPrCandidates(linked, closing, issueState));
  if (botPr) {
    return {
      ...base,
      bucket: 'bot_pr',
      stage: classifyPrStage(botPr.prState, botPr.isDraft, issueState),
      prNumber: botPr.number,
      prUrl: botPr.url ?? undefined,
    };
  }
  const closedCompleted = issueState === 'closed' && (stateReason === 'completed' || stateReason == null);
  const otherPrs = [...closing, ...linked];
  if (closedCompleted && otherPrs.length > 0) {
    return { ...base, bucket: 'resolved_elsewhere', prNumber: otherPrs[0].number };
  }
  const botCommented = (node.comments?.nodes ?? []).some((c) => isOurBotLogin(c?.author?.login));
  if (closedCompleted && !botCommented) {
    return { ...base, bucket: 'resolved_elsewhere', note: 'closed; no bot artifact' };
  }
  return { ...base, bucket: botCommented ? 'triage_only' : 'never_engaged' };
}
