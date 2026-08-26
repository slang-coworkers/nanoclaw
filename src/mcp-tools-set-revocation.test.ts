/**
 * Narrowing an allow-list must revoke privileges from EVERY live session of
 * the agent group, and must not claim to have done so before it has.
 *
 * Pre-fix, `ncl groups mcp-tools set` mutated the host proxy token and
 * returned `live_containers_rescoped: N` with a note saying the change had
 * been "applied to N running container(s)". Two things were wrong with that:
 *
 *   1. The proxy token deliberately excludes `mcp__nanoclaw__*` and has no
 *      reach over direct stdio servers at all, so a running container kept
 *      every built-in and Codex tool it had before the narrowing. The provider
 *      snapshots its tool policy in its constructor; nothing the host could
 *      say to a live container changed it.
 *   2. `allowed_mcp_tools` is a column on the AGENT GROUP, and a group
 *      routinely has several live sessions. Even the proxy half only ever
 *      reported on tokens; nothing restarted the siblings.
 */
import fs from 'fs';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const killed: { sessionId: string; reason: string }[] = [];
const running = new Set<string>();

vi.mock('./container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: (id: string) => running.has(id),
  getActiveContainerCount: () => running.size,
  killContainer: (sessionId: string, reason: string, onExit?: () => void) => {
    killed.push({ sessionId, reason });
    running.delete(sessionId);
    onExit?.();
  },
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./config.js', async () => {
  const actual = await vi.importActual('./config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-mcp-revocation' };
});

const TEST_DIR = '/tmp/nanoclaw-test-mcp-revocation';

const { initTestDb, closeDb, runMigrations, createAgentGroup } = await import('./db/index.js');
const { createSession } = await import('./db/sessions.js');
const { dispatch } = await import('./cli/dispatch.js');
await import('./cli/resources/groups.js');

/**
 * Let the deferred restart run.
 *
 * The handler queues the restart behind its own response (see
 * src/cli/post-response.ts); the real transports drain after writing. This
 * file deliberately leans on the queue's macrotask fallback instead of
 * importing the queue, so it compiles — and fails — on the pre-fix tree,
 * proving the BEHAVIOUR (siblings get restarted) rather than the mechanism.
 * The ordering guarantee itself is proved in cli/post-response-ordering.test.ts.
 */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const GID = 'ag-narrow';

function now(): string {
  return new Date().toISOString();
}

function addSession(id: string, status: 'active' | 'closed', containerRunning: boolean): void {
  createSession({
    id,
    agent_group_id: GID,
    messaging_group_id: null,
    thread_id: id,
    agent_provider: null,
    status,
    container_status: containerRunning ? 'running' : 'stopped',
    last_active: null,
    created_at: now(),
  });
  if (containerRunning) running.add(id);
}

beforeEach(async () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  killed.length = 0;
  running.clear();

  await runMigrations(await initTestDb());
  await createAgentGroup({ id: GID, name: 'Narrow', folder: 'narrow', agent_provider: null, created_at: now() });
  addSession('sess-root', 'active', true);
  addSession('sess-thread-a', 'active', true);
  addSession('sess-idle', 'active', false);
  addSession('sess-closed', 'closed', true);
});

afterEach(() => {
  closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

async function setTools(tools: string): Promise<Record<string, unknown>> {
  const res = await dispatch(
    { id: 'req-1', command: 'groups-mcp-tools-set', args: { id: GID, tools } },
    { caller: 'host' },
  );
  if (!res.ok) throw new Error(`dispatch failed: ${res.error.message}`);
  return res.data as Record<string, unknown>;
}

describe('mcp-tools set restarts every running container in the group', () => {
  it('kills the calling session AND its siblings, and nothing else', async () => {
    await setTools('[]');
    // Nothing has been killed yet — the restart is queued behind the response.
    expect(killed).toEqual([]);

    await settle();

    expect(killed.map((k) => k.sessionId).sort()).toEqual(['sess-root', 'sess-thread-a']);
    // A session with no container has nothing to revoke; a closed session must
    // never be resurrected by a policy change.
    expect(killed.map((k) => k.sessionId)).not.toContain('sess-idle');
    expect(killed.map((k) => k.sessionId)).not.toContain('sess-closed');
    for (const k of killed) expect(k.reason).toMatch(/allow-list/);
  });

  it('reports the direct-tool half as pending-restart, not as applied', async () => {
    const data = await setTools('[]');
    expect(data.state).toBe('explicit');
    expect((data.containers_pending_restart as string[]).sort()).toEqual(['sess-root', 'sess-thread-a']);
    expect(data.enforcement).toEqual({
      proxied_mcp_servers: 'applied',
      direct_mcp_servers: 'pending-restart',
    });
    expect(String(data.note)).toMatch(/PENDING-RESTART/);
  });

  it('says applied — not pending — when the group has no live container', async () => {
    running.clear();
    const data = await setTools('[]');
    expect(data.containers_pending_restart).toEqual([]);
    expect((data.enforcement as Record<string, string>).direct_mcp_servers).toBe('applied');
    await settle();
    expect(killed).toEqual([]);
  });

  it('restarts on a widening too — a stale snapshot blocks new tools just as hard', async () => {
    await setTools('unrestricted');
    await settle();
    expect(killed.map((k) => k.sessionId).sort()).toEqual(['sess-root', 'sess-thread-a']);
  });

  it('carries the new policy to the respawned agent in its wake message', async () => {
    await setTools(JSON.stringify(['mcp__deepwiki__ask_question']));
    await settle();
    // restartAgentGroupContainers wrote an on_wake row into each session's
    // inbound.db before killing; the fresh container reads it on first poll.
    const Database = (await import('better-sqlite3')).default;
    for (const sessionId of ['sess-root', 'sess-thread-a']) {
      const db = new Database(`${TEST_DIR}/v2-sessions/${GID}/${sessionId}/inbound.db`, { readonly: true });
      const rows = db.prepare('SELECT content FROM messages_in WHERE on_wake = 1').all() as { content: string }[];
      db.close();
      expect(rows).toHaveLength(1);
      const text = JSON.parse(rows[0].content).text as string;
      expect(text).toMatch(/MCP tool allow-list changed/);
      expect(text).toMatch(/mcp__deepwiki__ask_question/);
    }
  });
});
