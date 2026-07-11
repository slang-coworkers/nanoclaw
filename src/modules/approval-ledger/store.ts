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
       FROM approval_decisions WHERE repo=? AND pr_number=? ORDER BY decided_at ASC`,
    )
    .all(repo, prNumber) as DecisionSessionRow[];
}

/**
 * Stamp the human verdict onto an existing decision row for the join. No-op
 * (returns false) if no decision row exists yet for (repo, pr, commit) — the
 * human review arrived before/without a Verity decision; nothing to join.
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
      `UPDATE approval_decisions SET human_verdict=@humanVerdict
       WHERE repo=@repo AND pr_number=@prNumber AND commit_sha=@commitSha`,
    )
    .run({ humanVerdict, repo, prNumber, commitSha });
  if (res.changes > 0) {
    log.info('approval decision joined to human verdict', {
      repo,
      pr: prNumber,
      commit: commitSha.slice(0, 12),
      human: humanVerdict,
    });
    return true;
  }
  return false;
}
