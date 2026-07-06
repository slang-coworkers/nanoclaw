/**
 * Critique-gate escalation module — graduated enforcement for the critique
 * delivery gate (deny ×3 → human approval instead of silent fail-open).
 *
 * After the in-container gate hits its denial cap it writes an escalation
 * request file into the session's `.claude/` dir (host-visible: /workspace is
 * the session-dir mount) and keeps denying. The host sweep calls
 * `checkCritiqueEscalation` per active session, which turns a fresh request
 * file into a standard admin approval card:
 *
 *   - Approve → `critique_gate_bypass_approved: true` in workflow-state.json;
 *     the gate allows the next delivery attempt. Agent is notified (+woken).
 *   - Reject  → `critique_gate_bypass_rejected: true`; the gate keeps denying
 *     and stops re-escalating. Agent is told to comply or report the blocker.
 *
 * The in-container gate keeps a timeout backstop
 * (CRITIQUE_ESCALATION_TIMEOUT_SECS, default 30 min): if no decision lands it
 * fails open with a loud warning — a broken approval path must not wedge the
 * agent forever, which was the original anti-thrash contract of the soft cap.
 *
 * Registered in src/modules/index.ts so the approval handler is bound even
 * after a host restart with a pending card.
 */
import fs from 'fs';
import path from 'path';

import { log } from '../../log.js';
import { sessionDir } from '../../session-manager.js';
import type { Session } from '../../types.js';
import {
  notifyAgent,
  registerApprovalHandler,
  registerApprovalResolvedHandler,
  requestApproval,
} from '../approvals/index.js';

const BYPASS_ACTION = 'critique_gate_bypass';

/** The session's `.claude/` dir on the host. Overridable for tests. */
function claudeDir(session: Session, dirOverride?: string): string {
  return dirOverride ?? path.join(sessionDir(session.agent_group_id, session.id), '.claude');
}

/** Merge keys into the session's workflow-state.json (tmp+rename). */
export function patchWorkflowState(session: Session, patch: Record<string, unknown>, dirOverride?: string): void {
  const file = path.join(claudeDir(session, dirOverride), 'workflow-state.json');
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    state = {};
  }
  Object.assign(state, patch);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, file);
}

function patchEscalationFile(session: Session, patch: Record<string, unknown>, dirOverride?: string): void {
  const file = path.join(claudeDir(session, dirOverride), 'critique-escalation.json');
  try {
    const esc = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
    Object.assign(esc, patch);
    fs.writeFileSync(file, JSON.stringify(esc));
  } catch {
    // No escalation file to mark — nothing to do.
  }
}

/** Admin approved the bypass: unblock the gate and tell the agent. */
export function applyBypassApproval(session: Session, userId: string, dirOverride?: string): void {
  patchWorkflowState(session, { critique_gate_bypass_approved: true }, dirOverride);
  patchEscalationFile(session, { resolved: 'approved', resolved_by: userId }, dirOverride);
  log.warn('Critique-gate bypass APPROVED', { sessionId: session.id, approvedBy: userId });
}

/** Admin rejected the bypass: keep the gate closed and stop re-escalating. */
export function applyBypassRejection(session: Session, userId: string, dirOverride?: string): void {
  patchWorkflowState(session, { critique_gate_bypass_rejected: true }, dirOverride);
  patchEscalationFile(session, { resolved: 'rejected', resolved_by: userId }, dirOverride);
  log.warn('Critique-gate bypass REJECTED', { sessionId: session.id, rejectedBy: userId });
}

registerApprovalHandler(BYPASS_ACTION, async (ctx) => {
  applyBypassApproval(ctx.session, ctx.userId);
  ctx.notify(
    'Critique-gate bypass approved by an admin — resend your delivery. The critique requirement itself is still unmet; prefer running /codex-critique when possible.',
  );
});

registerApprovalResolvedHandler((event) => {
  if (event.approval.action !== BYPASS_ACTION || event.outcome !== 'reject') return;
  applyBypassRejection(event.session, event.userId);
  notifyAgent(
    event.session,
    'Critique-gate bypass request was REJECTED by an admin. Satisfy the critique requirement (/codex-critique) or report the blocker to your parent — do not retry the delivery.',
  );
});

/**
 * Sweep hook: turn a fresh escalation request file into an admin approval
 * card. Idempotent — `forwarded_at` marks the file so each request cards
 * exactly once; resolved requests are left alone.
 */
export async function checkCritiqueEscalation(session: Session, dirOverride?: string): Promise<void> {
  const file = path.join(claudeDir(session, dirOverride), 'critique-escalation.json');
  let esc: Record<string, unknown>;
  try {
    esc = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    return; // No pending escalation.
  }
  if (esc.forwarded_at || esc.resolved) return;

  const reason = typeof esc.reason === 'string' ? esc.reason : 'unspecified';
  const hit = typeof esc.hit === 'string' ? esc.hit : 'delivery';
  await requestApproval({
    session,
    agentName: session.agent_group_id,
    action: BYPASS_ACTION,
    payload: { sessionId: session.id, reason, hit },
    title: 'Critique gate stuck — bypass requested',
    question:
      `Session ${session.id} (${session.agent_group_id}) hit the critique-gate denial cap trying to send a ${hit}. ` +
      `Unmet requirement: ${reason}. ` +
      `Approve to let the delivery through WITHOUT the required critique; Reject to keep it blocked.`,
  });
  patchEscalationFile(session, { forwarded_at: new Date().toISOString() }, dirOverride);
  log.info('Critique-gate escalation carded', { sessionId: session.id, reason });
}
