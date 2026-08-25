/**
 * Container restart delivery action.
 *
 * When a container (or the orchestrator via agent-to-agent) sends a system
 * message with `action: 'request_restart'`, the host kills the container and
 * writes a follow-up message so the sweep respawns it with a fresh CLAUDE.md.
 */
import { killContainer, wakeContainer } from '../../container-runner.js';
import { getSession } from '../../db/sessions.js';
import { log } from '../../log.js';
import { writeSessionMessage } from '../../session-manager.js';
import type { DeliveryActionHandler } from '../../delivery.js';

export const handleRequestRestart: DeliveryActionHandler = async (content, session) => {
  const reason = (content.reason as string) || 'restart requested';
  log.info('Container restart requested', { sessionId: session.id, reason });

  // Write the follow-up with onWake:1 BEFORE killing, then respawn via the
  // kill's onExit callback — the pattern proven in self-mod/apply.ts. onWake:1
  // means only the FRESH container's first poll picks it up, so the dying
  // container (still inside its SIGTERM grace window) can't consume its own
  // restart message. The prior code fired killContainer unawaited (no onExit)
  // and relied on a 5s processAfter delay, which loses the race whenever the
  // grace period exceeds 5s.
  await writeSessionMessage(session.agent_group_id, session.id, {
    id: `restart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: 'chat',
    timestamp: new Date().toISOString(),
    // System notification — channelType='system' / platformId=null so
    // the formatter renders <system-notification> and the routing layer
    // can never resolve self as an a2a destination.
    platformId: null,
    channelType: 'system',
    threadId: session.thread_id,
    content: JSON.stringify({
      text: `Container restarted: ${reason}. Continue your current task.`,
      sender: 'system',
      senderId: 'system',
    }),
    onWake: true,
  });

  killContainer(session.id, `request_restart: ${reason}`, () => {
    void getSession(session.id).then((s) => {
      if (s) return wakeContainer(s);
    });
  });
};
