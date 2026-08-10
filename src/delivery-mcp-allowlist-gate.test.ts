/**
 * The built-in `nanoclaw` MCP surface is enforced on the HOST.
 *
 * Everything inside the container is advisory against a determined agent: a
 * group's agent-runner source (`/app/src`) is a writable mount the agent may
 * edit, and the built-in tools are direct stdio — they never traverse the MCP
 * auth proxy, which was the only thing the allow-list actually configured
 * before this change. `handleSystemAction` is the one place a built-in tool's
 * privileged effect has to pass through host code, so it is where the
 * allow-list has to be decided.
 *
 * Pre-fix, every one of these actions ran regardless of the group's allow-list.
 */
import fs from 'fs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./config.js', async () => {
  const actual = await vi.importActual('./config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-mcp-gate' };
});

const TEST_DIR = '/tmp/nanoclaw-test-mcp-gate';

const { initTestDb, closeDb, runMigrations, createAgentGroup } = await import('./db/index.js');
const { updateAgentGroup } = await import('./db/agent-groups.js');
const { createSession } = await import('./db/sessions.js');
const { __testHooks, registerDeliveryAction } = await import('./delivery.js');
const { handleSystemAction } = __testHooks;
const { unguarded } = await import('./guard/index.js');
const { NANOCLAW_ACTION_TOOLS } = await import('./mcp-allowlist.js');
type Session = import('./types.js').Session;
type SessionDb = import('better-sqlite3').Database;

const GID = 'ag-gated';
const SID = 'sess-gated';

const ran: string[] = [];

// Stand-ins for the real handlers: same registry, same dispatch path, so the
// gate is exercised exactly where it sits without dragging in image rebuilds
// and approval cards.
for (const action of Object.keys(NANOCLAW_ACTION_TOOLS)) {
  registerDeliveryAction(
    action,
    async () => {
      ran.push(action);
    },
    unguarded('test double — this file exercises the allow-list gate ahead of the guard'),
  );
}
registerDeliveryAction(
  'cli_request',
  async () => {
    ran.push('cli_request');
  },
  unguarded('test double'),
);

function now(): string {
  return new Date().toISOString();
}

const session = { id: SID, agent_group_id: GID, messaging_group_id: null } as unknown as Session;
// The handlers under test are doubles that never touch the DB handle.
const inDb = null as unknown as SessionDb;

beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  ran.length = 0;
  runMigrations(initTestDb());
  createAgentGroup({ id: GID, name: 'Gated', folder: 'gated', agent_provider: null, created_at: now() });
  createSession({
    id: SID,
    agent_group_id: GID,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'running',
    last_active: null,
    created_at: now(),
  });
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('an explicit empty allow-list stops every privileged built-in at the host', () => {
  beforeEach(() => {
    updateAgentGroup(GID, { allowed_mcp_tools: '[]' });
  });

  it('refuses every nanoclaw action that has an allow-list identity', async () => {
    for (const action of Object.keys(NANOCLAW_ACTION_TOOLS)) {
      await handleSystemAction({ action }, session, inDb);
    }
    expect(ran).toEqual([]);
  });

  it('still lets the ncl bridge through — it is not an MCP tool', async () => {
    // `cli_request` reaches the host over Bash + the ncl CLI, and every inner
    // command is separately gated by cli_scope and the dispatch guard. Folding
    // it into the MCP allow-list would silently disable an unrelated control
    // surface.
    await handleSystemAction({ action: 'cli_request' }, session, inDb);
    expect(ran).toEqual(['cli_request']);
  });
});

describe('a narrower list permits exactly what it names', () => {
  it('allows a named built-in and refuses the rest', async () => {
    updateAgentGroup(GID, { allowed_mcp_tools: JSON.stringify(['mcp__nanoclaw__append_learning']) });
    await handleSystemAction({ action: 'append_learning' }, session, inDb);
    await handleSystemAction({ action: 'install_packages' }, session, inDb);
    await handleSystemAction({ action: 'create_agent' }, session, inDb);
    expect(ran).toEqual(['append_learning']);
  });

  it('respects the tool name, not the action name, where they differ', async () => {
    // `report_pr_created` is the tool; `map_pr_session` is the action it writes.
    updateAgentGroup(GID, { allowed_mcp_tools: JSON.stringify(['mcp__nanoclaw__report_pr_created']) });
    await handleSystemAction({ action: 'map_pr_session' }, session, inDb);
    expect(ran).toEqual(['map_pr_session']);
  });
});

describe('unrestricted and unknown groups', () => {
  it('lets everything through when the group is unrestricted', async () => {
    updateAgentGroup(GID, { allowed_mcp_tools: '*' });
    await handleSystemAction({ action: 'install_packages' }, session, inDb);
    await handleSystemAction({ action: 'create_agent' }, session, inDb);
    expect(ran).toEqual(['install_packages', 'create_agent']);
  });

  it('denies when the session points at a group that no longer exists', async () => {
    await handleSystemAction({ action: 'install_packages' }, { ...session, agent_group_id: 'ag-ghost' }, inDb);
    expect(ran).toEqual([]);
  });
});
