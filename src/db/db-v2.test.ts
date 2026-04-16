import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  initTestDb,
  closeDb,
  runMigrations,
  createAgentGroup,
  getAgentGroup,
  getAgentGroupByFolder,
  getAllAgentGroups,
  getAdminAgentGroup,
  updateAgentGroup,
  deleteAgentGroup,
  createMessagingGroup,
  getMessagingGroup,
  getMessagingGroupByPlatform,
  getAllMessagingGroups,
  updateMessagingGroup,
  deleteMessagingGroup,
  createMessagingGroupAgent,
  getMessagingGroupAgents,
  getMessagingGroupAgent,
  updateMessagingGroupAgent,
  deleteMessagingGroupAgent,
  createSession,
  getSession,
  findSession,
  getSessionsByAgentGroup,
  getActiveSessions,
  getRunningSessions,
  updateSession,
  deleteSession,
  createPendingQuestion,
  getPendingQuestion,
  deletePendingQuestion,
} from './index.js';
import { allocateDestinationName, createDestination } from './agent-destinations.js';

function now() {
  return new Date().toISOString();
}

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
});

afterEach(() => {
  closeDb();
});

// ── Migrations ──

describe('migrations', () => {
  it('should be idempotent', () => {
    const db = initTestDb();
    runMigrations(db);
    // Running again should not throw
    runMigrations(db);
  });
});

// ── Agent Groups ──

describe('agent groups', () => {
  const ag = () => ({
    id: 'ag-1',
    name: 'Test Agent',
    folder: 'test-agent',
    is_admin: 0,
    agent_provider: null,
    container_config: null,
    coworker_type: null,
    allowed_mcp_tools: null,
    created_at: now(),
  });

  it('should create and retrieve', () => {
    createAgentGroup(ag());
    const result = getAgentGroup('ag-1');
    expect(result).toBeDefined();
    expect(result!.name).toBe('Test Agent');
    expect(result!.folder).toBe('test-agent');
  });

  it('should find by folder', () => {
    createAgentGroup(ag());
    const result = getAgentGroupByFolder('test-agent');
    expect(result).toBeDefined();
    expect(result!.id).toBe('ag-1');
  });

  it('should list all', () => {
    createAgentGroup(ag());
    createAgentGroup({ ...ag(), id: 'ag-2', name: 'Another', folder: 'another' });
    expect(getAllAgentGroups()).toHaveLength(2);
  });

  it('should find admin group', () => {
    createAgentGroup(ag());
    createAgentGroup({ ...ag(), id: 'ag-admin', name: 'Admin', folder: 'admin', is_admin: 1 });
    const admin = getAdminAgentGroup();
    expect(admin).toBeDefined();
    expect(admin!.id).toBe('ag-admin');
  });

  it('should update', () => {
    createAgentGroup(ag());
    updateAgentGroup('ag-1', { name: 'Updated' });
    expect(getAgentGroup('ag-1')!.name).toBe('Updated');
  });

  it('should delete', () => {
    createAgentGroup(ag());
    deleteAgentGroup('ag-1');
    expect(getAgentGroup('ag-1')).toBeUndefined();
  });

  it('should enforce unique folder', () => {
    createAgentGroup(ag());
    expect(() => createAgentGroup({ ...ag(), id: 'ag-dup' })).toThrow();
  });
});

// ── Messaging Groups ──

describe('messaging groups', () => {
  const mg = () => ({
    id: 'mg-1',
    channel_type: 'discord',
    platform_id: 'chan-123',
    name: 'General',
    is_group: 1,
    admin_user_id: 'user-1',
    created_at: now(),
  });

  it('should create and retrieve', () => {
    createMessagingGroup(mg());
    const result = getMessagingGroup('mg-1');
    expect(result).toBeDefined();
    expect(result!.channel_type).toBe('discord');
  });

  it('should find by platform', () => {
    createMessagingGroup(mg());
    const result = getMessagingGroupByPlatform('discord', 'chan-123');
    expect(result).toBeDefined();
    expect(result!.id).toBe('mg-1');
  });

  it('should enforce unique channel_type + platform_id', () => {
    createMessagingGroup(mg());
    expect(() => createMessagingGroup({ ...mg(), id: 'mg-dup' })).toThrow();
  });

  it('should update', () => {
    createMessagingGroup(mg());
    updateMessagingGroup('mg-1', { name: 'Updated' });
    expect(getMessagingGroup('mg-1')!.name).toBe('Updated');
  });

  it('should delete', () => {
    createMessagingGroup(mg());
    deleteMessagingGroup('mg-1');
    expect(getMessagingGroup('mg-1')).toBeUndefined();
  });
});

// ── Destinations ──

describe('agent destinations', () => {
  beforeEach(() => {
    createAgentGroup({
      id: 'ag-1',
      name: 'Agent',
      folder: 'agent',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
  });

  it('should normalize preferred destination names', () => {
    expect(allocateDestinationName('ag-1', 'General Chat / Discord')).toBe('general-chat-discord');
  });

  it('should suffix on collision within one agent namespace', () => {
    createDestination({
      agent_group_id: 'ag-1',
      local_name: 'general-chat-discord',
      target_type: 'channel',
      target_id: 'mg-1',
      created_at: now(),
    });

    expect(allocateDestinationName('ag-1', 'General Chat / Discord')).toBe('general-chat-discord-2');
  });
});

// ── Messaging Group Agents ──

describe('messaging group agents', () => {
  beforeEach(() => {
    createAgentGroup({
      id: 'ag-1',
      name: 'Agent',
      folder: 'agent',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createMessagingGroup({
      id: 'mg-1',
      channel_type: 'discord',
      platform_id: 'chan-1',
      name: 'Gen',
      is_group: 1,
      admin_user_id: null,
      created_at: now(),
    });
  });

  const mga = () => ({
    id: 'mga-1',
    messaging_group_id: 'mg-1',
    agent_group_id: 'ag-1',
    trigger_rules: null,
    response_scope: 'all' as const,
    session_mode: 'shared' as const,
    priority: 0,
    created_at: now(),
  });

  it('should create and list by messaging group', () => {
    createMessagingGroupAgent(mga());
    const results = getMessagingGroupAgents('mg-1');
    expect(results).toHaveLength(1);
    expect(results[0].agent_group_id).toBe('ag-1');
  });

  it('should order by priority descending', () => {
    createMessagingGroupAgent(mga());
    createAgentGroup({
      id: 'ag-2',
      name: 'Agent2',
      folder: 'agent2',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createMessagingGroupAgent({ ...mga(), id: 'mga-2', agent_group_id: 'ag-2', priority: 10 });
    const results = getMessagingGroupAgents('mg-1');
    expect(results[0].agent_group_id).toBe('ag-2');
    expect(results[1].agent_group_id).toBe('ag-1');
  });

  it('should enforce unique messaging_group + agent_group', () => {
    createMessagingGroupAgent(mga());
    expect(() => createMessagingGroupAgent({ ...mga(), id: 'mga-dup' })).toThrow();
  });

  it('should update', () => {
    createMessagingGroupAgent(mga());
    updateMessagingGroupAgent('mga-1', { priority: 5 });
    expect(getMessagingGroupAgent('mga-1')!.priority).toBe(5);
  });

  it('should delete', () => {
    createMessagingGroupAgent(mga());
    deleteMessagingGroupAgent('mga-1');
    expect(getMessagingGroupAgents('mg-1')).toHaveLength(0);
  });

  it('should enforce foreign key on agent_group_id', () => {
    expect(() => createMessagingGroupAgent({ ...mga(), agent_group_id: 'nonexistent' })).toThrow();
  });
});

// ── Sessions ──

describe('sessions', () => {
  beforeEach(() => {
    createAgentGroup({
      id: 'ag-1',
      name: 'Agent',
      folder: 'agent',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createMessagingGroup({
      id: 'mg-1',
      channel_type: 'discord',
      platform_id: 'chan-1',
      name: 'Gen',
      is_group: 1,
      admin_user_id: null,
      created_at: now(),
    });
  });

  const sess = () => ({
    id: 'sess-1',
    agent_group_id: 'ag-1',
    messaging_group_id: 'mg-1',
    thread_id: null,
    agent_provider: null,
    status: 'active' as const,
    container_status: 'stopped' as const,
    last_active: null,
    created_at: now(),
  });

  it('should create and retrieve', () => {
    createSession(sess());
    const result = getSession('sess-1');
    expect(result).toBeDefined();
    expect(result!.agent_group_id).toBe('ag-1');
  });

  it('should find by messaging group (shared, no thread)', () => {
    createSession(sess());
    const result = findSession('mg-1', null);
    expect(result).toBeDefined();
    expect(result!.id).toBe('sess-1');
  });

  it('should find by messaging group + thread', () => {
    createSession({ ...sess(), thread_id: 'thread-1' });
    expect(findSession('mg-1', 'thread-1')).toBeDefined();
    expect(findSession('mg-1', 'thread-2')).toBeUndefined();
    expect(findSession('mg-1', null)).toBeUndefined();
  });

  it('should only find active sessions', () => {
    createSession({ ...sess(), status: 'closed' });
    expect(findSession('mg-1', null)).toBeUndefined();
  });

  it('should list by agent group', () => {
    createSession(sess());
    createSession({ ...sess(), id: 'sess-2', thread_id: 'thread-1' });
    expect(getSessionsByAgentGroup('ag-1')).toHaveLength(2);
  });

  it('should list active sessions', () => {
    createSession(sess());
    createSession({ ...sess(), id: 'sess-closed', status: 'closed', thread_id: 'thread-x' });
    expect(getActiveSessions()).toHaveLength(1);
  });

  it('should list running sessions', () => {
    createSession({ ...sess(), container_status: 'running' });
    createSession({ ...sess(), id: 'sess-idle', container_status: 'idle', thread_id: 'thread-1' });
    createSession({ ...sess(), id: 'sess-stopped', container_status: 'stopped', thread_id: 'thread-2' });
    expect(getRunningSessions()).toHaveLength(2);
  });

  it('should update', () => {
    createSession(sess());
    updateSession('sess-1', { container_status: 'running', last_active: now() });
    const result = getSession('sess-1')!;
    expect(result.container_status).toBe('running');
    expect(result.last_active).not.toBeNull();
  });

  it('should delete', () => {
    createSession(sess());
    deleteSession('sess-1');
    expect(getSession('sess-1')).toBeUndefined();
  });
});

// ── Pending Questions ──

describe('pending questions', () => {
  beforeEach(() => {
    createAgentGroup({
      id: 'ag-1',
      name: 'Agent',
      folder: 'agent',
      is_admin: 0,
      agent_provider: null,
      container_config: null,
      coworker_type: null,
      allowed_mcp_tools: null,
      created_at: now(),
    });
    createSession({
      id: 'sess-1',
      agent_group_id: 'ag-1',
      messaging_group_id: null,
      thread_id: null,
      agent_provider: null,
      status: 'active',
      container_status: 'stopped',
      last_active: null,
      created_at: now(),
    });
  });

  it('should create and retrieve', () => {
    createPendingQuestion({
      question_id: 'q-1',
      session_id: 'sess-1',
      message_out_id: 'msg-out-1',
      platform_id: 'chan-1',
      channel_type: 'discord',
      thread_id: null,
      created_at: now(),
    });
    const result = getPendingQuestion('q-1');
    expect(result).toBeDefined();
    expect(result!.session_id).toBe('sess-1');
  });

  it('should delete', () => {
    createPendingQuestion({
      question_id: 'q-1',
      session_id: 'sess-1',
      message_out_id: 'msg-out-1',
      platform_id: null,
      channel_type: null,
      thread_id: null,
      created_at: now(),
    });
    deletePendingQuestion('q-1');
    expect(getPendingQuestion('q-1')).toBeUndefined();
  });
});
