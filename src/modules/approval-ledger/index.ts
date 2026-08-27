/**
 * Approval-decision ledger module.
 *
 * The PR-approver coworker ("Verity") emits a `record_decision` system action
 * after its critique-gated decision; this handler records it in the central
 * DB's approval_decisions table. Container agents can't write v2.db directly —
 * this is the host side of the same two-DB transport that pr-mapping's
 * `map_pr_session` uses.
 *
 * Both actions register with a GUARD SPEC, not `unguarded(...)`. They used to
 * register unguarded on the reasoning that a ledger append is "an audit
 * record, not a privileged mutation". That reasoning was wrong in both halves:
 * the record is the evidence humans calibrate bot trust against, so writing it
 * IS privileged; and the old INSERT OR REPLACE made it a mutation of existing
 * records, not an append. See ./guard.ts for the decisions and ./store.ts for
 * the append-only write.
 *
 * A second action, `record_human_verdict`, is now denied from every container
 * — the host stamps the human outcome deterministically from the GitHub
 * webhook (webhook-github.ts). The registration is kept so an older container
 * image still emitting it gets a reason instead of a silent
 * "Unknown system action" drop.
 */
import { getDb } from '../../db/connection.js';
import { registerDeliveryAction } from '../../delivery.js';
import { log } from '../../log.js';
import type { Session } from '../../types.js';
import { notifyAgent } from '../approvals/index.js';
import { approvalLedgerRecordDecision, approvalLedgerRecordHumanVerdict } from './guard.js';
import { appendDecision } from './store.js';
import { isValidDecision } from './validate.js';

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const jsonStr = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
};
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

/**
 * Shape validation runs as the guard wrapper's precheck: a malformed call is
 * answered without ever reaching the capability decision, so a broken prompt
 * from a legitimate approver reads as "you sent the wrong arguments" rather
 * than as an authorization failure.
 */
async function validateRecordDecision(content: Record<string, unknown>, session: Session): Promise<boolean> {
  const repo = str(content.repo);
  const prNumber = num(content.pr_number);
  const commitSha = str(content.commit_sha);
  const decision = str(content.decision);

  if (!repo || !Number.isFinite(prNumber) || !commitSha || !decision) {
    log.warn('record_decision: missing repo/pr_number/commit_sha/decision', { content });
    await notifyAgent(session, 'record_decision ignored: repo, pr_number, commit_sha and decision are all required.');
    return false;
  }
  if (!isValidDecision(decision)) {
    log.warn('record_decision: invalid decision state (dropped)', { decision, repo, pr: prNumber });
    await notifyAgent(
      session,
      `record_decision ignored: "${decision}" is not a decision state. Use WOULD_APPROVE, BLOCK or ABSTAIN_POLICY.`,
    );
    return false;
  }
  return true;
}

async function applyRecordDecision(content: Record<string, unknown>, session: Session): Promise<void> {
  const outcome = await appendDecision(getDb(), {
    repo: str(content.repo) as string,
    prNumber: num(content.pr_number),
    commitSha: str(content.commit_sha) as string,
    mode: str(content.mode) ?? 'unknown',
    decision: str(content.decision) as string,
    reasonCode: str(content.reason_code),
    reviewDiffHash: str(content.review_diff_hash),
    policyVersion: str(content.policy_version),
    clausesJson: jsonStr(content.clauses),
    challengerJson: jsonStr(content.challenger),
    agentGroupId: session.agent_group_id,
    sessionId: session.id,
    threadId: session.thread_id,
    // The container stamps ts (it has no Date.now ban); the store normalizes
    // it and falls back to arrival time when it is unusable.
    decidedAt: str(content.ts) ?? new Date().toISOString(),
  });

  // Tell the agent what happened on every non-success branch. A refusal it
  // cannot see is a refusal it will retry forever.
  if (outcome.status === 'invalid') {
    await notifyAgent(session, `record_decision rejected: ${outcome.reason}`);
  } else if (outcome.status === 'conflict') {
    await notifyAgent(
      session,
      `record_decision refused: a decision for this commit is already recorded (${outcome.existingDecision}). ` +
        'The ledger is append-only — record a decision for the new head instead of restating this one.',
    );
  }
}

registerDeliveryAction('record_decision', applyRecordDecision, {
  guardAction: approvalLedgerRecordDecision,
  precheck: validateRecordDecision,
  onDeny: (_content, session, reason) => notifyAgent(session, `record_decision denied: ${reason}`),
});

registerDeliveryAction(
  'record_human_verdict',
  async (_content: Record<string, unknown>, _session: Session) => {
    // Unreachable: the guard denies unconditionally. Present so the registry
    // entry is a real guarded action rather than a special case.
    log.error('record_human_verdict handler reached — the guard should have denied it');
  },
  {
    guardAction: approvalLedgerRecordHumanVerdict,
    onDeny: (_content, session, reason) => notifyAgent(session, `record_human_verdict denied: ${reason}`),
  },
);
