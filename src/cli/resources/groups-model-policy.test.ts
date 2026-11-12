import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../container-restart.js', () => ({ restartAgentGroupContainers: vi.fn().mockResolvedValue(0) }));
vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-cli-model-policy' };
});

const TEST_DIR = '/tmp/nanoclaw-test-cli-model-policy';

import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { ensureContainerConfig, getContainerConfig } from '../../db/container-configs.js';
import { dispatch } from '../dispatch.js';
import './groups.js';
import '../../provider-contracts/index.js';

// `ncl groups config update/get` and the per-group model policy
// (src/model-policy.ts): --weights open must be refused where spawn would refuse
// it, so the operator learns at the command, not at the group's next start.

const ENV = {
  ANTHROPIC_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/bedrock-claude-haiku-5-5',
  CODEX_MODEL: 'openai/openai/gpt-6.1-sol',
  OPENCODE_PROVIDER: 'openai',
  OPENCODE_MODEL: 'openai/aws/anthropic/bedrock-claude-opus-5-5',
};
const saved: Record<string, string | undefined> = {};

const update = (id: string, args: Record<string, unknown>) =>
  dispatch({ id: `u-${Math.random()}`, command: 'groups-config-update', args: { id, ...args } }, { caller: 'host' });
const get = async (id: string) => {
  const res = await dispatch(
    { id: `g-${Math.random()}`, command: 'groups-config-get', args: { id } },
    { caller: 'host' },
  );
  if (!res.ok) throw new Error(res.error.message);
  return res.data as Record<string, any>;
};
const message = (res: Awaited<ReturnType<typeof dispatch>>) => (res.ok ? undefined : res.error.message);

beforeEach(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  const at = new Date().toISOString();
  await createAgentGroup({ id: 'ag-claude', name: 'c', folder: 'c', agent_provider: null, created_at: at });
  await createAgentGroup({ id: 'ag-open', name: 'o', folder: 'o', agent_provider: 'opencode', created_at: at });
  await ensureContainerConfig('ag-claude');
  await ensureContainerConfig('ag-open');
});

afterEach(async () => {
  await closeDb();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('--weights open', () => {
  it('switches an OpenCode group to open models in one command, and config get shows each role', async () => {
    expect((await update('ag-open', { weights: 'open' })).ok).toBe(true);
    const cfg = await get('ag-open');
    expect(cfg.weights).toBe('open');
    expect(cfg.models).toEqual({
      main: { model: 'openai/nvidia/zai-org/glm-5.3', open_weights: true },
      small: { model: 'openai/nvidia/zai-org/glm-5.3-flash', open_weights: true },
      router: { model: 'nvidia/zai-org/glm-5.3-flash', open_weights: true },
      critic: { model: 'nvidia/moonshotai/kimi-k3', open_weights: true },
    });
  });

  it('is refused for a Claude group, with the command that fixes it, and writes nothing', async () => {
    const res = await update('ag-claude', { weights: 'open' });
    expect(res.ok).toBe(false);
    expect(message(res)).toContain('--agent-provider opencode');
    expect((await getContainerConfig('ag-claude'))!.weights).toBeNull();
  });

  it('refuses a closed model for a role of an open group and names the role', async () => {
    await update('ag-open', { weights: 'open' });
    const res = await update('ag-open', { critic_model: 'openai/openai/gpt-6.1-sol' });
    expect(res.ok).toBe(false);
    expect(message(res)).toBe('Model policy: critic model openai/openai/gpt-6.1-sol is not an open-weights model');
    expect((await update('ag-open', { critic_model: 'nvidia/deepseek-ai/deepseek-v4.1-flash-1017' })).ok).toBe(true);
  });

  it('clears with "any" and "" back to the install defaults', async () => {
    await update('ag-open', { weights: 'open', small_model: 'nvidia/zai-org/glm-5.3-flash' });
    expect((await update('ag-open', { weights: 'any', small_model: '' })).ok).toBe(true);
    const row = (await getContainerConfig('ag-open'))!;
    expect(row.weights).toBeNull();
    expect(row.small_model).toBeNull();
    expect((await get('ag-open')).models.main.model).toBe(ENV.OPENCODE_MODEL);
  });
});

it('refuses --router-model for a Claude group, whose router is its small model', async () => {
  const res = await update('ag-claude', { router_model: 'aws/anthropic/x' });
  expect(res.ok).toBe(false);
  expect(message(res)).toContain('--small-model');
});

it('rejects a weights value other than any or open', async () => {
  const res = await update('ag-open', { weights: 'closed' });
  expect(res.ok).toBe(false);
  expect(message(res)).toContain('weights must be');
});
