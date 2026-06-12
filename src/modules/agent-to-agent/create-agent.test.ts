/**
 * Tests for create_agent host-side authorization.
 *
 * Regression guard for the audit finding: `create_agent` is a privileged
 * central-DB write with no host-side authz. The fix authorizes by CLI scope —
 * trusted owner agent groups ('global') create directly; confined groups
 * ('group', the default and the prompt-injection victim) must get admin
 * approval. These tests pin that branch decision.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../../types.js';

// performCreateAgent writes .instructions.md directly under GROUPS_DIR/<folder>,
// so point GROUPS_DIR at a temp dir (lazy getter — read at call time, after the
// beforeEach sets _tmp). Mirrors the agent-route.test.ts config mock pattern.
let _tmp = '';
vi.mock('../../config.js', () => ({
  get GROUPS_DIR() {
    return path.join(_tmp, 'groups');
  },
  get DATA_DIR() {
    return path.join(_tmp, 'data');
  },
}));

// Mocks for the collaborators the branch decides between / depends on.
const mockRequestApproval = vi.fn().mockResolvedValue(undefined);
const mockGetContainerConfig = vi.fn();
const mockCreateAgentGroup = vi.fn();
const mockInitGroupFilesystem = vi.fn();
const mockWriteDestinations = vi.fn();
const mockNotifyWrite = vi.fn();

vi.mock('../approvals/index.js', () => ({
  requestApproval: (...a: unknown[]) => mockRequestApproval(...a),
}));
vi.mock('../../db/container-configs.js', () => ({
  getContainerConfig: (...a: unknown[]) => mockGetContainerConfig(...a),
}));
vi.mock('../../db/agent-groups.js', () => ({
  getAgentGroup: (id: string) => ({ id, name: id.toUpperCase(), folder: id, agent_provider: null, created_at: '' }),
  getAgentGroupByFolder: () => undefined,
  createAgentGroup: (...a: unknown[]) => mockCreateAgentGroup(...a),
}));
vi.mock('../../group-init.js', () => ({
  initGroupFilesystem: (...a: unknown[]) => mockInitGroupFilesystem(...a),
}));
vi.mock('./write-destinations.js', () => ({
  writeDestinations: (...a: unknown[]) => mockWriteDestinations(...a),
}));
vi.mock('./db/agent-destinations.js', () => ({
  getDestinationByName: () => undefined,
  createDestination: vi.fn(),
  normalizeName: (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));
// notifyAgent writes to the session inbound.db + wakes the container; stub both.
vi.mock('../../session-manager.js', () => ({
  writeSessionMessage: (...a: unknown[]) => mockNotifyWrite(...a),
}));
vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../db/sessions.js', () => ({
  getSession: (id: string) => ({ id, agent_group_id: 'ag-1' }),
}));
// performCreateAgent wires the new coworker's own dashboard channel; stub the
// messaging-groups DB layer so it doesn't reach the (uninitialized) real DB.
vi.mock('../../db/messaging-groups.js', () => ({
  getMessagingGroupByPlatform: () => undefined,
  createMessagingGroup: vi.fn(),
  getMessagingGroupAgents: () => [],
  createMessagingGroupAgent: vi.fn(),
}));
// performCreateAgent dynamically imports the host entry point to refresh adapter
// conversations; stub it so the test never loads the real process graph.
vi.mock('../../index.js', () => ({
  refreshAdapterConversations: vi.fn(),
}));

import { handleCreateAgent } from './create-agent.js';

const SESSION = { id: 'sess-1', agent_group_id: 'ag-1' } as Session;

beforeEach(() => {
  vi.clearAllMocks();
  _tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'create-agent-test-'));
  fs.mkdirSync(path.join(_tmp, 'groups'), { recursive: true });
  // The real initGroupFilesystem creates GROUPS_DIR/<folder>; mirror that so the
  // subsequent direct .instructions.md write in performCreateAgent finds the dir.
  mockInitGroupFilesystem.mockImplementation((group: { folder: string }) => {
    fs.mkdirSync(path.join(_tmp, 'groups', group.folder), { recursive: true });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (_tmp) fs.rmSync(_tmp, { recursive: true, force: true });
});

describe('handleCreateAgent — scope-based authorization', () => {
  it('global scope: creates directly, no approval requested', async () => {
    mockGetContainerConfig.mockReturnValue({ cli_scope: 'global' });

    await handleCreateAgent({ name: 'Scout', instructions: 'help' }, SESSION);

    expect(mockRequestApproval).not.toHaveBeenCalled();
    expect(mockCreateAgentGroup).toHaveBeenCalledTimes(1);
    expect(mockInitGroupFilesystem).toHaveBeenCalledTimes(1);
  });

  it('group scope (default): requires approval, does NOT create directly', async () => {
    mockGetContainerConfig.mockReturnValue({ cli_scope: 'group' });

    await handleCreateAgent({ name: 'Scout', instructions: 'help' }, SESSION);

    expect(mockRequestApproval).toHaveBeenCalledTimes(1);
    expect(mockRequestApproval.mock.calls[0][0]).toMatchObject({ action: 'create_agent' });
    expect(mockCreateAgentGroup).not.toHaveBeenCalled();
    expect(mockInitGroupFilesystem).not.toHaveBeenCalled();
  });

  it('missing config: fails closed to approval (no direct create)', async () => {
    mockGetContainerConfig.mockReturnValue(undefined);

    await handleCreateAgent({ name: 'Scout' }, SESSION);

    expect(mockRequestApproval).toHaveBeenCalledTimes(1);
    expect(mockCreateAgentGroup).not.toHaveBeenCalled();
  });

  it('disabled/other scope: requires approval', async () => {
    mockGetContainerConfig.mockReturnValue({ cli_scope: 'disabled' });

    await handleCreateAgent({ name: 'Scout' }, SESSION);

    expect(mockRequestApproval).toHaveBeenCalledTimes(1);
    expect(mockCreateAgentGroup).not.toHaveBeenCalled();
  });

  it('empty name: neither creates nor requests approval', async () => {
    mockGetContainerConfig.mockReturnValue({ cli_scope: 'global' });

    await handleCreateAgent({ name: '' }, SESSION);

    expect(mockRequestApproval).not.toHaveBeenCalled();
    expect(mockCreateAgentGroup).not.toHaveBeenCalled();
  });
});
