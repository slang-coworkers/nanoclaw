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
import type { RunawayCardDeps, RunawayMetrics } from './detect.js';

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
  async emitCard(session: Session, metrics: RunawayMetrics, windowS: number): Promise<void> {
    const mins = Math.round(windowS / 60);
    await requestApproval({
      session,
      agentName: session.agent_group_id,
      action: STOP_ACTION,
      payload: { sessionId: session.id, turns: metrics.turns, outputBytes: metrics.outputBytes },
      title: 'Possible runaway session',
      question:
        `Session ${session.id} (${session.agent_group_id}) looks like a runaway: ` +
        `${metrics.turns} turns in ~${mins} min producing ~${metrics.outputBytes} bytes of output. ` +
        `Approve to STOP it, or Reject to let it keep running.`,
    });
  },
};
