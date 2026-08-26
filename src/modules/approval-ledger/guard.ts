/**
 * Approval-ledger guard adapter — the module's catalog entries, composed at
 * the module edge (imported by ./index.ts).
 *
 * Both entries are DENY-or-ALLOW; neither carries a `grantActionName`, so
 * neither can ever be held. That is the point. A card reading "may this
 * container write an approval outcome for a PR it was never given?" has no
 * good answer: a human clicking yes cannot verify the claim, and the ledger's
 * whole value is that its rows were produced by the gated approver run. An
 * action that must not happen is refused, not escalated.
 *
 * approval_ledger.record_decision — the caller's agent group must hold the
 * ledger-writer capability (APPROVAL_LEDGER_WRITERS, resolved through
 * ./capability.ts). Before this existed, "approver-only" was a sentence in the
 * MCP tool's description and nothing else: `record_decision` is registered in
 * the CORE MCP server handed to EVERY container, so any agent — compromised,
 * prompt-injected, or merely confused about which tool it wanted — could
 * append rows claiming any repository, PR number, commit and verdict, and
 * (under the old INSERT OR REPLACE) overwrite a real decision with a
 * fabricated one. The rows feed the author-vs-approver calibration
 * dashboards humans read to decide how much to trust the bots, so a forged
 * row does not just add noise: it moves the number that governs the trust.
 *
 * approval_ledger.record_human_verdict — denied from every container,
 * unconditionally. The human outcome is not the agent's to report. The host
 * already stamps it deterministically from the GitHub webhook
 * (notifyApproverOfTerminalPr in webhook-github.ts, keyed by the delivery id),
 * which is the only path that has actually observed the human. The delivery
 * action stays registered so an older container image that still emits the
 * system action is answered with a reason rather than silently dropped as an
 * "Unknown system action".
 */
import { DENY, ALLOW, defineGuardedAction, type GuardInput } from '../../guard/index.js';
import { isApprovalLedgerWriter } from './capability.js';

export const approvalLedgerRecordDecision = defineGuardedAction({
  action: 'approval_ledger.record_decision',
  decide: async (input: GuardInput) => {
    if (input.actor.kind !== 'agent') {
      return DENY('record_decision is a container-originated action');
    }
    const check = await isApprovalLedgerWriter(input.actor.agentGroupId);
    if (!check.allowed) return DENY(check.reason);
    return ALLOW(check.reason);
  },
});

export const approvalLedgerRecordHumanVerdict = defineGuardedAction({
  action: 'approval_ledger.record_human_verdict',
  decide: () =>
    DENY(
      'human verdicts are stamped only by the trusted GitHub ingestion path, keyed by the webhook delivery id — an agent cannot report a human outcome about itself',
    ),
});
