import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAgentGroup } from '../../db/agent-groups.js';
import { closeDb, initTestDb } from '../../db/connection.js';
import { ensureContainerConfig, updateContainerConfigScalars } from '../../db/container-configs.js';
import { runMigrations } from '../../db/migrations/index.js';
import { resolveOpenLane } from './open-lane.js';

/** Create a group and its config row; `provider` sets the group tier, `config` the config columns. */
async function group(
  folder: string,
  provider: string | null,
  config: Parameters<typeof updateContainerConfigScalars>[1] = {},
): Promise<string> {
  const id = `ag-${folder}`;
  await createAgentGroup({ id, name: folder, folder, agent_provider: provider, created_at: new Date().toISOString() });
  await ensureContainerConfig(id, 'claude');
  await updateContainerConfigScalars(id, config);
  return id;
}

beforeEach(async () => {
  await runMigrations(await initTestDb());
});
afterEach(async () => {
  await closeDb();
});

describe('resolveOpenLane', () => {
  it('is unset when no folder is configured', async () => {
    expect(await resolveOpenLane(null)).toEqual({ status: 'unset' });
    expect(await resolveOpenLane('')).toEqual({ status: 'unset' });
  });

  it('is invalid when no group has the folder', async () => {
    expect(await resolveOpenLane('missing')).toEqual({
      status: 'invalid',
      folder: 'missing',
      problem: 'no agent group has this folder',
    });
  });

  it('is ready for an OpenCode group with weights=open and the open defaults', async () => {
    const id = await group('lane', 'opencode', { weights: 'open' });
    expect(await resolveOpenLane('lane')).toEqual({ status: 'ready', folder: 'lane', agentGroupId: id });
  });

  it('reads the provider from the container config when the group has none', async () => {
    const id = await group('pi-lane', null, { provider: 'pi', weights: 'open' });
    expect(await resolveOpenLane('pi-lane')).toEqual({ status: 'ready', folder: 'pi-lane', agentGroupId: id });
  });

  it('is invalid for a group left at weights=any, whose critic is the closed default', async () => {
    await group('any', 'opencode');
    expect(await resolveOpenLane('any')).toMatchObject({ status: 'invalid', problem: 'the group is not weights=open' });
  });

  it('is invalid for a weights=open group that names a closed model, and names the role', async () => {
    await group('mixed', 'opencode', { weights: 'open', critic_model: 'openai/openai/gpt-6.1-sol' });
    const lane = await resolveOpenLane('mixed');
    expect(lane.status).toBe('invalid');
    expect(lane.status === 'invalid' && lane.problem).toContain('critic model openai/openai/gpt-6.1-sol');
  });

  it('is invalid for a Claude group, which runs Claude models only', async () => {
    await group('claude', null, { weights: 'open' });
    const lane = await resolveOpenLane('claude');
    expect(lane.status === 'invalid' && lane.problem).toContain('the Claude provider runs Claude models only');
  });
});
