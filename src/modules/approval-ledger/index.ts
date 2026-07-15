/**
 * Approval-decision ledger module.
 *
 * The PR-approver coworker ("Verity") emits a `record_decision` system action
 * after its critique-gated decision; this handler records it in the central
 * DB's approval_decisions table. Container agents can't write v2.db directly —
 * this is the host side of the same two-DB transport that pr-mapping's
 * `map_pr_session` uses.
 *
 * A second action, `record_human_verdict`, stamps the human outcome onto an
 * existing decision row (the join for scoring) — emitted when the approver
 * sees a `github.pr_review` on a PR it decided, or replays offline ground
 * truth. See ./store.ts.
 */
import { getDb } from '../../db/connection.js';
import { registerDeliveryAction } from '../../delivery.js';
import { unguarded } from '../../guard/index.js';
import { log } from '../../log.js';
import type { Session } from '../../types.js';
import { isValidDecision, recordHumanVerdict, upsertDecision } from './store.js';

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

registerDeliveryAction(
  'record_decision',
  async (content: Record<string, unknown>, session: Session) => {
    const repo = str(content.repo);
    const prNumber = typeof content.pr_number === 'number' ? content.pr_number : Number(content.pr_number);
    const commitSha = str(content.commit_sha);
    const decision = str(content.decision);

    if (!repo || !Number.isFinite(prNumber) || !commitSha || !decision) {
      log.warn('record_decision: missing repo/pr_number/commit_sha/decision', { content });
      return;
    }
    if (!isValidDecision(decision)) {
      log.warn('record_decision: invalid decision state (dropped)', { decision, repo, pr: prNumber });
      return;
    }

    upsertDecision(getDb(), {
      repo,
      prNumber,
      commitSha,
      mode: str(content.mode) ?? 'unknown',
      decision,
      reasonCode: str(content.reason_code),
      reviewDiffHash: str(content.review_diff_hash),
      policyVersion: str(content.policy_version),
      clausesJson: jsonStr(content.clauses),
      challengerJson: jsonStr(content.challenger),
      agentGroupId: session.agent_group_id,
      sessionId: session.id,
      threadId: session.thread_id,
      // The container stamps ts (it has no Date.now ban); fall back to the row's
      // own arrival if absent. Kept as the container-reported decision time.
      decidedAt: str(content.ts) ?? new Date().toISOString(),
    });
  },
  unguarded('record_decision appends to the approval-decision ledger — audit record, not a privileged mutation'),
);

registerDeliveryAction(
  'record_human_verdict',
  async (content: Record<string, unknown>, _session: Session) => {
    const repo = str(content.repo);
    const prNumber = typeof content.pr_number === 'number' ? content.pr_number : Number(content.pr_number);
    const commitSha = str(content.commit_sha);
    const humanVerdict = str(content.human_verdict);

    if (!repo || !Number.isFinite(prNumber) || !commitSha || !humanVerdict) {
      log.warn('record_human_verdict: missing repo/pr_number/commit_sha/human_verdict', { content });
      return;
    }
    const joined = recordHumanVerdict(getDb(), repo, prNumber, commitSha, humanVerdict);
    if (!joined) {
      log.info('record_human_verdict: no decision row to join (human review preceded a Verity decision)', {
        repo,
        pr: prNumber,
        commit: commitSha.slice(0, 12),
      });
    }
  },
  unguarded('record_human_verdict stamps the human review outcome onto an existing ledger row — audit record'),
);
