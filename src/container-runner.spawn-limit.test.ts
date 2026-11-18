/**
 * The busy-container limit on the real wake path: a wake that needs a new
 * container waits while too many containers are busy, a running session is
 * never held, and an idle container frees its slot without being stopped.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SupervisedHandle } from './drivers/session-events.js';

const ROOT = `/tmp/nanoclaw-test-spawn-limit-${process.pid}`;
const { prepare } = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  const root = `/tmp/nanoclaw-test-spawn-limit-${process.pid}`;
  return { ...actual, DATA_DIR: `${root}/data`, GROUPS_DIR: `${root}/groups` };
});
vi.mock('./drivers/index.js', () => {
  const driver = { kind: 'fake', listSessions: async () => [], prepare, capabilities: () => ({}) };
  return { getSessionDriver: () => driver, isSessionEventsDriver: () => false };
});

import { _setSpawnAdmissionForTesting, isContainerRunning, killContainer, wakeContainer } from './container-runner.js';
import { ensureContainerConfig } from './db/container-configs.js';
import { closeDb, createAgentGroup, createSession, initTestDb, runMigrations, updateSession } from './db/index.js';
import { resetGatewayProvider } from './gateway-providers/index.js';
import { heartbeatPath } from './session-manager.js';
import type { Session } from './types.js';

const SESSIONS = ['sess-1', 'sess-2', 'sess-3'];

function session(id: string): Session {
  const now = new Date().toISOString();
  return {
    id,
    agent_group_id: 'ag-1',
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: now,
    created_at: now,
  };
}

function fakeHandle(sessionId: string): SupervisedHandle {
  return {
    key: { installSlug: 'test-install', agentGroupId: 'ag-1', sessionId },
    name: `nanoclaw-v2-${sessionId}`,
    async start() {},
    async stop() {},
    async status() {
      return { phase: 'running' };
    },
    onTerminal() {},
  } as unknown as SupervisedHandle;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Touch a session's heartbeat the way the runner does on a provider event:
 * `utimes` with the current time, some time after the container started. (A
 * bare file write takes the kernel's coarse clock, and a touch in the same
 * millisecond as the start can round below it; a real runner's first event
 * comes seconds after the start.)
 */
async function touchHeartbeat(sessionId: string): Promise<void> {
  await sleep(10);
  const file = heartbeatPath('ag-1', sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
  const now = new Date();
  fs.utimesSync(file, now, now);
}

beforeEach(async () => {
  prepare.mockReset();
  prepare.mockImplementation(async (spec: { key: { sessionId: string } }) => fakeHandle(spec.key.sessionId));
  resetGatewayProvider({
    kind: 'fixture',
    agentSkills: [],
    sessions: {
      ensure: async () => ({ contribution: { networkAccess: { endpoint: 'localhost', target: { kind: 'host' } } } }),
    },
    approvals: { subscribe: async () => {} },
  });
  const db = await initTestDb();
  await runMigrations(db);
  await createAgentGroup({
    id: 'ag-1',
    name: 'Test Agent',
    folder: 'test-agent',
    agent_provider: null,
    created_at: new Date().toISOString(),
  });
  await ensureContainerConfig('ag-1');
  for (const id of SESSIONS) await createSession(session(id));
});

afterEach(async () => {
  for (const id of SESSIONS) {
    if (!isContainerRunning(id)) continue;
    killContainer(id, 'test-teardown');
    await vi.waitFor(() => expect(isContainerRunning(id)).toBe(false));
  }
  _setSpawnAdmissionForTesting();
  resetGatewayProvider();
  await closeDb();
  fs.rmSync(ROOT, { recursive: true, force: true });
});

describe('busy-container limit on wake', () => {
  it('holds a new spawn at the limit and never holds a session whose container is running', async () => {
    _setSpawnAdmissionForTesting({ limit: 1 });
    expect(await wakeContainer(session('sess-1'))).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(1);

    // sess-1 is starting (no heartbeat yet), so it holds the only slot.
    expect(await wakeContainer(session('sess-2'))).toBe(false);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(isContainerRunning('sess-2')).toBe(false);

    // A wake for the running session is not a spawn and is never held.
    expect(await wakeContainer(session('sess-1'))).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('admits the held wake once the busy container goes idle, without stopping it', async () => {
    _setSpawnAdmissionForTesting({ limit: 1, busyWindowMs: 50 });
    expect(await wakeContainer(session('sess-1'))).toBe(true);
    await touchHeartbeat('sess-1');
    expect(await wakeContainer(session('sess-2'))).toBe(false);

    // No provider event for longer than the busy window: sess-1 is idle.
    await sleep(100);
    expect(await wakeContainer(session('sess-2'))).toBe(true);
    expect(isContainerRunning('sess-1')).toBe(true);
    expect(isContainerRunning('sess-2')).toBe(true);
  });

  it('gives a freed slot to the session held first, not to a later wake', async () => {
    _setSpawnAdmissionForTesting({ limit: 1, busyWindowMs: 50 });
    expect(await wakeContainer(session('sess-1'))).toBe(true);
    await touchHeartbeat('sess-1');
    expect(await wakeContainer(session('sess-2'))).toBe(false);
    expect(await wakeContainer(session('sess-3'))).toBe(false);

    await sleep(100);
    expect(await wakeContainer(session('sess-3'))).toBe(false);
    expect(await wakeContainer(session('sess-2'))).toBe(true);
  });

  it('a closed session leaves the queue instead of keeping its place', async () => {
    _setSpawnAdmissionForTesting({ limit: 1, busyWindowMs: 50 });
    expect(await wakeContainer(session('sess-1'))).toBe(true);
    await touchHeartbeat('sess-1');
    expect(await wakeContainer(session('sess-2'))).toBe(false);
    expect(await wakeContainer(session('sess-3'))).toBe(false);

    await updateSession('sess-2', { status: 'closed' });
    expect(await wakeContainer(session('sess-2'))).toBe(false);
    await sleep(100);
    expect(await wakeContainer(session('sess-3'))).toBe(true);
  });

  it('a limit of 0 spawns every wake', async () => {
    _setSpawnAdmissionForTesting({ limit: 0 });
    for (const id of SESSIONS) expect(await wakeContainer(session(id))).toBe(true);
    expect(prepare).toHaveBeenCalledTimes(3);
  });
});
