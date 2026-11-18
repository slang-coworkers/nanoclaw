// `ncl groups coworker-type set` switches an existing group's coworker type.
//
// The type decides the composed CLAUDE.md, the manifest's MCP servers and
// overlays, and the skill scope group-init mirrors (and prunes), so the verb
// prints a plan first and applies only with --yes. It refuses what a new group's
// type would be refused (immortal, flat, unresolvable), a type of another
// project, an admin group, a self-targeting agent, and a running session that is
// inside a turn. It never touches the explicit MCP allow-list or the group's
// standing instructions.

import fs from 'fs';
import path from 'path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-test-coworker-type-set';

const runner = vi.hoisted(() => ({ running: new Set<string>() }));
const restarts = vi.hoisted(() => ({ calls: [] as Array<{ id: string; reason: string }> }));

vi.mock('../../config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../config.js')>()),
  DATA_DIR: '/tmp/nanoclaw-test-coworker-type-set/data',
  GROUPS_DIR: '/tmp/nanoclaw-test-coworker-type-set/groups',
}));
vi.mock('../../container-runner.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../container-runner.js')>()),
  isContainerRunning: (id: string) => runner.running.has(id),
}));
vi.mock('../../container-restart.js', () => ({
  restartAgentGroupContainers: async (id: string, reason: string) => {
    restarts.calls.push({ id, reason });
    return 0;
  },
}));
vi.mock('../../log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { renderComposedDocument } from '../../container-runner.js';
import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { getAgentGroup, updateAgentGroup } from '../../db/agent-groups.js';
import { createSession } from '../../db/sessions.js';
import { sessionDir } from '../../session-manager.js';
import { dispatch } from '../dispatch.js';
import type { CallerContext } from '../frame.js';
import { drainPostResponseEffects } from '../post-response.js';
import './groups.js';

const HOST: CallerContext = { caller: 'host' };
const ALLOW = JSON.stringify(['mcp__slang-mcp__discord_read_messages', 'mcp__deepwiki__ask_question']);
const PREPEND = '# Group facts\n\nRepos: proj-a/main. Channel 123.\n';
const originalCwd = process.cwd();

const run = (args: Record<string, unknown>, ctx: CallerContext = HOST) =>
  dispatch({ id: `r-${Math.random()}`, command: 'groups-coworker-type-set', args }, ctx);
const data = (res: Awaited<ReturnType<typeof dispatch>>) => {
  if (!res.ok) throw new Error(res.error.message);
  return res.data as Record<string, any>;
};
const message = (res: Awaited<ReturnType<typeof dispatch>>) => (res.ok ? undefined : res.error.message);

function write(p: string, body: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

/** Two types of one project, one of another project, and a flat `main`. */
function buildProject(root: string): void {
  for (const name of ['base-nanoclaw', 'proj-a-writer', 'proj-a-maint', 'proj-b-tools']) {
    write(
      path.join(root, 'container', 'skills', name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: The ${name} skill.\n---\n\nBody.\n`,
    );
  }
  write(
    path.join(root, 'container', 'spines', 'base', 'invariants', 'code-changes.md'),
    'Write a failing test first.\n',
  );
  write(path.join(root, 'container', 'spines', 'base', 'invariants', 'no-push.md'), 'Never push or open PRs.\n');
  write(
    path.join(root, 'container', 'spines', 'base', 'coworker-types.yaml'),
    [
      'base-common:',
      '  description: "Shared base."',
      '  skills:',
      '    - base-nanoclaw',
      '',
      'proj-writer:',
      '  extends: base-common',
      '  project: proj-a',
      '  description: "Writes proj-a fixes as draft PRs."',
      '  invariants:',
      '    - container/spines/base/invariants/code-changes.md',
      '  skills:',
      '    - proj-a-writer',
      '',
      'proj-maintainer:',
      '  extends: base-common',
      '  project: proj-a',
      '  description: "Runs the proj-a maintainer sweeps; never pushes."',
      '  invariants:',
      '    - container/spines/base/invariants/no-push.md',
      '  skills:',
      '    - proj-a-maint',
      '',
      'proj-b-reader:',
      '  extends: base-common',
      '  project: proj-b',
      '  description: "Reads proj-b."',
      '  skills:',
      '    - proj-b-tools',
      '',
      'main:',
      '  flat: true',
      '  description: "Admin orchestrator."',
      '',
    ].join('\n') + '\n',
  );
}

async function addSession(id: string, agentGroupId: string): Promise<void> {
  await createSession({
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'running',
    last_active: null,
    created_at: new Date().toISOString(),
  });
}

/** Write a session heartbeat `ageMs` old. */
function heartbeat(agentGroupId: string, sessionId: string, ageMs: number): void {
  const file = path.join(sessionDir(agentGroupId, sessionId), '.heartbeat');
  write(file, '');
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(file, t, t);
}

beforeEach(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  buildProject(path.join(TEST_ROOT, 'project'));
  fs.mkdirSync(path.join(TEST_ROOT, 'data'), { recursive: true });
  await runMigrations(await initTestDb());
  process.chdir(path.join(TEST_ROOT, 'project'));
  runner.running.clear();
  restarts.calls.length = 0;

  const at = new Date().toISOString();
  await createAgentGroup({ id: 'ag-maint', name: 'Maint', folder: 'maint', agent_provider: null, created_at: at });
  await updateAgentGroup('ag-maint', { coworker_type: 'proj-writer', allowed_mcp_tools: ALLOW });
  write(path.join(TEST_ROOT, 'groups', 'maint', 'instructions.prepend.md'), PREPEND);
  await createAgentGroup({ id: 'ag-main', name: 'Main', folder: 'main', agent_provider: null, created_at: at });
  await updateAgentGroup('ag-main', { coworker_type: 'main' });
  await addSession('s-maint', 'ag-maint');
});

afterEach(async () => {
  process.chdir(originalCwd);
  await closeDb();
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterAll(() => process.chdir(originalCwd));

describe('groups coworker-type set: the plan', () => {
  it('shows what changes and leaves the group as it was', async () => {
    const res = data(await run({ id: 'ag-maint', type: 'proj-maintainer' }));
    expect(res.applied).toBe(false);
    const plan = res.plan;
    expect(plan.from).toBe('proj-writer');
    expect(plan.to).toBe('proj-maintainer');
    expect(plan.project).toEqual({ from: 'proj-a', to: 'proj-a' });
    expect(plan.skills).toEqual({ added: ['proj-a-maint'], removed: ['proj-a-writer'] });
    expect(plan.invariants).toEqual({ added: ['Never push or open PRs.'], removed: ['Write a failing test first.'] });
    expect(plan.document.to_hash).not.toBe(plan.document.from_hash);
    expect(plan.allow_list).toEqual({ state: 'explicit', unchanged: true });
    expect(plan.blockers).toEqual([]);
    expect((await getAgentGroup('ag-maint'))!.coworker_type).toBe('proj-writer');
    expect(restarts.calls).toEqual([]);
  });
});

describe('groups coworker-type set --yes: the apply', () => {
  it('switches the type, recomposes for the new type, and keeps the allow-list and standing instructions', async () => {
    const planned = data(await run({ id: 'ag-maint', type: 'proj-maintainer' })).plan;
    const res = data(await run({ id: 'ag-maint', type: 'proj-maintainer', yes: true }));
    expect(res.applied).toBe(true);

    const group = (await getAgentGroup('ag-maint'))!;
    expect(group.coworker_type).toBe('proj-maintainer');
    // The next spawn composes exactly the document the plan showed.
    const composed = await renderComposedDocument(group);
    expect(composed.hash).toBe(planned.document.to_hash);
    expect(composed.content).toContain('never pushes');
    expect(composed.content).toContain('Repos: proj-a/main. Channel 123.');
    // An explicit list is the only state that restricts; the switch must not reset it.
    expect(group.allowed_mcp_tools).toBe(ALLOW);
    expect(fs.readFileSync(path.join(TEST_ROOT, 'groups', 'maint', 'instructions.prepend.md'), 'utf-8')).toBe(PREPEND);
  });

  it('restarts the running containers of the group once the response is out', async () => {
    runner.running.add('s-maint');
    heartbeat('ag-maint', 's-maint', 10 * 60_000);
    const res = data(await run({ id: 'ag-maint', type: 'proj-maintainer', yes: true }));
    expect(res.containers_pending_restart).toEqual(['s-maint']);
    drainPostResponseEffects();
    expect(restarts.calls).toEqual([{ id: 'ag-maint', reason: 'coworker type changed' }]);
  });

  it('waits while a running session is inside a turn', async () => {
    runner.running.add('s-maint');
    heartbeat('ag-maint', 's-maint', 5_000);
    const plan = data(await run({ id: 'ag-maint', type: 'proj-maintainer' })).plan;
    expect(plan.busy_sessions).toEqual(['s-maint']);
    expect(message(await run({ id: 'ag-maint', type: 'proj-maintainer', yes: true }))).toMatch(/inside a turn/);
    expect((await getAgentGroup('ag-maint'))!.coworker_type).toBe('proj-writer');
  });
});

describe('groups coworker-type set: refusals', () => {
  it('refuses a type of another project', async () => {
    expect(message(await run({ id: 'ag-maint', type: 'proj-b-reader' }))).toMatch(/belongs to project "proj-b"/);
  });

  it('refuses a type that grants immortality or composes flat', async () => {
    expect(message(await run({ id: 'ag-maint', type: 'main' }))).toMatch(/immortality/);
  });

  it('refuses a type that does not resolve', async () => {
    expect(message(await run({ id: 'ag-maint', type: 'no-such-type' }))).toMatch(/does not resolve/);
  });

  it('refuses the type the group already has', async () => {
    expect(message(await run({ id: 'ag-maint', type: 'proj-writer' }))).toMatch(/already has coworker type/);
  });

  it('refuses an admin or immortal group', async () => {
    expect(message(await run({ id: 'ag-main', type: 'proj-writer' }))).toMatch(/not switchable/);
  });

  it('refuses an agent changing its own type', async () => {
    const self: CallerContext = { caller: 'agent', agentGroupId: 'ag-maint', sessionId: 's-maint' } as CallerContext;
    expect(message(await run({ id: 'ag-maint', type: 'proj-maintainer' }, self))).toBeDefined();
    expect((await getAgentGroup('ag-maint'))!.coworker_type).toBe('proj-writer');
  });
});
