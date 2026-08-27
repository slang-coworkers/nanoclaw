/**
 * Runaway module wiring.
 *
 * Registers the `stop_runaway_session` approval handler and exposes the
 * `emitRunawayCard` deps the host sweep passes to `checkRunaway`.
 *
 * The card is a normal two-button approval (Approve / Reject). We map:
 *   - Approve → STOP the session (kill + close so it doesn't respawn).
 *   - Reject  → IGNORE (the response-handler just drops the row; the session
 *               keeps running, and detect.ts re-arms so a later distinct
 *               episode can card again).
 *
 * NOTHING here ever stops a session on its own — only the admin's Approve does.
 */
import { killContainer } from '../../container-runner.js';
import { updateSession } from '../../db/sessions.js';
import { log } from '../../log.js';
import type { Session } from '../../types.js';
import { registerApprovalHandler, requestApproval } from '../approvals/index.js';
import type { RunawayCardDeps, RunawayCost, RunawayMetrics } from './detect.js';

const STOP_ACTION = 'stop_runaway_session';

/**
 * Admin clicked Stop (Approve). Kill the container and CLOSE the session so the
 * 60s sweep (which only iterates status='active') stops waking it, and so the
 * defensive guard in wakeContainer refuses any straggling wake — including the
 * fireAndForgetWake the approval response-handler fires right after this. We do
 * NOT call ctx.notify(): notify wakes the container, which would defeat Stop.
 */
registerApprovalHandler(STOP_ACTION, async (ctx) => {
  const sessionId = (ctx.payload.sessionId as string) || ctx.session.id;
  log.warn('Runaway card: admin chose Stop — killing + closing session', {
    sessionId,
    approvedBy: ctx.userId,
  });
  updateSession(sessionId, { status: 'closed', container_status: 'stopped' });
  killContainer(sessionId, 'runaway-stopped-by-admin');
});

/** Deps for detect.ts → emits the admin card via the standard approval flow. */
export const runawayCardDeps: RunawayCardDeps = {
  async emitCard(session: Session, metrics: RunawayMetrics, windowS: number, cost: RunawayCost | null): Promise<void> {
    const mins = Math.round(windowS / 60);
    // Cost is the single most decision-relevant number here (a runaway's whole
    // harm is spend). Carry it on the payload so the dashboard card can show
    // "$spent of $cap", and inline it in the question so the DM/chat surface
    // reads the same. Both stay absent when cost tracking is off — the card is
    // then byte-for-byte what it was before (back-compat).
    const costLine = cost ? ` It has spent $${cost.spentUsd.toFixed(2)} of its $${cost.capUsd.toFixed(2)} cap.` : '';
    await requestApproval({
      session,
      agentName: session.agent_group_id,
      action: STOP_ACTION,
      payload: {
        sessionId: session.id,
        turns: metrics.turns,
        outputBytes: metrics.outputBytes,
        // Round to cents-plus so the dashboard and DM print identical figures.
        ...(cost ? { spentUsd: Number(cost.spentUsd.toFixed(4)), capUsd: Number(cost.capUsd.toFixed(4)) } : {}),
      },
      title: 'Possible runaway session',
      question:
        `Session ${session.id} (${session.agent_group_id}) looks like a runaway: ` +
        `${metrics.turns} turns in ~${mins} min producing ~${metrics.outputBytes} bytes of output.` +
        `${costLine} ` +
        `Approve to STOP it, or Reject to let it keep running.`,
    });
  },
};
