/**
 * approval_decisions write path — the PR-approver coworker's decision ledger.
 *
 * A container agent (slang-pr-approver / slangpy-pr-approver) emits a
 * `record_decision` system action after its critique-gated decision; the
 * delivery handler (index.ts) calls upsertDecision here. Container agents
 * cannot write v2.db directly — this is the host side of the same two-DB
 * transport used by pr-mapping's map_pr_session.
 *
 * INSERT OR REPLACE on (repo, pr, commit_sha): one decision per reviewed
 * commit, last-writer-wins (a corrected re-run supersedes the prior row).
 *
 * `recordHumanVerdict` is the join side: when a live `github.pr_review` lands
 * (or a terminal merged/closed event), the human outcome is stamped onto the
 * matching (repo, pr, commit) row so agreement can be measured and the approver
 * can distill a learning. It never overwrites decision fields.
 */
import type Database from 'better-sqlite3';

import { log } from '../../log.js';

export interface DecisionWrite {
  repo: string;
  prNumber: number;
  commitSha: string;
  mode: string;
  decision: string;
  reasonCode: string | null;
  reviewDiffHash: string | null;
  policyVersion: string | null;
  clausesJson: string | null;
  challengerJson: string | null;
  agentGroupId: string;
  sessionId: string;
  threadId: string | null;
  decidedAt: string;
}

const VALID_DECISIONS = new Set(['WOULD_APPROVE', 'BLOCK', 'ABSTAIN_POLICY', 'ABSTAIN_INFRA']);

/** Whether the string is one of the four closed decision states. */
export function isValidDecision(d: string): boolean {
  return VALID_DECISIONS.has(d);
}

/** Insert or replace one decision row. Returns true on write. */
export function upsertDecision(db: Database.Database, w: DecisionWrite): boolean {
  db.prepare(
    `INSERT OR REPLACE INTO approval_decisions (
       repo, pr_number, commit_sha, mode, decision, reason_code,
       review_diff_hash, policy_version, clauses_json, challenger_json,
       human_verdict, agent_group_id, session_id, thread_id, decided_at
     ) VALUES (
       @repo, @prNumber, @commitSha, @mode, @decision, @reasonCode,
       @reviewDiffHash, @policyVersion, @clausesJson, @challengerJson,
       COALESCE((SELECT human_verdict FROM approval_decisions
                 WHERE repo=@repo AND pr_number=@prNumber AND commit_sha=@commitSha), NULL),
       @agentGroupId, @sessionId, @threadId, @decidedAt
     )`,
  ).run({
    repo: w.repo,
    prNumber: w.prNumber,
    commitSha: w.commitSha,
    mode: w.mode,
    decision: w.decision,
    reasonCode: w.reasonCode,
    reviewDiffHash: w.reviewDiffHash,
    policyVersion: w.policyVersion,
    clausesJson: w.clausesJson,
    challengerJson: w.challengerJson,
    agentGroupId: w.agentGroupId,
    sessionId: w.sessionId,
    threadId: w.threadId,
    decidedAt: w.decidedAt,
  });
  log.info('approval decision recorded', {
    repo: w.repo,
    pr: w.prNumber,
    commit: w.commitSha.slice(0, 12),
    decision: w.decision,
    reason: w.reasonCode ?? '',
  });
  return true;
}

/**
 * The approver session(s) that decided a given PR — the ledger is the index.
 * Used to route a terminal PR event (merged / closed) back to the approver
 * that decided it so it can join the human outcome onto its decision row and
 * distill an abstract learning. Returns one row per decided commit (a PR may
 * have several revision decisions from the same session); callers dedup on
 * (agent_group_id, thread_id) when delivering. Empty when no approver ever
 * decided this PR — nothing to learn, nothing to route.
 */
export interface DecisionSessionRow {
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
  commit_sha: string;
  decision: string;
  human_verdict: string | null;
}

export function getDecisionSessionsForPr(db: Database.Database, repo: string, prNumber: number): DecisionSessionRow[] {
  return db
    .prepare(
      `SELECT agent_group_id, session_id, thread_id, commit_sha, decision, human_verdict
       FROM approval_decisions WHERE repo=? AND pr_number=? ORDER BY datetime(decided_at) ASC, rowid ASC`,
    )
    .all(repo, prNumber) as DecisionSessionRow[];
}

/**
 * Stamp the human verdict onto an existing decision row for the join.
 *
 * Exact (repo, pr, commit) first — that is the true join: the human reviewed
 * the very head the approver decided on.
 *
 * Falling back matters because the common case is NOT exact. A PR the approver
 * decided at head X routinely gains commits and merges at head Y, and the
 * terminal verdict carries Y. An exact-only UPDATE then matches nothing,
 * changes 0 rows, and returns false **silently** — the caller has no reason to
 * suspect anything and the decision is never scored. Measured on the
 * slang-coworkers prod ledger (2026-08-04): of 26 PRs that reached a terminal
 * state without ever being stamped, 22 (85%) had advanced past the decided
 * commit. That single silent no-op was the dominant cause of a 42% hole in the
 * calibration data.
 *
 * So when the exact row is absent, stamp the most recent UNSTAMPED decision for
 * that PR — the approver's last call is what the outcome actually judges — and
 * say so in the log.
 *
 * FIRST VERDICT WINS, on both paths. The exact UPDATE carries the same
 * `human_verdict IS NULL` guard as the fallback, so the invariant holds
 * globally rather than only where the head happened to advance. Without it the
 * two paths disagree on identical human behaviour — a reviewer requests
 * changes and then merges with no new commits, and the later MERGED silently
 * overwrites the CHANGES_REQUESTED, erasing the only evidence that the
 * approver's call was wrong. That is precisely the signal this ledger exists to
 * capture, so it is never overwritten.
 *
 * `join_mode` records which path stamped the row ('exact' | 'head_advanced'),
 * so precision can be reported split by whether the head moved. If the
 * head_advanced group ever scores materially better than exact, the
 * merge-outcome over-credit bias has arrived and it is visible in one query.
 */
export function recordHumanVerdict(
  db: Database.Database,
  repo: string,
  prNumber: number,
  commitSha: string,
  humanVerdict: string,
): boolean {
  const res = db
    .prepare(
      `UPDATE approval_decisions SET human_verdict=@humanVerdict, join_mode='exact'
       WHERE repo=@repo AND pr_number=@prNumber AND commit_sha=@commitSha
         AND human_verdict IS NULL`,
    )
    .run({ humanVerdict, repo, prNumber, commitSha });
  if (res.changes > 0) {
    log.info('approval decision joined to human verdict', {
      repo,
      pr: prNumber,
      commit: commitSha.slice(0, 12),
      human: humanVerdict,
      joinMode: 'exact',
    });
    return true;
  }

  // `datetime()` + rowid is load-bearing. decided_at is agent-supplied and
  // unvalidated (an optional MCP arg passed through raw), so a bare TEXT sort
  // mis-orders offset forms ('…14:00:00+02:00' sorts above '…12:30:00Z') and
  // truncated fractions ('Z' > '.'), and an exact tie would credit the FIRST
  // row — the opposite of "latest". Prod carries proof this is not theoretical:
  // slang#11530 holds a decision stamped 730h AFTER its own merge.
  const latest = db
    .prepare(
      `SELECT rowid AS rid, commit_sha AS decidedSha FROM approval_decisions
        WHERE repo=? AND pr_number=? AND human_verdict IS NULL
        ORDER BY datetime(decided_at) DESC, rowid DESC LIMIT 1`,
    )
    .get(repo, prNumber) as { rid: number; decidedSha: string } | undefined;

  if (!latest) {
    // Genuinely nothing to join: no decision for this PR, or every decision
    // already carries a verdict. Logged so a missing join is never silent.
    log.info('human verdict had no unstamped decision to join', {
      repo,
      pr: prNumber,
      commit: commitSha.slice(0, 12),
      human: humanVerdict,
    });
    return false;
  }

  db.prepare("UPDATE approval_decisions SET human_verdict=?, join_mode='head_advanced' WHERE rowid=?").run(
    humanVerdict,
    latest.rid,
  );
  log.info('approval decision joined to human verdict (head advanced past the decision)', {
    repo,
    pr: prNumber,
    verdictCommit: commitSha.slice(0, 12),
    decidedCommit: latest.decidedSha.slice(0, 12),
    human: humanVerdict,
    joinMode: 'head_advanced',
  });
  return true;
}
