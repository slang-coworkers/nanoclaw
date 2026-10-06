/**
 * Overlay hook registration in the group's settings.json, driven through the
 * real `buildMounts` (which injects the hooks whenever DASHBOARD_PORT is set —
 * it defaults to 3737). Covers the Stop hook that holds a turn open while a PR
 * description explains an older head: registered once alongside the other
 * critique-gate hooks, idempotent across respawns, absent under
 * disable_overlays=1.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./claude-composer.js', () => ({ composeCoworkerSpine: vi.fn(() => ({ text: '', hash: '' })) }));
vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { DATA_DIR, GROUPS_DIR } from './config.js';
import type { ContainerConfig } from './container-config.js';
import { buildMounts, ensurePrDescriptionGate } from './container-runner.js';
import type { AgentGroup, Session } from './types.js';

const GROUP_ID = 'ag-overlay-hook-registration';
const FOLDER = 'overlay-hook-registration';
const SESSION_ID = 'sess-overlay-hook-registration';

const containerConfig = {
  mcpServers: {},
  packages: { apt: [], npm: [] },
  additionalMounts: [],
  skills: [],
} as unknown as ContainerConfig;

const groupDir = path.resolve(GROUPS_DIR, FOLDER);
const claudeShared = path.join(DATA_DIR, 'v2-sessions', GROUP_ID, '.claude-shared');
const settingsFile = path.join(claudeShared, 'settings.json');

beforeEach(() => {
  fs.mkdirSync(path.join(DATA_DIR, 'v2-sessions', GROUP_ID, SESSION_ID), { recursive: true });
  fs.mkdirSync(claudeShared, { recursive: true });
  fs.writeFileSync(settingsFile, '{}');
  fs.mkdirSync(groupDir, { recursive: true });
  fs.writeFileSync(path.join(groupDir, 'container.json'), '{}');
  fs.writeFileSync(path.join(groupDir, 'CLAUDE.md'), '# composed\n');
});

afterEach(() => {
  fs.rmSync(groupDir, { recursive: true, force: true });
  fs.rmSync(path.join(DATA_DIR, 'v2-sessions', GROUP_ID), { recursive: true, force: true });
});

type HookEntry = { matcher?: string; hooks?: Array<{ command?: string }> };

async function settingsAfterSpawn(group: Partial<AgentGroup> = {}): Promise<Record<string, HookEntry[]>> {
  const agentGroup = { id: GROUP_ID, name: 'Overlay Hooks', folder: FOLDER, ...group } as AgentGroup;
  const session = { id: SESSION_ID, agent_group_id: GROUP_ID, agent_provider: null } as Session;
  await buildMounts(agentGroup, session, containerConfig, 'claude', {});
  return (JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) as { hooks: Record<string, HookEntry[]> }).hooks;
}

const count = (entries: HookEntry[] | undefined, script: string): number =>
  (entries ?? []).filter((e) => e.hooks?.some((h) => h.command?.includes(script))).length;

describe('overlay hook registration', () => {
  it('registers gate-explain-on-stop.sh as a Stop hook next to the critique hooks, once', async () => {
    let hooks = await settingsAfterSpawn();
    expect(count(hooks.PostToolUse, 'track-critique.sh')).toBe(1);
    expect(count(hooks.Stop, 'gate-explain-on-stop.sh')).toBe(1);
    const entry = hooks.Stop.find((e) => e.hooks?.some((h) => h.command?.includes('gate-explain-on-stop.sh')));
    expect(entry?.hooks?.[0].command).toBe('bash /app/hooks/gate-explain-on-stop.sh');
    // Respawn: the hasCmd guard keeps it single.
    hooks = await settingsAfterSpawn();
    expect(count(hooks.Stop, 'gate-explain-on-stop.sh')).toBe(1);
  });

  it('registers gate-pr-description.sh as a PreToolUse Bash hook for every group, once', async () => {
    let hooks = await settingsAfterSpawn();
    expect(count(hooks.PreToolUse, 'gate-pr-description.sh')).toBe(1);
    const entry = hooks.PreToolUse.find((e) => e.hooks?.some((h) => h.command?.includes('gate-pr-description.sh')));
    expect(entry?.matcher).toBe('Bash');
    expect(entry?.hooks?.[0].command).toBe('bash /app/hooks/gate-pr-description.sh');
    hooks = await settingsAfterSpawn();
    expect(count(hooks.PreToolUse, 'gate-pr-description.sh')).toBe(1);
    // Not an overlay gate: a group with overlays disabled still keeps descriptions short.
    hooks = await settingsAfterSpawn({ disable_overlays: 1 });
    expect(count(hooks.PreToolUse, 'gate-pr-description.sh')).toBe(1);
  });

  it('registers the description gate without the dashboard hook block (DASHBOARD_PORT=0 path)', () => {
    // buildMounts calls ensurePrDescriptionGate outside the dashboard block; a bare
    // settings.json (what a group has when the dashboard hooks never ran) gets it.
    fs.writeFileSync(settingsFile, '{}');
    ensurePrDescriptionGate(settingsFile);
    ensurePrDescriptionGate(settingsFile);
    const hooks = (JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) as { hooks: Record<string, HookEntry[]> }).hooks;
    expect(count(hooks.PreToolUse, 'gate-pr-description.sh')).toBe(1);
    expect(hooks.PreToolUse[0]).toMatchObject({ matcher: 'Bash' });
  });

  it('is not registered when overlays are disabled for the group', async () => {
    const hooks = await settingsAfterSpawn({ disable_overlays: 1 });
    expect(count(hooks.Stop, 'gate-explain-on-stop.sh')).toBe(0);
    expect(count(hooks.PostToolUse, 'track-critique.sh')).toBe(0);
  });
});
