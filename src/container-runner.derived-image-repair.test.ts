/**
 * A wake whose `driver.prepare` reports the group's own derived image missing starts a rebuild of
 * that image, and the wake still fails so the sweep retries it. Every other prepare failure, and a
 * missing image this install did not build, leaves the rebuild to the operator.
 */
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SupervisedHandle } from './drivers/session-events.js';

const { prepare, capabilities, requestRebuild } = vi.hoisted(() => ({
  prepare: vi.fn(),
  capabilities: vi.fn(() => ({ imageBuild: true })),
  requestRebuild: vi.fn(() => 'started'),
}));
vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  const root = `/tmp/nanoclaw-test-derived-image-${process.pid}`;
  return { ...actual, DATA_DIR: `${root}/data`, GROUPS_DIR: `${root}/groups` };
});
vi.mock('./drivers/index.js', () => {
  const driver = { kind: 'fake', listSessions: async () => [], prepare, capabilities };
  return { getSessionDriver: () => driver, isSessionEventsDriver: () => false };
});
vi.mock('./derived-image-repair.js', async () => {
  const actual = await vi.importActual<typeof import('./derived-image-repair.js')>('./derived-image-repair.js');
  return { ...actual, requestDerivedImageRebuild: requestRebuild };
});

import { CONTAINER_IMAGE_BASE } from './config.js';
import { isContainerRunning, killContainer, repairDerivedImage, wakeContainer } from './container-runner.js';
import { ensureContainerConfig, updateContainerConfigScalars } from './db/container-configs.js';
import { initTestDb, closeDb, runMigrations, createAgentGroup, createSession } from './db/index.js';
import { asFailureError } from './drivers/types.js';
import { resetGatewayProvider } from './gateway-providers/index.js';
import type { Session } from './types.js';

const DERIVED = `${CONTAINER_IMAGE_BASE}:ag-1`;

function session(): Session {
  const now = new Date().toISOString();
  return {
    id: 'sess-1',
    agent_group_id: 'ag-1',
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'running',
    last_active: now,
    created_at: now,
  };
}

function fakeHandle(): SupervisedHandle {
  return {
    key: { installSlug: 'test-install', agentGroupId: 'ag-1', sessionId: 'sess-1' },
    name: 'nanoclaw-v2-sess-1',
    async start() {},
    async stop() {},
    async status() {
      return { phase: 'running' };
    },
    onTerminal() {},
  } as unknown as SupervisedHandle;
}

/** Pin the group to `imageTag` and make prepare fail with `kind`. */
async function failPrepare(imageTag: string | null, kind: 'image-unavailable' | 'runtime-unavailable') {
  await updateContainerConfigScalars('ag-1', { image_tag: imageTag });
  prepare.mockRejectedValue(asFailureError({ kind, retryable: true }));
  return wakeContainer(session());
}

beforeEach(async () => {
  prepare.mockReset();
  prepare.mockResolvedValue(fakeHandle());
  capabilities.mockReset();
  capabilities.mockReturnValue({ imageBuild: true });
  requestRebuild.mockClear();
  resetGatewayProvider({
    kind: 'fixture',
    agentSkills: [],
    sessions: {
      ensure: async () => ({
        contribution: { networkAccess: { endpoint: 'localhost', target: { kind: 'host' as const } } },
      }),
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
  await createSession(session());
});

afterEach(async () => {
  if (isContainerRunning('sess-1')) {
    killContainer('sess-1', 'test-teardown');
    await vi.waitFor(() => expect(isContainerRunning('sess-1')).toBe(false));
  }
  resetGatewayProvider();
  await closeDb();
  fs.rmSync(`/tmp/nanoclaw-test-derived-image-${process.pid}`, { recursive: true, force: true });
});

describe('missing derived image on wake', () => {
  it("starts a rebuild of the group's own image and still fails the wake", async () => {
    expect(await failPrepare(DERIVED, 'image-unavailable')).toBe(false);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ containers: expect.arrayContaining([expect.objectContaining({ image: DERIVED })]) }),
    );
    expect(requestRebuild).toHaveBeenCalledTimes(1);
    expect(requestRebuild).toHaveBeenCalledWith('ag-1', repairDerivedImage);
  });

  it('leaves a missing operator-supplied pin and a missing base image alone', async () => {
    expect(await failPrepare('registry.example/agent:custom', 'image-unavailable')).toBe(false);
    expect(await failPrepare(null, 'image-unavailable')).toBe(false);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(requestRebuild).not.toHaveBeenCalled();
  });

  it('does not rebuild for other prepare failures', async () => {
    expect(await failPrepare(DERIVED, 'runtime-unavailable')).toBe(false);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(requestRebuild).not.toHaveBeenCalled();
  });

  it('does not rebuild on a driver without imageBuild', async () => {
    capabilities.mockReturnValue({ imageBuild: false });
    expect(await failPrepare(DERIVED, 'image-unavailable')).toBe(false);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(requestRebuild).not.toHaveBeenCalled();
  });
});
