/**
 * Handle an admin's response to an approval card.
 *
 * Two categories of pending_approvals rows exist:
 *   1. Module-initiated actions — the module called `requestApproval()` with
 *      some free-form `action` string and registered a handler via
 *      `registerApprovalHandler(action, handler)`. On approve, we look up the
 *      handler and call it; on plain reject we relay a decline to the agent; on
 *      "Reject with reason…" we hold the row and capture the admin's next DM as
 *      a one-line reason (see reason-capture.ts). Reject finalization is shared
 *      via finalizeReject.
 *   2. OneCLI credential approvals (`action = 'onecli_credential'`). Resolved
 *      via an in-memory Promise — see onecli-approvals.ts.
 *
 * The response handler is registered via core's `registerResponseHandler`;
 * core iterates handlers and the first one to return `true` claims the response.
 */
import { requestWake } from '../../request-wake.js';
import {
  deletePendingApproval,
  getPendingApproval,
  getSession,
  transitionPendingApprovalStatus,
} from '../../db/sessions.js';
import type { ResponsePayload } from '../../response-registry.js';
import { log } from '../../log.js';
import { writeSessionMessage } from '../../session-manager.js';
import type { PendingApproval } from '../../types.js';
import { hasAdminPrivilege, isGlobalAdmin, isOwner } from '../permissions/db/user-roles.js';
import { finalizeReject } from './finalize.js';
import { ONECLI_ACTION, resolveOneCLIApproval } from './onecli-approvals.js';
import { getApprovalHandler, notifyApprovalResolved, REJECT_WITH_REASON_VALUE } from './primitive.js';
import { armReasonCapture } from './reason-capture.js';

// fork override (nv): sentinels for responses originating from the local
// dashboard or CLI rather than a messaging-platform user. They bypass the
// role-based approver check because they're already gated by dashboard auth /
// host-local access. Without this, dashboard-admin cannot authorize.
const LOCAL_APPROVER_SENDERS = new Set(['dashboard-admin', 'cli-admin', 'system']);

/**
 * fork override (nv): AP03 — fire the wake without blocking the caller.
 * Approval acceptance is a fast DB transition; the subsequent wake can take
 * seconds-to-tens-of-seconds (image pull, migration check, MCP discovery).
 * Blocking the HTTP chain on it caused the dashboard's 5s AbortSignal to fire
 * and return a 500 even though the approval had already been applied. Errors
 * are logged (never swallowed); the approval is already settled in the DB.
 */
function fireAndForgetWake(session: Parameters<typeof requestWake>[0], approvalId: string): void {
  void requestWake(session, 'approval-response').catch((err) => {
    log.warn('Post-approval wake failed — state is already settled', {
      approvalId,
      sessionId: session.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });
}

export async function handleApprovalsResponse(payload: ResponsePayload): Promise<boolean> {
  const approval = await getPendingApproval(payload.questionId);
  if (!approval) return false;

  if (!(await isAuthorizedApprovalClick(approval, payload))) {
    log.warn('Ignoring unauthorized approval response', {
      approvalId: approval.approval_id,
      action: approval.action,
      userId: payload.userId,
      channelType: payload.channelType,
    });
    return true;
  }

  if (approval.action === ONECLI_ACTION) {
    if (await resolveOneCLIApproval(payload.questionId, payload.value)) {
      return true;
    }
    // Row exists but the in-memory resolver is gone (timer fired or the process
    // was in a weird state). Nothing to do — just drop the row.
    await deletePendingApproval(payload.questionId);
    return true;
  }

  await handleRegisteredApproval(approval, payload.value, namespacedUserId(payload) ?? '');
  return true;
}

async function handleRegisteredApproval(
  approval: PendingApproval,
  selectedOption: string,
  userId: string,
): Promise<void> {
  if (!approval.session_id) {
    await deletePendingApproval(approval.approval_id);
    return;
  }
  const session = await getSession(approval.session_id);
  if (!session) {
    await deletePendingApproval(approval.approval_id);
    return;
  }

  // "Reject with reason…" — hold the row and capture the admin's next DM
  // instead of finalizing now. The agent is notified exactly once: after the
  // reason arrives, or after the sweep's timeout if the admin ghosts.
  if (selectedOption === REJECT_WITH_REASON_VALUE) {
    await armReasonCapture(approval, session, userId);
    return;
  }

  // Plain Reject (or any other non-approve value) — instant fast path.
  if (selectedOption.toLowerCase() !== 'approve') {
    await finalizeReject(approval, session, userId);
    return;
  }

  if (!(await transitionPendingApprovalStatus(approval.approval_id, 'pending', 'approved'))) return;

  // Approved — dispatch to the module that registered for this action.
  const notify = (text: string): Promise<void> =>
    writeSessionMessage(session.agent_group_id, session.id, {
      id: `appr-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'chat',
      timestamp: new Date().toISOString(),
      // fork override (nv): channelType='system' / platformId=null so the
      // formatter renders <system-notification> and the routing layer can never
      // resolve self as an a2a destination.
      platformId: null,
      channelType: 'system',
      threadId: null,
      content: JSON.stringify({ text, sender: 'system', senderId: 'system' }),
    });

  const handler = getApprovalHandler(approval.action);
  if (!handler) {
    log.warn('No approval handler registered — row dropped', {
      approvalId: approval.approval_id,
      action: approval.action,
    });
    await notify(`Your ${approval.action} was approved, but no handler is installed to apply it.`);
    await deletePendingApproval(approval.approval_id);
    await notifyApprovalResolved({ approval, session, outcome: 'approve', userId });
    fireAndForgetWake(session, approval.approval_id); // fork override (nv): AP03
    return;
  }

  const payload = JSON.parse(approval.payload);
  try {
    await handler({ session, payload, approval, userId, notify });
    log.info('Approval handled', { approvalId: approval.approval_id, action: approval.action, userId });
  } catch (err) {
    log.error('Approval handler threw', { approvalId: approval.approval_id, action: approval.action, err });
    await notify(
      `Your ${approval.action} was approved, but applying it failed: ${err instanceof Error ? err.message : String(err)}.`,
    );
  }

  await deletePendingApproval(approval.approval_id);
  await notifyApprovalResolved({ approval, session, outcome: 'approve', userId });
  fireAndForgetWake(session, approval.approval_id); // fork override (nv): AP03
}

function namespacedUserId(payload: ResponsePayload): string | null {
  if (!payload.userId) return null;
  return payload.userId.includes(':') ? payload.userId : `${payload.channelType}:${payload.userId}`;
}

async function isAuthorizedApprovalClick(approval: PendingApproval, payload: ResponsePayload): Promise<boolean> {
  // fork override (nv): local dashboard/CLI senders are already gated by
  // dashboard auth / host-local access — bypass the role-based approver check.
  if (payload.userId && LOCAL_APPROVER_SENDERS.has(payload.userId)) return true;

  const userId = namespacedUserId(payload);
  if (!userId) return false;

  // An approval may name a specific approver; only that exact user may resolve it.
  if (approval.approver_user_id) {
    return userId === approval.approver_user_id;
  }

  const agentGroupId =
    approval.agent_group_id ?? (approval.session_id ? (await getSession(approval.session_id))?.agent_group_id : null);

  if (!agentGroupId) {
    return (await isOwner(userId)) || (await isGlobalAdmin(userId));
  }

  return hasAdminPrivilege(userId, agentGroupId);
}
