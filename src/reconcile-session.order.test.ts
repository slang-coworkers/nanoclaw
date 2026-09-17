/**
 * The a2a bounce redrive must run BEFORE the due-message wake, and only while
 * the container is down.
 *
 * This ordering is load-bearing and it is exactly what a code move can silently
 * break: a `bounced-*` processing_ack hides a still-`pending` message from the
 * container's poll, and the container's own startup cleanup only clears
 * status='processing' — so only this path can reclaim it. Put the redrive after
 * the wake and it becomes unreachable in every state: container up, the !alive
 * gate skips it; container down, the wake sees the hidden due message, spawns,
 * and `alive` flips true before the reset path is reached. The message that
 * needs healing is what arms the wake that suppresses the healing. Observed in
 * production 2026-07-17..08-04 as a task frozen 18 days behind one
 * bounced-transient ack.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const order: string[] = [];
let containerRunning = false;

vi.mock('./db/sessions.js', () => ({
  getSession: vi.fn(async () => ({
    id: 's-1',
    agent_group_id: 'ag-1',
    thread_id: null,
    status: 'active',
  })),
  isTaskThread: () => false,
  updateSession: vi.fn(),
}));
vi.mock('./db/agent-groups.js', () => ({ getAgentGroup: vi.fn(async () => ({ id: 'ag-1' })) }));
vi.mock('./db/coordination.js', () => ({ getSessionClaim: vi.fn(async () => undefined) }));
vi.mock('./db/a2a-session-sources.js', () => ({ getSourceFor: vi.fn(async () => undefined) }));

vi.mock('./container-runner.js', () => ({
  claudeMdStaleForSession: vi.fn(async () => null),
  getContainerStartedAtMs: vi.fn(() => 0),
  isContainerRunning: vi.fn(() => containerRunning),
  killContainer: vi.fn(),
  recomposeAndUpdateHash: vi.fn(),
}));

vi.mock('./request-wake.js', () => ({
  requestWake: vi.fn(async () => {
    order.push('wake');
    // A real wake spawns a container: everything after this point sees it alive,
    // which is precisely why the redrive cannot live downstream of it.
    containerRunning = true;
    return true;
  }),
}));

vi.mock('./session-manager.js', () => ({
  heartbeatPath: () => '/nonexistent/heartbeat',
  openInboundDb: vi.fn(() => {
    order.push('redrive:open-inbound');
    return { close: vi.fn() };
  }),
  openOutboundDb: vi.fn(() => ({ close: vi.fn() })),
  openOutboundDbRw: vi.fn(() => ({ close: vi.fn() })),
  withExistingMailboxSession: vi.fn(async (_ag: string, _sid: string, fn: (mailbox: unknown) => Promise<boolean>) => {
    order.push('mailbox');
    return fn({
      applyProcessingAcks: vi.fn(),
      getTerminalProcessingAcks: vi.fn(() => []),
      // One message is due — this is what arms the wake.
      countDueMessages: vi.fn(() => 1),
      getProcessingClaims: vi.fn(() => []),
      getContainerState: vi.fn(() => null),
      getMessageForRetry: vi.fn(() => undefined),
      markMessageFailed: vi.fn(),
      retryWithBackoff: vi.fn(),
      deleteOrphanProcessingClaims: vi.fn(() => 0),
      countLiveTasks: vi.fn(() => 0),
    });
  }),
  writeSessionMessage: vi.fn(),
}));

vi.mock('./mailbox/sqlite/session-db.js', () => ({
  deleteBouncedClaims: vi.fn(() => 0),
  getBouncedClaims: vi.fn(() => []),
  getBouncedTriggerRow: vi.fn(() => undefined),
  markMessageFailed: vi.fn(),
  retryWithBackoff: vi.fn(),
}));

vi.mock('./modules/runaway/detect.js', () => ({ checkRunaway: vi.fn() }));
vi.mock('./modules/runaway/index.js', () => ({ runawayCardDeps: {} }));
vi.mock('./modules/critique-escalation/index.js', () => ({ checkCritiqueEscalation: vi.fn() }));
vi.mock('./modules/scheduling/recurrence.js', () => ({ handleRecurrence: vi.fn() }));
vi.mock('./modules/cross-session-context/index.js', () => ({ pruneEchoBacklog: vi.fn(() => 0) }));

import { reconcileSession } from './reconcile-session.js';

describe('reconcileSession duty ordering', () => {
  beforeEach(() => {
    order.length = 0;
    containerRunning = false;
  });

  it('reclaims bounced a2a claims BEFORE the due-message wake', async () => {
    await reconcileSession('s-1');

    const redrive = order.indexOf('redrive:open-inbound');
    const wake = order.indexOf('wake');

    expect(redrive, 'redrive must run — a dead container is its only window').toBeGreaterThanOrEqual(0);
    expect(wake, 'a due message must still arm the wake').toBeGreaterThanOrEqual(0);
    expect(redrive).toBeLessThan(wake);
  });

  it('skips the redrive entirely while the container is alive (single-writer gate)', async () => {
    containerRunning = true;
    await reconcileSession('s-1');

    // The redrive DELETEs from outbound.db; exactly-one-writer per file is what
    // makes the two-DB split safe, so a live container must lock it out.
    expect(order).not.toContain('redrive:open-inbound');
  });
});
