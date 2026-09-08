// Tier 2 scoped skills mirror: a typed coworker gets only its own resolved
// skills plus the always-on floor; an untyped (or flat `main`) group still
// gets everything.

import fs from 'fs';
import path from 'path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-group-init-skill-scope-test';

vi.mock('./config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config.js')>()),
  DATA_DIR: '/tmp/nanoclaw-group-init-skill-scope-test/data',
  GROUPS_DIR: '/tmp/nanoclaw-group-init-skill-scope-test/groups',
}));

vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

// The barrel every spawn loads, and with it claude's registered host contract.
// Surface mirroring must be independent of contract presence, so a test that
// leaves the registry empty cannot observe a contract-gated mirror.
import './provider-contracts/index.js';
import { resolveMirroredSkillScope } from './claude-composer.js';
import { closeDb, createAgentGroup, initTestDb, runMigrations } from './db/index.js';
import { initGroupFilesystem } from './group-init.js';
import type { AgentGroup } from './types.js';

const originalCwd = process.cwd();

// Every skill dir the fixture ships. `welcome` + `agent-browser` are explicit
// floor entries; `proj-a-extra` is reachable only through a workflow's
// `uses.skills`; `orphan-formatting` is claimed by nobody (the dynamic
// "unclaimed" tier), and `proj-b-tools` belongs to the other project.
const ALL_SKILLS = [
  'base-nanoclaw',
  'welcome',
  'agent-browser',
  'orphan-formatting',
  'proj-a-tools',
  'proj-a-extra',
  'proj-b-tools',
] as const;

const PROJ_A_SCOPE = ['agent-browser', 'base-nanoclaw', 'orphan-formatting', 'proj-a-extra', 'proj-a-tools', 'welcome'];

function write(p: string, body: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

function buildFixtureRoot(root: string): void {
  for (const name of ALL_SKILLS) {
    write(
      path.join(root, 'container', 'skills', name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: The ${name} skill.\n---\n\n# /${name}\n\nBody.\n`,
    );
  }

  // `agent.md` siblings: one in a skill the type gets, one in a skill it does
  // not, one in an overlay (overlays are group-selected, never type-scoped).
  for (const name of ['proj-a-tools', 'proj-b-tools']) {
    write(path.join(root, 'container', 'skills', name, 'agent.md'), `---\nname: ${name}\n---\n\nSubagent.\n`);
  }
  write(
    path.join(root, 'container', 'overlays', 'crit-overlay', 'OVERLAY.md'),
    '---\nname: crit-overlay\n---\n\nOverlay body.\n',
  );
  write(
    path.join(root, 'container', 'overlays', 'crit-overlay', 'agent.md'),
    '---\nname: crit-overlay\n---\n\nSubagent.\n',
  );

  write(
    path.join(root, 'container', 'workflows', 'proj-a-do', 'WORKFLOW.md'),
    `---\nname: proj-a-do\ndescription: Do the proj-a thing.\nuses:\n  skills: [proj-a-extra]\n---\n\n` +
      `# /proj-a-do\n\n## Steps\n\n1. **Work** {#work} — run \`/proj-a-extra\` then stop.\n`,
  );

  write(path.join(root, 'container', 'spines', 'base', 'invariants', 'principles.md'), '## Principles\n\nBe good.\n');
  write(
    path.join(root, 'container', 'spines', 'base', 'context', 'workspace.md'),
    '## Workspace\n\n/workspace/agent.\n',
  );

  write(
    path.join(root, 'container', 'spines', 'base', 'coworker-types.yaml'),
    [
      'base-common:',
      '  description: "Universal spine."',
      '  invariants:',
      '    - container/spines/base/invariants/principles.md',
      '  context:',
      '    - container/spines/base/context/workspace.md',
      '  skills:',
      '    - base-nanoclaw',
      '',
      'main:',
      '  flat: true',
      '  description: "Admin orchestrator."',
      '',
      'proj-a-reader:',
      '  extends: base-common',
      '  project: proj-a',
      '  description: "Reads proj-a."',
      '  workflows:',
      '    - proj-a-do',
      '  skills:',
      '    - proj-a-tools',
      '',
      'proj-b-reader:',
      '  extends: base-common',
      '  project: proj-b',
      '  description: "Reads proj-b."',
      '  skills:',
      '    - proj-b-tools',
      '',
    ].join('\n') + '\n',
  );
}

function makeGroup(id: string, coworkerType: string | null): AgentGroup {
  const ag = {
    id,
    name: id,
    folder: id,
    agent_provider: null,
    coworker_type: coworkerType,
    created_at: new Date().toISOString(),
  } as AgentGroup;
  createAgentGroup(ag);
  return ag;
}

function sharedDir(groupId: string, ...rest: string[]): string {
  return path.join(TEST_ROOT, 'data', 'v2-sessions', groupId, '.claude-shared', ...rest);
}

function mirroredSkills(groupId: string): string[] {
  const dir = sharedDir(groupId, 'skills');
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

function mirroredAgents(groupId: string): string[] {
  const dir = sharedDir(groupId, 'agents');
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

beforeEach(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  buildFixtureRoot(path.join(TEST_ROOT, 'project'));
  await runMigrations(await initTestDb());
  process.chdir(path.join(TEST_ROOT, 'project'));
});

afterEach(async () => {
  process.chdir(originalCwd);
  await closeDb();
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe('resolveMirroredSkillScope', () => {
  const root = path.join(TEST_ROOT, 'project');

  it('scopes a typed coworker to its own skills + the floor', () => {
    const scope = resolveMirroredSkillScope(root, 'proj-a-reader');
    expect(scope.degraded).toBe(false);
    expect(scope.dirs).not.toBeNull();
    // Own skill, workflow-`uses` skill, floor + unclaimed — never proj-b's.
    expect([...scope.dirs!].sort()).toEqual(PROJ_A_SCOPE);
  });

  it('returns null (mirror all) for an untyped group', () => {
    expect(resolveMirroredSkillScope(root, null).dirs).toBeNull();
    expect(resolveMirroredSkillScope(root, '').dirs).toBeNull();
    expect(resolveMirroredSkillScope(root, '   ').dirs).toBeNull();
  });

  it('returns null (mirror all) for a flat type like main', () => {
    const scope = resolveMirroredSkillScope(root, 'main');
    expect(scope.dirs).toBeNull();
    expect(scope.degraded).toBe(false);
  });

  it('fails open (mirror all, degraded) for an unknown type', () => {
    const scope = resolveMirroredSkillScope(root, 'does-not-exist');
    expect(scope.dirs).toBeNull();
    expect(scope.degraded).toBe(true);
  });
});

describe('initGroupFilesystem skills mirror', () => {
  it('mirrors only the scoped set for a typed group', async () => {
    const ag = makeGroup('ag-typed', 'proj-a-reader');
    await initGroupFilesystem(ag, {});

    expect(mirroredSkills(ag.id)).toEqual(PROJ_A_SCOPE);
    expect(mirroredSkills(ag.id)).not.toContain('proj-b-tools');
  });

  it('mirrors every skill for a null-coworker_type group', async () => {
    const ag = makeGroup('ag-untyped', null);
    await initGroupFilesystem(ag, {});

    expect(mirroredSkills(ag.id)).toEqual([...ALL_SKILLS].sort());
  });

  it('mirrors every skill for the flat main type', async () => {
    const ag = makeGroup('ag-main', 'main');
    await initGroupFilesystem(ag, {});

    expect(mirroredSkills(ag.id)).toEqual([...ALL_SKILLS].sort());
  });

  it('prunes an already-mirrored skill that is no longer in scope', async () => {
    // Simulate a group mirrored before scoping existed (or whose type changed).
    const ag = makeGroup('ag-prune', null);
    await initGroupFilesystem(ag, {});
    expect(mirroredSkills(ag.id)).toContain('proj-b-tools');

    const typed = { ...ag, coworker_type: 'proj-a-reader' } as AgentGroup;
    await initGroupFilesystem(typed, {});

    expect(mirroredSkills(ag.id)).not.toContain('proj-b-tools');
    expect(mirroredSkills(ag.id)).toContain('proj-a-tools');
  });
});

// The mirrors are this fork's own agent surfaces: a provider declaring a host
// contract (claude does) must not change what a coworker type gets. These
// assertions are on the resulting tree, not on how the branch is selected.
describe('initGroupFilesystem surfaces for a contract-declaring provider', () => {
  it('mirrors the type-scoped skills, their agents, and overlay agents', async () => {
    const ag = makeGroup('ag-claude-typed', 'proj-a-reader');
    await initGroupFilesystem(ag, { provider: 'claude' });

    expect(mirroredSkills(ag.id)).toEqual(PROJ_A_SCOPE);
    for (const name of PROJ_A_SCOPE) {
      const dir = sharedDir(ag.id, 'skills', name);
      expect(fs.lstatSync(dir).isDirectory()).toBe(true);
      expect(fs.existsSync(path.join(dir, 'SKILL.md'))).toBe(true);
    }
    // Overlay agents are group-selected, so one arrives regardless of type;
    // a skill's agent arrives only when the type gets the skill.
    expect(mirroredAgents(ag.id)).toEqual(['crit-overlay.md', 'proj-a-tools.md']);
  });

  it('prunes both the out-of-scope skill and its agent when the type changes', async () => {
    const ag = makeGroup('ag-claude-prune', null);
    await initGroupFilesystem(ag, { provider: 'claude' });
    expect(mirroredSkills(ag.id)).toContain('proj-b-tools');
    expect(mirroredAgents(ag.id)).toContain('proj-b-tools.md');

    await initGroupFilesystem({ ...ag, coworker_type: 'proj-a-reader' } as AgentGroup, { provider: 'claude' });

    expect(mirroredSkills(ag.id)).toEqual(PROJ_A_SCOPE);
    expect(mirroredAgents(ag.id)).toEqual(['crit-overlay.md', 'proj-a-tools.md']);
  });
});
