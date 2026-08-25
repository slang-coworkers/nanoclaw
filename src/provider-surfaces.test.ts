import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-provider-surfaces-test';
const GROUPS_DIR = path.join(TEST_ROOT, 'groups');
const DATA_DIR = path.join(TEST_ROOT, 'data');

vi.mock('./config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./config.js')>()),
  DATA_DIR: '/tmp/nanoclaw-provider-surfaces-test/data',
  GROUPS_DIR: '/tmp/nanoclaw-provider-surfaces-test/groups',
}));

vi.mock('./log.js', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

import { buildMounts } from './container-runner.js';
import { closeDb, createAgentGroup, initTestDb, runMigrations } from './db/index.js';
import { ensureContainerConfig } from './db/container-configs.js';
import { initGroupFilesystem } from './group-init.js';
import { registerProviderContainerConfig } from './providers/provider-container-registry.js';
import type { ContainerConfig } from './container-config.js';
import type { AgentGroup, Session } from './types.js';

// A provider that declares (at registration) that it owns its agent surfaces.
// Registered once — the registry is module-global and rejects duplicates.
registerProviderContainerConfig('surfaces-test-provider', () => ({}), { providesAgentSurfaces: true });

function group(id: string, folder: string): AgentGroup {
  return { id, name: folder, folder, agent_provider: null, created_at: new Date().toISOString() } as AgentGroup;
}

function session(id: string, agentGroupId: string): Session {
  return { id, agent_group_id: agentGroupId } as Session;
}

function containerConfig(): ContainerConfig {
  return { mcpServers: {}, packages: { apt: [], npm: [] }, additionalMounts: [], skills: [] };
}

beforeEach(async () => {
  vi.clearAllMocks();
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  await runMigrations(await initTestDb());
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('initGroupFilesystem agent surfaces', () => {
  it('writes the default surfaces when no provider is given (today’s behavior)', async () => {
    const ag = group('ag-default', 'default-group');
    await createAgentGroup(ag);

    await initGroupFilesystem(ag, { instructions: 'hello' });

    const groupDir = path.join(GROUPS_DIR, ag.folder);
    const claudeDir = path.join(DATA_DIR, 'v2-sessions', ag.id, '.claude-shared');
    // This fork seeds the instruction surface as `.instructions.md` (the lego
    // spine composes CLAUDE.md from templates + .instructions.md on each wake);
    // CLAUDE.local.md is the agent's own per-group memory, never host-seeded.
    expect(fs.readFileSync(path.join(groupDir, '.instructions.md'), 'utf-8')).toBe('hello\n');
    expect(fs.existsSync(path.join(claudeDir, 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(claudeDir, 'skills'))).toBe(true);
  });

  it('writes the seed into the memory scaffold — never CLAUDE.* — for a provider with its own surfaces', async () => {
    const ag = group('ag-surfy', 'surfy-group');
    await createAgentGroup(ag);

    await initGroupFilesystem(ag, { instructions: 'hello', provider: 'surfaces-test-provider' });

    const groupDir = path.join(GROUPS_DIR, ag.folder);
    const sessionRoot = path.join(DATA_DIR, 'v2-sessions', ag.id);
    expect(fs.existsSync(groupDir)).toBe(true);
    // A fresh group on a surfaces-owning provider must not contain stale
    // Claude surfaces; its seed lands in the scaffold's conventional file,
    // which the container-side scaffold preserves at boot.
    expect(fs.existsSync(path.join(groupDir, 'CLAUDE.local.md'))).toBe(false);
    expect(fs.readFileSync(path.join(groupDir, 'memory', 'memories', 'imported-agent-memory.md'), 'utf-8')).toBe(
      'hello\n',
    );
    expect(fs.existsSync(path.join(sessionRoot, '.claude-shared'))).toBe(false);
  });

  it('writes nothing at all for a surfaces-owning provider without instructions', async () => {
    const ag = group('ag-surfy-bare', 'surfy-bare-group');
    await createAgentGroup(ag);

    await initGroupFilesystem(ag, { provider: 'surfaces-test-provider' });

    const groupDir = path.join(GROUPS_DIR, ag.folder);
    expect(fs.existsSync(path.join(groupDir, 'CLAUDE.local.md'))).toBe(false);
    expect(fs.existsSync(path.join(groupDir, '.instructions.md'))).toBe(false);
    // No seed landed anywhere. (The empty memory/ dir is always scaffolded for
    // workflow writes regardless of provider; only the seed FILE matters here.)
    expect(fs.existsSync(path.join(groupDir, 'memory', 'memories', 'imported-agent-memory.md'))).toBe(false);
  });

  it('treats an unregistered provider name as default surfaces', async () => {
    const ag = group('ag-unknown', 'unknown-group');
    await createAgentGroup(ag);

    await initGroupFilesystem(ag, { provider: 'not-registered' });

    // Unregistered name → treated as default (Claude) surfaces: the per-group
    // Claude state dir is scaffolded. (No seed supplied, so the fork writes no
    // instruction file — "default surfaces taken" is observed via .claude-shared.)
    const claudeDir = path.join(DATA_DIR, 'v2-sessions', ag.id, '.claude-shared');
    expect(fs.existsSync(path.join(claudeDir, 'settings.json'))).toBe(true);
  });
});

describe('initGroupFilesystem deferred seed (.seed.md)', () => {
  // Creation is provider-agnostic: the DM-agent creators drop a neutral
  // `.seed.md` and defer placement to the first spawn, where the DB-resolved
  // provider is known. group-init places it into the right surface and
  // consumes it. Red-on-delete: if that placement is removed, these fail.
  it('places .seed.md into .instructions.md for the default provider, then consumes it', async () => {
    const ag = group('ag-seed-default', 'seed-default');
    await createAgentGroup(ag);
    const groupDir = path.join(GROUPS_DIR, ag.folder);
    fs.mkdirSync(groupDir, { recursive: true });
    fs.writeFileSync(path.join(groupDir, '.seed.md'), 'seeded identity\n');

    await initGroupFilesystem(ag, {}); // no inline instructions — must read .seed.md

    // Default provider → seed lands in .instructions.md (the fork's instruction surface).
    expect(fs.readFileSync(path.join(groupDir, '.instructions.md'), 'utf-8')).toBe('seeded identity\n');
    expect(fs.existsSync(path.join(groupDir, '.seed.md'))).toBe(false);
  });

  it('places .seed.md into the memory scaffold (never CLAUDE.*) for a surfaces-owning provider, then consumes it', async () => {
    const ag = group('ag-seed-surfy', 'seed-surfy');
    await createAgentGroup(ag);
    const groupDir = path.join(GROUPS_DIR, ag.folder);
    fs.mkdirSync(groupDir, { recursive: true });
    fs.writeFileSync(path.join(groupDir, '.seed.md'), 'seeded identity\n');

    await initGroupFilesystem(ag, { provider: 'surfaces-test-provider' });

    expect(fs.existsSync(path.join(groupDir, 'CLAUDE.local.md'))).toBe(false);
    expect(fs.readFileSync(path.join(groupDir, 'memory', 'memories', 'imported-agent-memory.md'), 'utf-8')).toBe(
      'seeded identity\n',
    );
    expect(fs.existsSync(path.join(groupDir, '.seed.md'))).toBe(false);
  });
});

describe('buildMounts agent surfaces', () => {
  it('mounts the default surfaces for an unregistered provider (today’s behavior)', async () => {
    const ag = group('ag-mounts-default', 'mounts-default');
    await createAgentGroup(ag);
    await ensureContainerConfig(ag.id);
    await initGroupFilesystem(ag, {});
    // This fork composes the project doc in spawnContainer (composeCoworkerClaudeMd),
    // not inside buildMounts. Simulate that spawn-time output on disk so buildMounts
    // has a composed CLAUDE.md to surface.
    fs.writeFileSync(path.join(GROUPS_DIR, ag.folder, 'CLAUDE.md'), '# composed\n');

    const mounts = await buildMounts(ag, session('s1', ag.id), containerConfig(), 'claude', {});

    const byContainerPath = new Map(mounts.map((m) => [m.containerPath, m]));
    expect(byContainerPath.has('/home/node/.claude')).toBe(true);
    expect(byContainerPath.has('/app/CLAUDE.md')).toBe(true);
    // The composed project doc is surfaced read-only at the agent workspace.
    expect(byContainerPath.has('/workspace/agent/CLAUDE.md')).toBe(true);
    expect(byContainerPath.get('/workspace/agent/CLAUDE.md')?.readonly).toBe(true);
  });

  it('suppresses the default surfaces and keeps contributed mounts for a surfaces-providing provider', async () => {
    const ag = group('ag-mounts-surfy', 'mounts-surfy');
    await createAgentGroup(ag);
    await ensureContainerConfig(ag.id);
    await initGroupFilesystem(ag, { provider: 'surfaces-test-provider' });

    const contributed = {
      mounts: [
        {
          hostPath: path.join(GROUPS_DIR, ag.folder),
          containerPath: '/workspace/agent/OWN-DOC.md',
          readonly: true,
        },
      ],
    };
    const mounts = await buildMounts(
      ag,
      session('s2', ag.id),
      containerConfig(),
      'surfaces-test-provider',
      contributed,
    );

    const containerPaths = mounts.map((m) => m.containerPath);
    expect(containerPaths).not.toContain('/home/node/.claude');
    expect(containerPaths).not.toContain('/app/CLAUDE.md');
    expect(containerPaths).not.toContain('/workspace/agent/CLAUDE.md');
    // Composer did NOT run for this group.
    expect(fs.existsSync(path.join(GROUPS_DIR, ag.folder, 'CLAUDE.md'))).toBe(false);
    // Core mounts and the provider's own contribution are intact.
    expect(containerPaths).toContain('/workspace');
    expect(containerPaths).toContain('/workspace/agent');
    expect(containerPaths).toContain('/app/src');
    expect(containerPaths).toContain('/workspace/agent/OWN-DOC.md');
  });
});
