/**
 * Builds of one agent group's image run one after another. Each build uses the package lists it
 * read when it started and a Dockerfile of its own, and only a pinning build writes the group's
 * `image_tag`.
 */
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { builds } = vi.hoisted(() => ({
  /** One entry per `docker build`: the Dockerfile it read, its path, and hooks that end it. */
  builds: [] as { dockerfile: string; file: string; finish: () => void; fail: (err: Error) => void }[],
}));

type ExecCallback = (err: Error | null, out?: { stdout: string; stderr: string }) => void;

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const nodeFs = await import('fs');
  const exec = (cmd: string, opts: unknown, cb?: ExecCallback) => {
    const done = (typeof opts === 'function' ? opts : cb) as ExecCallback;
    const file = / -f (\S+) /.exec(cmd)?.[1];
    if (!cmd.includes(' build ') || !file) {
      done(null, { stdout: '', stderr: '' });
      return;
    }
    builds.push({
      dockerfile: nodeFs.readFileSync(file, 'utf8'),
      file,
      finish: () => done(null, { stdout: '', stderr: '' }),
      fail: (err) => done(err),
    });
  };
  return { ...actual, exec };
});
vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  const root = `/tmp/nanoclaw-test-group-image-${process.pid}`;
  return { ...actual, DATA_DIR: `${root}/data`, GROUPS_DIR: `${root}/groups` };
});
vi.mock('./drivers/index.js', () => {
  const driver = { kind: 'fake', listSessions: async () => [], capabilities: () => ({ imageBuild: true }) };
  return { getSessionDriver: () => driver, isSessionEventsDriver: () => false };
});

import { CONTAINER_IMAGE_BASE, DATA_DIR } from './config.js';
import { buildAgentGroupImage, repairDerivedImage } from './container-runner.js';
import {
  ensureContainerConfig,
  getContainerConfig,
  updateContainerConfigJson,
  updateContainerConfigScalars,
} from './db/container-configs.js';
import { initTestDb, closeDb, runMigrations, createAgentGroup } from './db/index.js';

const DERIVED = `${CONTAINER_IMAGE_BASE}:ag-1`;

/** Wait until `n` builds have started. */
async function buildsStarted(n: number) {
  await vi.waitFor(() => expect(builds).toHaveLength(n));
}

beforeEach(async () => {
  builds.length = 0;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = await initTestDb();
  await runMigrations(db);
  await createAgentGroup({
    id: 'ag-1',
    name: 'Test Agent',
    folder: 'test-agent',
    agent_provider: null,
    created_at: new Date().toISOString(),
  });
  await ensureContainerConfig('ag-1');
  await updateContainerConfigJson('ag-1', 'packages_apt', ['jq']);
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(`/tmp/nanoclaw-test-group-image-${process.pid}`, { recursive: true, force: true });
});

describe('buildAgentGroupImage', () => {
  it('runs builds of one group in call order, each with the packages it read at its start', async () => {
    const first = buildAgentGroupImage('ag-1');
    await buildsStarted(1);
    await updateContainerConfigJson('ag-1', 'packages_apt', ['jq', 'ripgrep']);
    const second = buildAgentGroupImage('ag-1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(builds).toHaveLength(1);

    builds[0].finish();
    await first;
    await buildsStarted(2);
    expect(builds[0].dockerfile).not.toContain('ripgrep');
    expect(builds[1].dockerfile).toContain('ripgrep');
    expect(builds[1].file).not.toBe(builds[0].file);
    builds[1].finish();
    await second;
    expect(fs.existsSync(builds[0].file)).toBe(false);
    expect(fs.existsSync(builds[1].file)).toBe(false);
  });

  it('starts the next build of the group after a failed one', async () => {
    const first = buildAgentGroupImage('ag-1');
    await buildsStarted(1);
    const second = buildAgentGroupImage('ag-1');
    builds[0].fail(new Error('apt mirror down'));
    await expect(first).rejects.toThrow('apt mirror down');
    await buildsStarted(2);
    builds[1].finish();
    await expect(second).resolves.toBeUndefined();
  });

  it('pins the group by default; the wake-path repair leaves the pin as it is', async () => {
    await updateContainerConfigScalars('ag-1', { image_tag: 'registry.example/agent:custom' });
    const repair = repairDerivedImage('ag-1');
    await buildsStarted(1);
    builds[0].finish();
    await repair;
    expect((await getContainerConfig('ag-1'))?.image_tag).toBe('registry.example/agent:custom');

    const install = buildAgentGroupImage('ag-1');
    await buildsStarted(2);
    builds[1].finish();
    await install;
    expect((await getContainerConfig('ag-1'))?.image_tag).toBe(DERIVED);
  });
});
