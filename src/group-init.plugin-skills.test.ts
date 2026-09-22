// A template's own skills must survive group-init. They are stamped into the
// SAME .claude-shared/skills directory that group-init mirrors
// container/skills into (templates/create-agent.ts:40-42), so both of
// group-init's destructive paths can reach them:
//
//   1. refreshMirror rm -rf's the destination and re-copies whenever the
//      catalog tree has a newer mtime — so a name collision is decided by
//      mtime, and losing means the template's skill is gone. This needs no
//      coworker_type: an untyped group mirrors ALL skills, which maximises the
//      collision surface. It is live in the shipped library — `welcome` exists
//      in container/skills AND in 2 of the 6 published templates
//      (lifestyle/family-assistant, media/journalist).
//   2. the out-of-scope prune deletes every entry the coworker type does not
//      claim, and a template's skills are never in the global catalog.
//
// The stamped plugin copy at groups/<folder>/plugins/<name>/skills/* is the
// ownership record, read through the same validation the stamp used.

import fs from 'fs';
import path from 'path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-group-init-plugin-skills-test';

vi.mock('./config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config.js')>()),
  DATA_DIR: '/tmp/nanoclaw-group-init-plugin-skills-test/data',
  GROUPS_DIR: '/tmp/nanoclaw-group-init-plugin-skills-test/groups',
}));

vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import './provider-contracts/index.js';
import { closeDb, createAgentGroup, initTestDb, runMigrations } from './db/index.js';
import { initGroupFilesystem } from './group-init.js';
import type { AgentGroup } from './types.js';

const originalCwd = process.cwd();

/** Catalog skills. `welcome` is the real-world collision with the template. */
const CATALOG_SKILLS = ['base-nanoclaw', 'welcome', 'agent-browser', 'proj-a-tools'] as const;

function write(p: string, body: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

function skillDoc(name: string, marker: string): string {
  return `---\nname: ${name}\ndescription: The ${name} skill.\n---\n\n# /${name}\n\n${marker}\n`;
}

function buildFixtureRoot(root: string): void {
  for (const name of CATALOG_SKILLS) {
    write(path.join(root, 'container', 'skills', name, 'SKILL.md'), skillDoc(name, 'CATALOG BODY'));
  }
  write(
    path.join(root, 'container', 'spines', 'base', 'coworker-types.yaml'),
    [
      'base-common:',
      '  description: "Shared base."',
      '  skills:',
      '    - base-nanoclaw',
      '',
      'proj-a-reader:',
      '  extends: base-common',
      '  project: proj-a',
      '  description: "Reads proj-a."',
      '  skills:',
      '    - proj-a-tools',
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

function sharedSkills(groupId: string, ...rest: string[]): string {
  return path.join(TEST_ROOT, 'data', 'v2-sessions', groupId, '.claude-shared', 'skills', ...rest);
}

/**
 * Stamp a template the way createAgentFromTemplate does: the whole plugin is
 * copied under groups/<folder>/plugins/<name>/ (the ownership record and
 * restamp baseline), and its skills are ALSO copied into the group's
 * .claude-shared/skills overlay.
 */
function stampTemplate(group: AgentGroup, pluginName: string, skills: Record<string, string>): void {
  const pluginRoot = path.join(TEST_ROOT, 'groups', group.folder, 'plugins', pluginName);
  write(path.join(pluginRoot, 'plugin.json'), JSON.stringify({ name: pluginName, version: '1.0.0' }));
  for (const [name, marker] of Object.entries(skills)) {
    write(path.join(pluginRoot, 'skills', name, 'SKILL.md'), skillDoc(name, marker));
    write(sharedSkills(group.id, name, 'SKILL.md'), skillDoc(name, marker));
  }
}

/** Make the catalog copy of `name` newer than everything already mirrored. */
function touchCatalogNewer(root: string, name: string): void {
  const future = new Date(Date.now() + 60_000);
  const file = path.join(root, 'container', 'skills', name, 'SKILL.md');
  fs.utimesSync(file, future, future);
  fs.utimesSync(path.dirname(file), future, future);
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

describe('group-init leaves plugin-owned skills alone', () => {
  it('does not overwrite a template skill whose name collides with a catalog skill', async () => {
    // The live shape: `welcome` ships in container/skills AND in the template.
    const group = makeGroup('ag-collide', null);
    stampTemplate(group, 'journalist', { welcome: 'TEMPLATE BODY' });
    touchCatalogNewer(path.join(TEST_ROOT, 'project'), 'welcome');

    await initGroupFilesystem(group);

    expect(fs.readFileSync(sharedSkills(group.id, 'welcome', 'SKILL.md'), 'utf-8')).toContain('TEMPLATE BODY');
  });

  it('does not prune a template skill that no coworker type claims', async () => {
    // Typing the group is what arms the prune: a template's skills are never in
    // the global catalog, so they are always "out of scope".
    const group = makeGroup('ag-pruned', 'proj-a-reader');
    stampTemplate(group, 'sdr', { 'sdr-agent': 'TEMPLATE BODY' });

    await initGroupFilesystem(group);

    expect(fs.existsSync(sharedSkills(group.id, 'sdr-agent', 'SKILL.md'))).toBe(true);
  });

  it('still prunes a stale catalog skill the type does not claim', async () => {
    // The prune must keep doing its job for genuinely orphaned catalog mirrors —
    // protecting plugin skills must not become "never prune anything".
    const group = makeGroup('ag-stale', 'proj-a-reader');
    write(sharedSkills(group.id, 'proj-b-leftover', 'SKILL.md'), skillDoc('proj-b-leftover', 'STALE'));

    await initGroupFilesystem(group);

    expect(fs.existsSync(sharedSkills(group.id, 'proj-b-leftover'))).toBe(false);
  });

  it('protects only validated plugin skills, not any directory under plugins/', async () => {
    // The stamp copies the WHOLE plugin dir, which can contain a skills/ child
    // that never passed validation (no SKILL.md). Deriving ownership by raw
    // enumeration would protect a stale mirror of the same name.
    const group = makeGroup('ag-invalid', 'proj-a-reader');
    const pluginRoot = path.join(TEST_ROOT, 'groups', group.folder, 'plugins', 'broken');
    write(path.join(pluginRoot, 'plugin.json'), JSON.stringify({ name: 'broken', version: '1.0.0' }));
    fs.mkdirSync(path.join(pluginRoot, 'skills', 'not-a-skill'), { recursive: true });
    write(sharedSkills(group.id, 'not-a-skill', 'README.md'), 'no SKILL.md — never a valid skill');

    await initGroupFilesystem(group);

    expect(fs.existsSync(sharedSkills(group.id, 'not-a-skill'))).toBe(false);
  });
});
