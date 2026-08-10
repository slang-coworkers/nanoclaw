/**
 * Characterization tests for the per-group agent-runner copy.
 *
 * These do NOT verify a fix — they pin the behavior that IS the defect, so it
 * is stated in executable form rather than only in prose. `initGroupFilesystem`
 * creates `data/v2-sessions/<id>/agent-runner-src/` once and never refreshes it,
 * which is why `scripts/check-agent-runner-staleness.ts` has to exist. If
 * someone later makes the copy self-refreshing, the second test here fails and
 * forces a deliberate decision about the writable-mount / self-modification
 * contract rather than a silent change.
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
const REPO_SRC = path.join(process.cwd(), 'container', 'agent-runner', 'src');

function group(): AgentGroup {
  return {
    id: 'g1',
    name: 'g1',
    folder: 'g1',
    agent_provider: null,
    created_at: new Date().toISOString(),
  } as AgentGroup;
}

describe('per-group agent-runner copy — lifecycle', () => {
  beforeEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    fs.mkdirSync(path.join(TEST_ROOT, 'data'), { recursive: true });
    fs.mkdirSync(path.join(TEST_ROOT, 'groups'), { recursive: true });
    runMigrations(initTestDb());
    createAgentGroup(group());
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('creates the copy on first init', () => {
    initGroupFilesystem(group());
    expect(fs.existsSync(path.join(COPY, 'index.ts'))).toBe(true);
  });

  it('DOES NOT refresh it on a later init — this is the staleness defect', () => {
    initGroupFilesystem(group());

    // Simulate the group having been created before a fix landed: its copy of a
    // file is an older version than the repo's.
    const target = path.join(COPY, 'index.ts');
    fs.writeFileSync(target, '// pre-fix version\n');

    // initGroupFilesystem runs on EVERY wake (container-runner.ts calls it from
    // buildMounts). Skills and subagent mirrors are refreshed there; this is not.
    initGroupFilesystem(group());

    expect(fs.readFileSync(target, 'utf-8')).toBe('// pre-fix version\n');
    expect(fs.readFileSync(target, 'utf-8')).not.toBe(fs.readFileSync(path.join(REPO_SRC, 'index.ts'), 'utf-8'));
  });

  it('leaves files the group added alone', () => {
    initGroupFilesystem(group());
    // /add-opencode writes provider files directly into the overlay.
    const local = path.join(COPY, 'providers', 'local-only.ts');
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, 'local\n');

    initGroupFilesystem(group());

    expect(fs.readFileSync(local, 'utf-8')).toBe('local\n');
  });
});

/**
 * A documentation ratchet. Five docs described this mount as a shared,
 * read-only bind of `container/agent-runner/src/` — including docs/SECURITY.md,
 * which is the file a reader consults to learn what an agent can reach. The
 * code has never done that. Prose drifts silently; this makes the drift fail.
 */
describe('per-group agent-runner copy — the docs must not re-claim shared/read-only', () => {
  const CLAIMS: Array<[file: string, forbidden: RegExp]> = [
    ['CLAUDE.md', /agent-runner source is a shared read-only mount/],
    ['docs/SECURITY.md', /Shared agent-runner source \(same for all groups\)/],
    ['docs/hardened-image.md', /`\/app\/src` and `\/app\/skills` are read-only bind mounts/],
  ];

  for (const [file, forbidden] of CLAIMS) {
    it(`${file} no longer claims a shared read-only /app/src`, () => {
      const body = fs.readFileSync(path.join(process.cwd(), file), 'utf-8');
      expect(body).not.toMatch(forbidden);
    });
  }

  it('the mount is in fact writable in the code that creates it', () => {
    const runner = fs.readFileSync(path.join(process.cwd(), 'src', 'container-runner.ts'), 'utf-8');
    // If this ever becomes readonly:true, the docs above need revisiting and so
    // does the whole "never overwrite a local edit" premise of the checker.
    expect(runner).toMatch(/containerPath: '\/app\/src', readonly: false/);
  });
});
