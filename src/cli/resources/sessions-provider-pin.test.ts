import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runner = vi.hoisted(() => ({ running: new Set<string>(), killed: [] as string[] }));
vi.mock('../../container-runner.js', () => ({
  isContainerRunning: (id: string) => runner.running.has(id),
  killContainer: (id: string) => {
    runner.killed.push(id);
  },
}));
vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-cli-session-pin' };
});

const TEST_DIR = '/tmp/nanoclaw-test-cli-session-pin';

import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { ensureContainerConfig, updateContainerConfigScalars } from '../../db/container-configs.js';
import { createSession, getSession } from '../../db/sessions.js';
import { dispatch } from '../dispatch.js';
import type { CallerContext } from '../frame.js';
import { lookup } from '../registry.js';
import { installDefaultProvider } from '../../model-policy.js';
import './sessions.js';
import '../../providers/index.js';

// `ncl sessions update --provider` sets the session tier of the provider chain
// (session pin → group provider → container config → default) and checks it
// with the model policy spawn applies, so a pin spawn would refuse is refused
// at the command and never stored.

const ENV = {
  ANTHROPIC_MODEL: 'aws/anthropic/bedrock-claude-opus-5-5',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'aws/anthropic/bedrock-claude-haiku-5-5',
  CODEX_MODEL: 'openai/openai/gpt-6.1-sol',
  OPENCODE_PROVIDER: 'openai',
  OPENCODE_MODEL: 'openai/aws/anthropic/bedrock-claude-opus-5-5',
  NANOCLAW_SESSION_PRIVILEGE: 'off',
};
const saved: Record<string, string | undefined> = {};
const HOST: CallerContext = { caller: 'host' };

const run = (command: string, args: Record<string, unknown>, ctx: CallerContext = HOST) =>
  dispatch({ id: `r-${Math.random()}`, command, args }, ctx);
const pin = (id: string, provider: string, extra: Record<string, unknown> = {}, ctx?: CallerContext) =>
  run('sessions-update', { id, provider, ...extra }, ctx);
const data = (res: Awaited<ReturnType<typeof dispatch>>) => {
  if (!res.ok) throw new Error(res.error.message);
  return res.data as Record<string, any>;
};
const message = (res: Awaited<ReturnType<typeof dispatch>>) => (res.ok ? undefined : res.error.message);
const storedPin = async (id: string) => (await getSession(id))!.agent_provider;

async function addSession(id: string, agentGroupId: string, extra: { privilege?: 'open' | 'closed' } = {}) {
  await createSession({
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: new Date().toISOString(),
    ...extra,
  });
}

beforeEach(async () => {
  for (const [k, v] of Object.entries(ENV)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  runner.running.clear();
  runner.killed.length = 0;
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  const at = new Date().toISOString();
  await createAgentGroup({ id: 'ag-open', name: 'o', folder: 'o', agent_provider: 'opencode', created_at: at });
  await createAgentGroup({ id: 'ag-bare', name: 'b', folder: 'b', agent_provider: null, created_at: at });
  await ensureContainerConfig('ag-open');
  await ensureContainerConfig('ag-bare');
  await addSession('s-open', 'ag-open');
  await addSession('s-bare', 'ag-bare');
});

afterEach(async () => {
  await closeDb();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('sessions update --provider', () => {
  it('pins a session, and get/list show the pin and the provider it runs on', async () => {
    const res = data(await pin('s-open', 'codex'));
    expect(res).toMatchObject({
      agent_provider: 'codex',
      previous_pin: null,
      effective_provider: 'codex',
      provider_source: 'session',
    });
    expect(await storedPin('s-open')).toBe('codex');

    expect(data(await run('sessions-get', { id: 's-open' }))).toMatchObject({
      agent_provider: 'codex',
      effective_provider: 'codex',
      provider_source: 'session',
    });
    const listed = (await run('sessions-list', {})) as { ok: true; data: Record<string, unknown>[] };
    expect(listed.data.find((r) => r.id === 's-open')).toMatchObject({ effective_provider: 'codex' });
    expect(listed.data.find((r) => r.id === 's-bare')).toMatchObject({
      agent_provider: null,
      effective_provider: installDefaultProvider(),
      provider_source: 'default',
    });
  });

  it("clears the pin with '', and the session follows its group again", async () => {
    await pin('s-open', 'codex');
    const res = data(await pin('s-open', ''));
    expect(res).toMatchObject({
      agent_provider: null,
      previous_pin: 'codex',
      effective_provider: 'opencode',
      provider_source: 'group',
    });
    expect(await storedPin('s-open')).toBeNull();
  });

  it('shows the container config tier when the group has no provider of its own', async () => {
    await updateContainerConfigScalars('ag-bare', { provider: 'opencode' });
    expect(data(await run('sessions-get', { id: 's-bare' }))).toMatchObject({
      effective_provider: 'opencode',
      provider_source: 'config',
    });
  });

  it('refuses a provider this host does not register, and stores nothing', async () => {
    const res = await pin('s-open', 'gpt');
    expect(message(res)).toContain('Unknown provider "gpt"');
    expect(message(res)).toContain('opencode');
    expect(await storedPin('s-open')).toBeNull();
  });

  it('refuses a pin that would make a weights=open group call a closed model', async () => {
    await updateContainerConfigScalars('ag-open', { weights: 'open' });
    const res = await pin('s-open', 'claude');
    expect(res.ok).toBe(false);
    expect(message(res)).toMatch(/^Model policy refuses to pin session s-open to claude: it would run on claude, and /);
    expect(await storedPin('s-open')).toBeNull();
    // The group's own open provider is still allowed.
    expect((await pin('s-open', 'opencode')).ok).toBe(true);
  });

  it('refuses to clear a pin when the group provider would break the policy', async () => {
    // A weights=open group whose stored provider is Claude cannot start; its
    // session only runs because of its OpenCode pin.
    await updateContainerConfigScalars('ag-bare', { provider: 'claude', weights: 'open' });
    await pin('s-bare', 'opencode');
    const res = await pin('s-bare', '');
    expect(message(res)).toContain('Model policy refuses to clear the pin of session s-bare');
    expect(await storedPin('s-bare')).toBe('opencode');
  });

  it("checks the session's privilege the way spawn does when privilege is enforced", async () => {
    process.env.NANOCLAW_SESSION_PRIVILEGE = 'enforce';
    await addSession('s-closed', 'ag-open', { privilege: 'closed' });
    // An open session runs under weights=open even though the group row is `any`,
    // so it may not run on Claude; a closed session of the same group may.
    expect(message(await pin('s-open', 'claude'))).toContain('Model policy refuses to pin session s-open to claude');
    expect((await pin('s-closed', 'claude')).ok).toBe(true);
  });

  it("says the pin applies at the next spawn, and --restart stops only this session's container", async () => {
    runner.running.add('s-open');
    const later = await pin('s-open', 'codex');
    expect(data(later)).toMatchObject({ container_running: true, restarted: false });
    expect(later.ok && later.human).toContain("applies at the session's next spawn");
    expect(later.ok && later.human).toContain('--restart');
    expect(later.ok && later.human).toContain('ncl groups restart --id ag-open');
    expect(runner.killed).toEqual([]);

    const now = await pin('s-open', 'opencode', { restart: true });
    expect(data(now)).toMatchObject({ container_running: false, restarted: true });
    expect(now.ok && now.human).toContain('the next message starts it on opencode');
    expect(runner.killed).toEqual(['s-open']);
  });

  it('needs approval from an agent, like groups update, and hides other groups sessions', async () => {
    expect(lookup('sessions-update')?.access).toBe('approval');
    const agent: CallerContext = {
      caller: 'agent',
      sessionId: 's-bare',
      agentGroupId: 'ag-bare',
      messagingGroupId: 'mg',
    };
    const res = await pin('s-open', 'codex', {}, agent);
    expect(message(res)).toBe('session not found: s-open');
    expect(await storedPin('s-open')).toBeNull();
  });
});
