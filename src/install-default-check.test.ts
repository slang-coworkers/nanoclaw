import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logged = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }));
vi.mock('./log.js', () => ({ log: logged }));

const { groupsDir } = vi.hoisted(() => ({ groupsDir: { path: '' } }));
vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  return {
    ...actual,
    get GROUPS_DIR() {
      return path.join(groupsDir.path, 'groups');
    },
    get DATA_DIR() {
      return path.join(groupsDir.path, 'data');
    },
  };
});

import { backfillContainerConfigs } from './backfill-container-configs.js';
import { DEFAULT_AGENT_PROVIDER } from './config.js';
import { createAgentGroup, getAgentGroup } from './db/agent-groups.js';
import { initGroupFilesystem } from './group-init.js';
import { closeDb, initTestDb } from './db/connection.js';
import { ensureContainerConfig, getContainerConfig } from './db/container-configs.js';
import { runMigrations } from './db/migrations/index.js';
import { checkInstallDefault, inspectInstallDefault } from './install-default-check.js';
import { resolveProviderName } from './providers/provider-name.js';
import { installDefaultProvider, resolveGroupModels } from './model-policy.js';

const ENV = { OPENCODE_PROVIDER: 'openai' };

async function addGroup(id: string, agentProvider: string | null = null): Promise<void> {
  await createAgentGroup({ id, name: id, folder: id, agent_provider: agentProvider, created_at: 'x' });
}

beforeEach(async () => {
  groupsDir.path = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-install-default-'));
  fs.mkdirSync(path.join(groupsDir.path, 'groups'));
  fs.mkdirSync(path.join(groupsDir.path, 'data'));
  await runMigrations(await initTestDb());
  vi.clearAllMocks();
});
afterEach(async () => {
  await closeDb();
  fs.rmSync(groupsDir.path, { recursive: true, force: true });
});

describe('the install default at host start', () => {
  it('names the groups that follow it, and leaves out the ones that name their own', async () => {
    await addGroup('ag-new');
    await ensureContainerConfig('ag-new');
    await addGroup('ag-claude');
    await ensureContainerConfig('ag-claude', 'claude');
    await addGroup('ag-weights', 'opencode');
    await ensureContainerConfig('ag-weights');

    expect(await inspectInstallDefault(ENV)).toEqual({
      provider: 'opencode',
      weights: 'open',
      problems: [],
      providerFollowers: ['ag-new'],
      weightsFollowers: ['ag-new', 'ag-weights'],
    });
    await checkInstallDefault(ENV);
    expect(logged.info).toHaveBeenCalledWith(
      'Install default provider and weights',
      expect.objectContaining({ provider: 'opencode', weights: 'open', providerFollowers: ['ag-new'] }),
    );
    expect(logged.error).not.toHaveBeenCalled();
  });

  it('logs an error when the default breaks the model policy', async () => {
    await checkInstallDefault({ ...ENV, DEFAULT_AGENT_PROVIDER: 'claude', NANOCLAW_DEFAULT_WEIGHTS: 'open' });
    expect(logged.error).toHaveBeenCalledWith(
      expect.stringContaining('The install default breaks the model policy'),
      expect.objectContaining({ provider: 'claude', weights: 'open' }),
    );
  });

  it('refuses to start on a weights setting other than any or open', async () => {
    await expect(checkInstallDefault({ NANOCLAW_DEFAULT_WEIGHTS: 'closed' })).rejects.toThrow(
      'NANOCLAW_DEFAULT_WEIGHTS must be "any" or "open"',
    );
  });
});

describe('backfillContainerConfigs', () => {
  it('gives a row-less legacy group the row it ran on before the open default: claude, weights any', async () => {
    await addGroup('ag-legacy');
    fs.mkdirSync(path.join(groupsDir.path, 'groups', 'ag-legacy'));
    await addGroup('ag-legacy-codex');
    fs.mkdirSync(path.join(groupsDir.path, 'groups', 'ag-legacy-codex'));
    fs.writeFileSync(path.join(groupsDir.path, 'groups', 'ag-legacy-codex', 'container.json'), '{"provider":"codex"}');

    await backfillContainerConfigs();

    const legacy = (await getContainerConfig('ag-legacy'))!;
    expect({ provider: legacy.provider, weights: legacy.weights }).toEqual({ provider: 'claude', weights: 'any' });
    const codex = (await getContainerConfig('ag-legacy-codex'))!;
    expect({ provider: codex.provider, weights: codex.weights }).toEqual({ provider: 'codex', weights: 'any' });
    // So the legacy group still starts on Claude without the rule, whatever the install default.
    const provider = resolveProviderName({
      override: undefined,
      session: undefined,
      group: null,
      config: legacy.provider,
    });
    expect(resolveGroupModels(provider, legacy, ENV)).toMatchObject({ provider: 'claude', weights: 'any' });
  });
});

describe('a new group', () => {
  it('follows the install default when its creator names no provider, and records an explicit pick', async () => {
    await addGroup('ag-plain');
    await initGroupFilesystem((await getAgentGroup('ag-plain'))!);
    const plain = (await getContainerConfig('ag-plain'))!;
    expect({ provider: plain.provider, weights: plain.weights }).toEqual({ provider: null, weights: null });

    await addGroup('ag-picked');
    await initGroupFilesystem((await getAgentGroup('ag-picked'))!, { provider: 'claude' });
    const picked = (await getContainerConfig('ag-picked'))!;
    expect({ provider: picked.provider, weights: picked.weights }).toEqual({ provider: 'claude', weights: 'any' });
  });

  it("the setup wizard's DEFAULT_AGENT_PROVIDER is the same install default spawn resolves", () => {
    expect(DEFAULT_AGENT_PROVIDER).toBe(installDefaultProvider());
  });
});
