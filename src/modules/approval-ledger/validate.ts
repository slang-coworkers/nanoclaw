/**
 * Domain validation for ledger writes — the shapes the columns are allowed to
 * hold, checked before anything reaches SQLite.
 *
 * The capability guard answers "may this caller write at all"; this answers
 * "is what it wrote a fact about a real PR". Both are needed: an authorized
 * approver with a broken prompt can still emit `pr_number: NaN`, a 300 KB
 * `clauses` blob, or a `decided_at` in 2044 — and the store's ordering
 * (`ORDER BY datetime(decided_at)`) is only as sound as that field. Prod
 * already carries the proof: slang#11530 holds a decision stamped 730 hours
 * AFTER its own merge, which is what motivated the datetime() sort in the
 * first place. Validating the timestamp removes the need to sort around it.
 *
 * Every rejection names the field, because these are agent-facing: the reason
 * string is handed back to the caller through notifyAgent so a mis-shaped call
 * is a correctable error rather than a silent drop.
 */

/** owner/name, GitHub's own character set, both segments bounded. */
const REPO_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
/** git object names: sha-1 (40) or sha-256 (64) hex. */
const SHA_RE = /^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$/;

/** No repository has come close; anything above this is a typo or an attack. */
const MAX_PR_NUMBER = 10_000_000;
/** Short identifier columns (reason_code, policy_version, review_diff_hash, mode). */
const MAX_LABEL_LEN = 256;
/** Evidence blobs (clauses_json, challenger_json). Generous, but not unbounded. */
const MAX_BLOB_LEN = 64 * 1024;
/** Tolerated clock skew between the container's stamp and host time. */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

// ABSTAIN_INFRA retired (task #14): "the pipeline couldn't decide" now records
// ABSTAIN_POLICY with an infra reason_code (NO_REVIEW_SIGNAL, HARNESS_FAIL,
// CLAUSE_UNEVALUABLE:<name>, CHALLENGER_INCOMPLETE, CRITIQUE_UNAVAILABLE,
// STALE_STAGE), which already carries the infra-vs-policy distinction. This is
// the one authoritative list; isValidDecision (below) now rejects ABSTAIN_INFRA
// automatically, so a stale agent-runner-src copy still emitting it gets a
// correctable record_decision error. Historical ABSTAIN_INFRA rows persist in
// the ledger unchanged (the decision column is plain TEXT, no CHECK).
export const VALID_DECISIONS = ['WOULD_APPROVE', 'BLOCK', 'ABSTAIN_POLICY'] as const;
export const VALID_MODES = ['historical', 'live', 'live_late', 'unknown'] as const;
/**
 * The closed verdict domain. The first three are GitHub review states; MERGED
 * and CLOSED_UNMERGED are the terminal-event mapping the host applies in
 * notifyApproverOfTerminalPr; DISMISSED is a dismissed review.
 */
export const VALID_HUMAN_VERDICTS = [
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
  'MERGED',
  'CLOSED_UNMERGED',
] as const;

const DECISION_SET: ReadonlySet<string> = new Set(VALID_DECISIONS);
const MODE_SET: ReadonlySet<string> = new Set(VALID_MODES);
const HUMAN_VERDICT_SET: ReadonlySet<string> = new Set(VALID_HUMAN_VERDICTS);

/** Whether the string is one of the closed decision states. */
export function isValidDecision(d: string): boolean {
  return DECISION_SET.has(d);
}

/** Whether the string is one of the closed human-verdict states. */
export function isValidHumanVerdict(v: string): boolean {
  return HUMAN_VERDICT_SET.has(v);
}

export function isValidRepo(repo: string): boolean {
  return REPO_RE.test(repo);
}

export function isValidCommitSha(sha: string): boolean {
  return SHA_RE.test(sha);
}

export function isValidPrNumber(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_PR_NUMBER;
}

/**
 * `mode` is descriptive metadata, not an authorization input, so an
 * unrecognized value is normalized rather than rejected — dropping a real
 * decision over a label typo would lose the evidence the ledger exists for.
 */
export function normalizeMode(mode: string | null): string {
  if (!mode) return 'unknown';
  return MODE_SET.has(mode) ? mode : 'unknown';
}

/** Truncate a short label column; null passes through. */
export function boundLabel(v: string | null): string | null {
  if (v == null) return null;
  return v.length <= MAX_LABEL_LEN ? v : v.slice(0, MAX_LABEL_LEN);
}

/** Truncate an evidence blob; null passes through. */
export function boundBlob(v: string | null): string | null {
  if (v == null) return null;
  return v.length <= MAX_BLOB_LEN ? v : v.slice(0, MAX_BLOB_LEN);
}

/**
 * Normalize the agent-supplied decision time to an ISO instant the store can
 * order on: unparseable, or further ahead than the tolerated skew, falls back
 * to host `now`. A stamp in the past is kept as-is — a genuinely late write
 * about an earlier decision is legitimate, and the ledger should say when the
 * decision was made, not when it arrived.
 */
export function normalizeDecidedAt(raw: string | null, now: number = Date.now()): { iso: string; corrected: boolean } {
  if (raw) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms) && ms <= now + MAX_FUTURE_SKEW_MS) {
      return { iso: new Date(ms).toISOString(), corrected: false };
    }
  }
  return { iso: new Date(now).toISOString(), corrected: raw != null };
}

export interface DomainError {
  field: string;
  reason: string;
}

/**
 * Validate the (repo, pr, sha) triple every ledger write is keyed on.
 * Returns the first problem, or null when the triple is well-formed.
 */
export function validatePrRef(repo: string, prNumber: number, commitSha: string): DomainError | null {
  if (!isValidRepo(repo)) {
    return { field: 'repo', reason: `repo must be owner/name (got ${JSON.stringify(repo).slice(0, 80)})` };
  }
  if (!isValidPrNumber(prNumber)) {
    return { field: 'pr_number', reason: `pr_number must be a positive integer below ${MAX_PR_NUMBER}` };
  }
  if (!isValidCommitSha(commitSha)) {
    return {
      field: 'commit_sha',
      reason: `commit_sha must be a 40- or 64-character hex git object name (got ${JSON.stringify(commitSha).slice(0, 80)})`,
    };
  }
  return null;
}
