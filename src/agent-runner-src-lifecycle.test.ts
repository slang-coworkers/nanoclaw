/**
 * Guards the /app/src mount contract: ONE shared, read-only bind of
 * `container/agent-runner/src` for every group.
 *
 * This file used to do the opposite — it CHARACTERIZED a per-group writable
 * copy, pinning the staleness defect in executable form and asserting the docs
 * did not claim shared/read-only. Its own header said that if someone changed
 * the copy's behaviour these tests should fail "and force a deliberate decision
 * about the writable-mount / self-modification contract rather than a silent
 * change". That decision has now been taken: the copy is gone.
 *
 * So the ratchet is INVERTED rather than deleted. The failure mode it exists to
 * catch is unchanged in kind — code and prose disagreeing about what an agent
 * can reach — only its direction has flipped. Deleting it would leave that
 * disagreement free to reappear silently, which is why the original was written.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-runner-src-lifecycle-test';

// Literals, not `${TEST_ROOT}` — vi.mock is hoisted above the const, so a
// reference here throws "Cannot access before initialization".
vi.mock('./config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config.js')>()),
  DATA_DIR: '/tmp/nanoclaw-runner-src-lifecycle-test/data',
  GROUPS_DIR: '/tmp/nanoclaw-runner-src-lifecycle-test/groups',
}));

vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { closeDb, createAgentGroup, initTestDb, runMigrations } from './db/index.js';
import { initGroupFilesystem } from './group-init.js';
import type { AgentGroup } from './types.js';

const COPY = path.join(TEST_ROOT, 'data', 'v2-sessions', 'g1', 'agent-runner-src');

function group(): AgentGroup {
  return {
    id: 'g1',
    name: 'g1',
    folder: 'g1',
    agent_provider: null,
    created_at: new Date().toISOString(),
  } as AgentGroup;
}

describe('agent-runner source — no per-group copy', () => {
  beforeEach(async () => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    fs.mkdirSync(path.join(TEST_ROOT, 'data'), { recursive: true });
    fs.mkdirSync(path.join(TEST_ROOT, 'groups'), { recursive: true });
    await runMigrations(await initTestDb());
    await createAgentGroup(group());
  });
  afterEach(async () => {
    await closeDb();
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('does not create one on first init', async () => {
    await initGroupFilesystem(group());
    expect(fs.existsSync(COPY)).toBe(false);
  });

  it('does not create one on a later init either', async () => {
    // initGroupFilesystem runs on EVERY wake (container-runner.ts calls it from
    // buildMounts), so "not on first init" alone would not prove much.
    await initGroupFilesystem(group());
    await initGroupFilesystem(group());
    expect(fs.existsSync(COPY)).toBe(false);
  });

  it('leaves a pre-existing copy from an older install untouched', async () => {
    // Rollback safety: the copies are no longer mounted, but they are somebody's
    // files and group-init does not own the decision to delete them.
    fs.mkdirSync(COPY, { recursive: true });
    const leftover = path.join(COPY, 'index.ts');
    fs.writeFileSync(leftover, '// from a pre-shared-mount install\n');

    await initGroupFilesystem(group());

    expect(fs.readFileSync(leftover, 'utf-8')).toBe('// from a pre-shared-mount install\n');
  });
});

/**
 * A documentation ratchet, pointed the other way.
 *
 * Before, several docs claimed a shared read-only mount the code did not
 * implement, and this asserted the CLAIM was absent. Now the code implements it,
 * so the same drift shows up as prose still describing a writable per-group
 * copy. Prose drifts silently in either direction; this makes it fail.
 */
describe('agent-runner source — the docs must not re-claim a writable per-group copy', () => {
  const FORBIDDEN: Array<[file: string, claim: RegExp]> = [
    ['CLAUDE.md', /bind-mounts the \*\*copy\*\* at `\/app\/src`, writable/],
    ['CLAUDE.md', /The copy is writable on purpose/],
    ['docs/hardened-image.md', /`\/app\/src` is a \*\*writable\*\* bind mount/],
  ];

  for (const [file, claim] of FORBIDDEN) {
    it(`${file} no longer describes a writable per-group /app/src`, () => {
      const body = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
      expect(body).not.toMatch(claim);
    });
  }

  it('the mount is in fact shared and read-only in the code that creates it', () => {
    const runner = fs.readFileSync(path.join(process.cwd(), 'src', 'container-runner.ts'), 'utf-8');
    // Matched across lines because the driver seam's `MountSpec` is a
    // multi-field object literal, not a single-line mount arg. Both halves
    // matter: `install-surface` is the class whose policy rule PINS ro
    // (src/mount-composition.test.ts), so asserting `readonly` alone would let a
    // later edit demote the class and keep the flag.
    expect(runner).toMatch(/containerPath: '\/app\/src',\s*\n\s*readonly: true,\s*\n\s*mountClass: 'install-surface',/);
  });

  it('group-init no longer copies the runner source per group', () => {
    const init = fs.readFileSync(path.join(process.cwd(), 'src', 'group-init.ts'), 'utf-8');
    expect(init).not.toMatch(/cpSync\([^)]*agentRunnerSrc/);
  });
});
