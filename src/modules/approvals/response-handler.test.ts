/**
 * AP03 regression: handleApprovalsResponse must return promptly even when
 * wakeContainer (which it fires post-state-transition) is slow. Before the
 * fix it awaited wakeContainer inline, so a container-spawn-bound wake
 * caused the dashboard's 5s fetch timeout to fire while the approval had
 * already been applied — client saw 500 on a successful action.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let slowResolve: () => void = () => {};
let wakeContainerMock: (...args: unknown[]) => Promise<void>;

vi.mock('../../container-runner.js', () => ({
  wakeContainer: (...args: unknown[]) => wakeContainerMock(...args),
}));

vi.mock('../../db/sessions.js', () => ({
  getPendingApproval: vi.fn(),
  deletePendingApproval: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../session-manager.js', () => ({
  writeSessionMessage: vi.fn(),
}));

vi.mock('./primitive.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('./primitive.js');
  return {
    ...actual,
    getApprovalHandler: vi.fn(),
    pickApprover: vi.fn(() => []),
  };
});

vi.mock('./onecli-approvals.js', () => ({
  ONECLI_ACTION: 'onecli_credential',
  resolveOneCLIApproval: vi.fn(() => false),
}));

describe('AP03: handleApprovalsResponse does not block on wakeContainer', () => {
  let wakeCalls = 0;
  beforeEach(() => {
    wakeCalls = 0;
    wakeContainerMock = () => {
      wakeCalls++;
      return new Promise<void>((resolve) => {
        slowResolve = resolve;
      });
    };
  });

  afterEach(() => {
    slowResolve();
    vi.clearAllMocks();
  });

  it('Approve path returns within 200ms even when wakeContainer hangs', async () => {
    const { handleApprovalsResponse } = await import('./response-handler.js');
    const sessionsMod = (await import('../../db/sessions.js')) as unknown as {
      getPendingApproval: ReturnType<typeof vi.fn>;
      deletePendingApproval: ReturnType<typeof vi.fn>;
      getSession: ReturnType<typeof vi.fn>;
    };
    const primitiveMod = (await import('./primitive.js')) as unknown as {
      getApprovalHandler: ReturnType<typeof vi.fn>;
    };

    sessionsMod.getPendingApproval.mockReturnValue({
      approval_id: 'a1',
      session_id: 'sess-1',
      agent_group_id: 'ag-1',
      action: 'install_packages',
      payload: '{"pkg":"cowsay"}',
      created_at: new Date().toISOString(),
      status: 'pending',
      channel_type: null,
      platform_id: null,
      platform_message_id: null,
      expires_at: null,
      title: 't',
      options_json: '[]',
    });
    sessionsMod.getSession.mockReturnValue({
      id: 'sess-1',
      agent_group_id: 'ag-1',
      messaging_group_id: null,
      thread_id: null,
      status: 'active',
      container_status: 'idle',
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
      agent_provider: 'claude',
    });
    primitiveMod.getApprovalHandler.mockReturnValue(async () => {
      /* instant handler */
    });

    const started = Date.now();
    await handleApprovalsResponse({
      questionId: 'a1',
      value: 'approve',
      userId: 'dashboard-admin',
      channelType: 'dashboard',
      platformId: 'dashboard',
      threadId: null,
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(200);
    expect(wakeCalls).toBe(1);
    expect(sessionsMod.deletePendingApproval).toHaveBeenCalledWith('a1');
  });

  it('Reject path also fire-and-forgets the wake', async () => {
    const { handleApprovalsResponse } = await import('./response-handler.js');
    const sessionsMod = (await import('../../db/sessions.js')) as unknown as {
      getPendingApproval: ReturnType<typeof vi.fn>;
      deletePendingApproval: ReturnType<typeof vi.fn>;
      getSession: ReturnType<typeof vi.fn>;
    };

    sessionsMod.getPendingApproval.mockReturnValue({
      approval_id: 'a2',
      session_id: 'sess-2',
      agent_group_id: 'ag-1',
      action: 'install_packages',
      payload: '{}',
      created_at: new Date().toISOString(),
      status: 'pending',
      channel_type: null,
      platform_id: null,
      platform_message_id: null,
      expires_at: null,
      title: 't',
      options_json: '[]',
    });
    sessionsMod.getSession.mockReturnValue({
      id: 'sess-2',
      agent_group_id: 'ag-1',
      messaging_group_id: null,
      thread_id: null,
      status: 'active',
      container_status: 'idle',
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
      agent_provider: 'claude',
    });

    const started = Date.now();
    await handleApprovalsResponse({
      questionId: 'a2',
      value: 'reject',
      userId: 'dashboard-admin',
      channelType: 'dashboard',
      platformId: 'dashboard',
      threadId: null,
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(200);
    expect(wakeCalls).toBe(1);
    expect(sessionsMod.deletePendingApproval).toHaveBeenCalledWith('a2');
  });
});
