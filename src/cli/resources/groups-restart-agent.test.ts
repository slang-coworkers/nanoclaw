/**
 * `ncl groups restart` from inside a container.
 *
 * Naming its own group, an agent restarts only its calling session, with the
 * on-wake notice in that session's own mailbox. Naming another group (a
 * global-scope caller; group scope pins --id) used to take the same branch:
 * the notice went to (other group, calling session) — a mailbox under the
 * other group's folder that no reader opens — and the CALLER's container was
 * killed. Prod: an Orchestrator agent's "Resume: …" for slang-fixer sat pending
 * in v2-sessions/<slang-fixer>/<orchestrator session>/ for four months.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../container-restart.js', () => ({
  restartAgentGroupContainers: vi.fn().mockResolvedValue(2),
}));
vi.mock('../../request-wake.js', () => ({ requestWake: vi.fn() }));
vi.mock('../../session-manager.js', async () => ({
  ...(await vi.importActual('../../session-manager.js')),
  writeSessionMessage: vi.fn().mockResolvedValue(undefined),
}));

import { killContainer } from '../../container-runner.js';
import { restartAgentGroupContainers } from '../../container-restart.js';
import { writeSessionMessage } from '../../session-manager.js';
import type { CallerContext } from '../frame.js';
import { lookup } from '../registry.js';
// Side-effect import: registers the `groups-*` commands (including restart).
import './groups.js';

const caller: CallerContext = {
  caller: 'agent',
  sessionId: 'sess-orchestrator',
  agentGroupId: 'ag-main',
  messagingGroupId: 'mg-1',
};

const restart = (args: Record<string, unknown>) => lookup('groups-restart')!.handler(args, caller);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('groups restart from an agent', () => {
  it('naming its own group, restarts only the calling session with the notice in its own mailbox', async () => {
    await expect(restart({ message: 'verify the new tool' })).resolves.toEqual({ restarted: 1, rebuilt: false });

    expect(writeSessionMessage).toHaveBeenCalledExactlyOnceWith(
      'ag-main',
      'sess-orchestrator',
      expect.objectContaining({ onWake: true }),
    );
    expect(killContainer).toHaveBeenCalledWith('sess-orchestrator', 'restarted via ncl', expect.any(Function));
    expect(restartAgentGroupContainers).not.toHaveBeenCalled();
  });

  it("naming another group, restarts that group's containers and leaves the caller alone", async () => {
    await expect(restart({ id: 'ag-slang-fixer', message: 'Resume the #12092 handoff' })).resolves.toEqual({
      restarted: 2,
      rebuilt: false,
    });

    expect(restartAgentGroupContainers).toHaveBeenCalledExactlyOnceWith(
      'ag-slang-fixer',
      'restarted via ncl',
      'Resume the #12092 handoff',
    );
    expect(writeSessionMessage).not.toHaveBeenCalled();
    expect(killContainer).not.toHaveBeenCalled();
  });
});
