import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAgentGroup } from './db/agent-groups.js';
import { closeDb, getDb, initTestDb } from './db/connection.js';
import { ensureContainerConfig, updateContainerConfigScalars } from './db/container-configs.js';
import { runMigrations } from './db/migrations/index.js';
import { loadMigrationInputs, planGroupMigration, type MigrationGroupInput } from './open-weights-migration.js';

// A fixed install env, so the host's own .env cannot change what the plan resolves.
const ENV = { ANTHROPIC_MODEL: 'claude-opus-5-5', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-5-5' };

function input(over: Partial<MigrationGroupInput>): MigrationGroupInput {
  return { id: 'ag-1', folder: 'g', provider: 'claude', config: {}, pinnedSessions: [], ...over };
}

describe('planGroupMigration', () => {
  it('moves a Claude group to OpenCode with the open defaults', () => {
    const plan = planGroupMigration(input({}), ENV);
    expect(plan).toMatchObject({ status: 'migrate', providerChange: 'opencode', clearedRoles: [], blockers: [] });
    expect(plan.closedRolesBefore).toEqual(['main', 'small', 'router', 'critic']);
    expect(plan.after).toMatchObject({
      provider: 'opencode',
      weights: 'open',
      main: 'anthropic/nvidia/zai-org/glm-5.3',
      critic: 'nvidia/moonshotai/kimi-k3',
    });
    expect(plan.commands).toEqual([
      'ncl groups update --id ag-1 --agent-provider opencode',
      'ncl groups config update --id ag-1 --weights open',
      'ncl groups restart --id ag-1',
    ]);
  });

  it('clears a column that names a closed model, and keeps one that names an open model', () => {
    const plan = planGroupMigration(
      input({ config: { model: 'claude-opus-5-5', critic_model: 'nvidia/deepseek-ai/deepseek-v4.1-flash-1017' } }),
      ENV,
    );
    expect(plan.clearedRoles).toEqual(['main']);
    expect(plan.after.main).toBe('anthropic/nvidia/zai-org/glm-5.3');
    expect(plan.after.critic).toBe('nvidia/deepseek-ai/deepseek-v4.1-flash-1017');
    expect(plan.commands[1]).toBe('ncl groups config update --id ag-1 --weights open --model ""');
  });

  it('keeps the provider of a Codex, OpenCode or Pi group', () => {
    for (const provider of ['codex', 'opencode', 'pi']) {
      const plan = planGroupMigration(input({ provider, config: { critic_model: 'openai/openai/gpt-6.1-sol' } }), ENV);
      expect(plan).toMatchObject({ status: 'migrate', providerChange: null, clearedRoles: ['critic'] });
      expect(plan.commands[0]).toBe('ncl groups config update --id ag-1 --weights open --critic-model ""');
    }
  });

  it('keeps a model that is already open, instead of the open default', () => {
    const env = { ...ENV, CODEX_MODEL: 'nvidia/moonshotai/kimi-k3' };
    const plan = planGroupMigration(input({ provider: 'codex' }), env);
    expect(plan).toMatchObject({ status: 'migrate', keptRoles: ['main'], clearedRoles: [] });
    // The critic also comes from CODEX_MODEL, and the open default is the same Kimi: nothing to keep.
    expect(plan.after.critic).toBe('nvidia/moonshotai/kimi-k3');
    expect(plan.after.main).toBe('nvidia/moonshotai/kimi-k3');
    expect(plan.commands[0]).toBe(
      'ncl groups config update --id ag-1 --weights open --model nvidia/moonshotai/kimi-k3',
    );
  });

  it('leaves a group that is already open alone', () => {
    const plan = planGroupMigration(input({ provider: 'opencode', config: { weights: 'open' } }), ENV);
    expect(plan).toMatchObject({ status: 'already-open', commands: [], closedRolesBefore: [] });
  });

  it('blocks a group with an active session pinned to another provider', () => {
    const plan = planGroupMigration(input({ pinnedSessions: [{ id: 'sess-1', provider: 'claude' }] }), ENV);
    expect(plan.status).toBe('blocked');
    expect(plan.blockers).toEqual([
      'session sess-1 pins provider claude: close it or clear its pin before the restart',
    ]);
    expect(plan.commands).toEqual([]);
  });

  it('a session pinned to the target provider does not block', () => {
    const plan = planGroupMigration(input({ pinnedSessions: [{ id: 'sess-1', provider: 'opencode' }] }), ENV);
    expect(plan.status).toBe('migrate');
  });
});

describe('loadMigrationInputs', () => {
  beforeEach(async () => {
    await runMigrations(await initTestDb());
  });
  afterEach(async () => {
    await closeDb();
  });

  it('resolves each provider without a session pin and lists pinned active sessions', async () => {
    const at = new Date().toISOString();
    await createAgentGroup({ id: 'ag-a', name: 'a', folder: 'a', agent_provider: null, created_at: at });
    await ensureContainerConfig('ag-a', 'pi');
    await createAgentGroup({ id: 'ag-b', name: 'b', folder: 'b', agent_provider: 'codex', created_at: at });
    await ensureContainerConfig('ag-b', 'claude');
    await updateContainerConfigScalars('ag-b', { critic_model: 'openai/openai/gpt-6.1-sol' });
    for (const [id, status, pin] of [
      ['s-1', 'active', 'claude'],
      ['s-2', 'closed', 'claude'],
      ['s-3', 'active', null],
    ] as const) {
      await getDb().run(
        "INSERT INTO sessions (id, agent_group_id, status, container_status, agent_provider, created_at) VALUES (?, 'ag-b', ?, 'stopped', ?, ?)",
        id,
        status,
        pin,
        at,
      );
    }
    const inputs = await loadMigrationInputs();
    expect(inputs.find((i) => i.id === 'ag-a')).toMatchObject({ provider: 'pi', pinnedSessions: [] });
    expect(inputs.find((i) => i.id === 'ag-b')).toMatchObject({
      provider: 'codex',
      config: { critic_model: 'openai/openai/gpt-6.1-sol' },
      pinnedSessions: [{ id: 's-1', provider: 'claude' }],
    });
  });
});
