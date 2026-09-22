// A template may declare which coworker type it wants to be composed as, and
// the effective value must be validated BEFORE any group state exists.
//
// Two strictnesses, decided by who supplied the value:
//   - an explicit operator `--coworker-type` that does not resolve is a hard
//     failure; they asked for something specific.
//   - a template's own hint that does not resolve is a warning and an untyped
//     stamp; a template author cannot know this install's catalog, and the
//     template's content is still perfectly usable without the composition.
//
// A type resolving to `flat` is rejected from either source: container-config
// documents `is_admin` OR `coworker_type === 'main'` as the authoritative
// immortality check for cost-cap money-safety, and `flat` can be INHERITED by a
// compound type, so a string comparison against 'main' is bypassable.

import fs from 'fs';
import path from 'path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-typed-template-test';

vi.mock('../config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../config.js')>()),
  DATA_DIR: '/tmp/nanoclaw-typed-template-test/data',
  GROUPS_DIR: '/tmp/nanoclaw-typed-template-test/groups',
  TEMPLATES_DIR: '/tmp/nanoclaw-typed-template-test/templates',
}));

vi.mock('../log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { closeDb, initTestDb, runMigrations } from '../db/index.js';
import { log } from '../log.js';
import { FORK_EXTENSION_NS, readForkExtension } from './fork-extension.js';
import { createAgentFromTemplate } from './create-agent.js';

const originalCwd = process.cwd();

function write(p: string, body: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

/** A minimal plugin. `forkExt` lands under our own extension namespace. */
function makeTemplate(ref: string, forkExt?: Record<string, unknown>): void {
  const dir = path.join(TEST_ROOT, 'templates', ref);
  const manifest: Record<string, unknown> = { name: path.basename(ref), version: '1.0.0' };
  const extensions: Record<string, unknown> = { 'ai.nanoco.nanoclaw': { agentName: `The ${path.basename(ref)}` } };
  if (forkExt) extensions[FORK_EXTENSION_NS] = forkExt;
  manifest.extensions = extensions;
  write(path.join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2));
  write(path.join(dir, 'ai.nanoco.nanoclaw', 'context', 'instructions.md'), 'You are a test agent.\n');
}

/** Catalog with one real type, one flat type, and one compound-inheriting-flat. */
function buildFixtureRoot(root: string): void {
  for (const name of ['base-nanoclaw', 'proj-a-tools']) {
    write(
      path.join(root, 'container', 'skills', name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: The ${name} skill.\n---\n\nBody.\n`,
    );
  }
  write(
    path.join(root, 'container', 'spines', 'base', 'coworker-types.yaml'),
    [
      'base-common:',
      '  description: "Shared base."',
      '  skills:',
      '    - base-nanoclaw',
      '',
      'nanoclaw-writer:',
      '  extends: base-common',
      '  project: proj-a',
      '  description: "Writes proj-a."',
      '  skills:',
      '    - proj-a-tools',
      '',
      'main:',
      '  flat: true',
      '  description: "Admin orchestrator."',
      '',
      'inherits-flat:',
      '  extends: main',
      '  description: "Inherits flat from main."',
      '',
    ].join('\n') + '\n',
  );
}

beforeEach(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  buildFixtureRoot(path.join(TEST_ROOT, 'project'));
  await runMigrations(await initTestDb());
  process.chdir(path.join(TEST_ROOT, 'project'));
  vi.mocked(log.warn).mockClear();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await closeDb();
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

afterAll(() => {
  process.chdir(originalCwd);
});

describe('readForkExtension', () => {
  it('reads defaultCoworkerType from the fork namespace', () => {
    expect(readForkExtension({ [FORK_EXTENSION_NS]: { defaultCoworkerType: 'nanoclaw-writer' } })).toEqual({
      defaultCoworkerType: 'nanoclaw-writer',
      report: [],
    });
  });

  it('ignores the namespace entirely when absent — a plain upstream plugin', () => {
    expect(readForkExtension({ 'ai.nanoco.nanoclaw': { agentName: 'x' } })).toEqual({ report: [] });
  });

  it('reports a non-string value rather than stamping it', () => {
    const got = readForkExtension({ [FORK_EXTENSION_NS]: { defaultCoworkerType: 42 } });
    expect(got.defaultCoworkerType).toBeUndefined();
    expect(got.report).toHaveLength(1);
  });

  it('reports unrecognized keys so a typo is never silent', () => {
    const got = readForkExtension({ [FORK_EXTENSION_NS]: { defualtCoworkerType: 'oops' } });
    expect(got.defaultCoworkerType).toBeUndefined();
    expect(got.report.join(' ')).toContain('defualtCoworkerType');
  });
});

describe('createAgentFromTemplate — coworker type', () => {
  it('stamps untyped when the template says nothing (upstream parity)', async () => {
    makeTemplate('plain');
    const { group } = await createAgentFromTemplate('plain');
    expect(group.coworker_type).toBeNull();
  });

  it("adopts the template's declared type", async () => {
    makeTemplate('typed', { defaultCoworkerType: 'nanoclaw-writer' });
    const { group } = await createAgentFromTemplate('typed');
    expect(group.coworker_type).toBe('nanoclaw-writer');
  });

  it('lets an explicit option override the template', async () => {
    makeTemplate('typed', { defaultCoworkerType: 'nanoclaw-writer' });
    const { group } = await createAgentFromTemplate('typed', { coworkerType: 'base-common' });
    expect(group.coworker_type).toBe('base-common');
  });

  it('honours an explicit opt-out of the template hint', async () => {
    makeTemplate('typed', { defaultCoworkerType: 'nanoclaw-writer' });
    const { group } = await createAgentFromTemplate('typed', { coworkerType: null });
    expect(group.coworker_type).toBeNull();
  });

  it('degrades a template hint this install cannot resolve to an untyped stamp', async () => {
    // The author cannot know our catalog. The content is still usable.
    makeTemplate('typed', { defaultCoworkerType: 'not-installed-here' });
    const { group, report } = await createAgentFromTemplate('typed');
    expect(group.coworker_type).toBeNull();
    expect(report.join(' ')).toContain('not-installed-here');
  });

  it('HARD FAILS an explicit option that does not resolve, creating nothing', async () => {
    makeTemplate('plain');
    await expect(createAgentFromTemplate('plain', { coworkerType: 'nope' })).rejects.toThrow(/nope/);
    // Nothing half-created: no group dir was left behind.
    expect(fs.existsSync(path.join(TEST_ROOT, 'groups', 'plain'))).toBe(false);
  });

  it('rejects a flat type from an explicit option — cost-cap immortality', async () => {
    makeTemplate('plain');
    await expect(createAgentFromTemplate('plain', { coworkerType: 'main' })).rejects.toThrow(/flat/i);
  });

  it('rejects a type that INHERITS flat, which a string check on "main" would miss', async () => {
    makeTemplate('plain');
    await expect(createAgentFromTemplate('plain', { coworkerType: 'inherits-flat' })).rejects.toThrow(/flat/i);
  });

  it('degrades rather than throws when the TEMPLATE declares a flat type', async () => {
    // Same rejection, hint strictness: a published template must not be able to
    // hard-fail a stamp, but must never obtain immortality either.
    makeTemplate('flatty', { defaultCoworkerType: 'main' });
    const { group, report } = await createAgentFromTemplate('flatty');
    expect(group.coworker_type).toBeNull();
    expect(report.join(' ')).toMatch(/flat/i);
  });
});
