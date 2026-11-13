import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAgentGroup } from '../../db/agent-groups.js';
import { closeDb, initTestDb } from '../../db/connection.js';
import { ensureContainerConfig, updateContainerConfigScalars } from '../../db/container-configs.js';
import { runMigrations } from '../../db/migrations/index.js';
import { log } from '../../log.js';
import {
  drainInputGate,
  observeGitHubDelivery,
  readGateSettings,
  scheduleGitHubObservation,
  setInputGateDepsForTest,
  type GateSettings,
} from './index.js';
import { listGateDecisions } from './store.js';

const shadow: GateSettings = {
  mode: 'shadow',
  rosterPath: '/nonexistent/roster.json',
  org: 'shader-slang',
  repos: null,
  openLane: null,
};
const lookups = { repoPermission: vi.fn(async () => 'read'), orgMember: vi.fn(async () => false) };

const mention = JSON.stringify({
  action: 'created',
  repository: { full_name: 'shader-slang/slang' },
  issue: { number: 5 },
  comment: {
    body: 'Hey @nv-slang-bot fix it',
    user: { login: 'stranger', id: 55, type: 'User' },
    author_association: 'NONE',
  },
});

function observe(over: Partial<Parameters<typeof observeGitHubDelivery>[0]> = {}) {
  return observeGitHubDelivery({
    eventType: 'issue_comment',
    rawBody: mention,
    deliveryId: 'd-1',
    botMention: '@nv-slang-bot',
    currentOutcome: 'local',
    ...over,
  });
}

beforeEach(async () => {
  await runMigrations(await initTestDb());
  lookups.repoPermission.mockClear();
  lookups.orgMember.mockClear();
});
afterEach(async () => {
  setInputGateDepsForTest(null);
  await closeDb();
});

describe('observeGitHubDelivery', () => {
  it('is off by default: no lookup, no row', async () => {
    setInputGateDepsForTest({ settings: () => ({ ...shadow, mode: 'off' }), lookups });
    expect(await observe()).toBeNull();
    expect(lookups.repoPermission).not.toHaveBeenCalled();
    expect(await listGateDecisions()).toHaveLength(0);
  });

  it('in shadow mode, decides and records what routing did beside it', async () => {
    setInputGateDepsForTest({ settings: () => shadow, lookups });
    const d = await observe();
    expect(d).toMatchObject({ outcome: 'external_blocked', reason: 'not_allowlisted' });
    const [row] = await listGateDecisions();
    expect(row).toMatchObject({
      delivery_id: 'd-1',
      mode: 'shadow',
      outcome: 'external_blocked',
      current_outcome: 'local',
    });
  });

  it('a delivery forwarded to a peer is left for the peer to judge', async () => {
    setInputGateDepsForTest({ settings: () => shadow, lookups });
    expect(await observe({ currentOutcome: 'forwarded' })).toBeNull();
    expect(await observe({ currentOutcome: null })).toBeNull();
    expect(await listGateDecisions()).toHaveLength(0);
  });

  it('records open_lane for an allowlisted person who fails Check 2 when the lane is ready', async () => {
    await createAgentGroup({ id: 'ag-lane', name: 'lane', folder: 'lane', agent_provider: 'opencode', created_at: '' });
    await ensureContainerConfig('ag-lane', 'opencode');
    await updateContainerConfigScalars('ag-lane', { weights: 'open' });
    const member = { repoPermission: vi.fn(async () => 'read'), orgMember: vi.fn(async () => true) };
    setInputGateDepsForTest({ settings: () => ({ ...shadow, openLane: 'lane' }), lookups: member });
    expect(await observe()).toMatchObject({ outcome: 'open_lane', reason: 'not_linked', tier: 'allowlisted' });
    expect(await listGateDecisions()).toMatchObject([{ outcome: 'open_lane', reason: 'not_linked' }]);
  });

  it('an invalid lane keeps the person not eligible and warns once', async () => {
    const warn = vi.spyOn(log, 'warn');
    const member = { repoPermission: vi.fn(async () => 'read'), orgMember: vi.fn(async () => true) };
    setInputGateDepsForTest({ settings: () => ({ ...shadow, openLane: 'no-such-lane' }), lookups: member });
    expect(await observe({ deliveryId: 'd-a' })).toMatchObject({ outcome: 'not_eligible' });
    expect(await observe({ deliveryId: 'd-b' })).toMatchObject({ outcome: 'not_eligible' });
    const laneWarnings = warn.mock.calls.filter(
      ([msg]) => msg === 'input-gate: the open-weights lane cannot take work',
    );
    expect(laneWarnings).toEqual([
      [
        'input-gate: the open-weights lane cannot take work',
        { folder: 'no-such-lane', problem: 'no agent group has this folder' },
      ],
    ]);
    warn.mockRestore();
  });

  it('never rejects: malformed JSON resolves to null', async () => {
    setInputGateDepsForTest({ settings: () => shadow, lookups });
    await expect(observe({ rawBody: '{not json' })).resolves.toBeNull();
  });

  it('never rejects: a settings reader that throws resolves to null', async () => {
    setInputGateDepsForTest({
      settings: () => {
        throw new Error('boom');
      },
      lookups,
    });
    await expect(observe()).resolves.toBeNull();
  });
});

describe('readGateSettings', () => {
  const saved = { ...process.env };
  // readGateSettings also reads .env in the working directory. These tests run
  // in an empty directory, so the .env of the box (where the gate may be on)
  // cannot change their result.
  let dir: string;
  let cwd: { mockRestore(): void };
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'input-gate-env-'));
    cwd = vi.spyOn(process, 'cwd').mockReturnValue(dir);
  });
  afterEach(() => {
    process.env = { ...saved };
    cwd.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to off, the default roster path and the shader-slang org', () => {
    delete process.env.NANOCLAW_INPUT_GATE;
    delete process.env.NANOCLAW_INPUT_GATE_ROSTER;
    delete process.env.NANOCLAW_INPUT_GATE_ORG;
    delete process.env.NANOCLAW_INPUT_GATE_REPOS;
    delete process.env.NANOCLAW_INPUT_GATE_OPEN_LANE;
    const s = readGateSettings();
    expect(s.mode).toBe('off');
    expect(s.rosterPath.endsWith('data/input-gate-roster.json')).toBe(true);
    expect(s.org).toBe('shader-slang');
    expect(s.repos).toBeNull();
    expect(s.openLane).toBeNull();
  });

  it('reads the open-weights lane folder', () => {
    process.env.NANOCLAW_INPUT_GATE_OPEN_LANE = ' slang-open-lane ';
    expect(readGateSettings().openLane).toBe('slang-open-lane');
  });

  it('reads the protected repo list, dropping blanks', () => {
    process.env.NANOCLAW_INPUT_GATE_REPOS = ' shader-slang/slang, ,shader-slang/slangpy ';
    expect(readGateSettings().repos).toEqual(['shader-slang/slang', 'shader-slang/slangpy']);
  });

  it('reads the mode from .env when the environment does not set it', () => {
    delete process.env.NANOCLAW_INPUT_GATE;
    fs.writeFileSync(path.join(dir, '.env'), 'NANOCLAW_INPUT_GATE=shadow\n');
    expect(readGateSettings().mode).toBe('shadow');
  });

  it('only the exact value "shadow" turns it on', () => {
    process.env.NANOCLAW_INPUT_GATE = 'Shadow ';
    expect(readGateSettings().mode).toBe('shadow');
    process.env.NANOCLAW_INPUT_GATE = 'enforce';
    expect(readGateSettings().mode).toBe('off');
  });
});

describe('scheduleGitHubObservation', () => {
  it('starts after the caller returns, and drainInputGate waits for the row', async () => {
    const settings = vi.fn(() => shadow);
    setInputGateDepsForTest({ settings, lookups });
    scheduleGitHubObservation({
      eventType: 'issue_comment',
      rawBody: mention,
      deliveryId: 'd-sched',
      botMention: '@nv-slang-bot',
      currentOutcome: 'local',
    });
    expect(settings).not.toHaveBeenCalled();
    await drainInputGate();
    expect(await listGateDecisions()).toMatchObject([{ delivery_id: 'd-sched' }]);
  });

  it('drainInputGate also waits for an observation scheduled while it waits', async () => {
    setInputGateDepsForTest({ settings: () => shadow, lookups });
    const base = { eventType: 'issue_comment', rawBody: mention, botMention: '@nv-slang-bot', currentOutcome: 'local' };
    scheduleGitHubObservation({ ...base, deliveryId: 'd-first' });
    const drained = drainInputGate();
    scheduleGitHubObservation({ ...base, deliveryId: 'd-late' });
    await drained;
    expect((await listGateDecisions()).map((r) => r.delivery_id)).toEqual(['d-first', 'd-late']);
  });

  it('drainInputGate gives up after its budget, so shutdown is never held by a slow lookup', async () => {
    let unblock!: (v: string) => void;
    const hanging = {
      repoPermission: () => new Promise<string>((r) => (unblock = r)),
      orgMember: async () => false,
    };
    setInputGateDepsForTest({ settings: () => shadow, lookups: hanging });
    scheduleGitHubObservation({
      eventType: 'issue_comment',
      rawBody: mention,
      deliveryId: 'd-hang',
      botMention: '@nv-slang-bot',
      currentOutcome: 'local',
    });
    const t0 = Date.now();
    await drainInputGate(50);
    expect(Date.now() - t0).toBeLessThan(1000);

    unblock('read');
    await drainInputGate();
  });

  it('drainInputGate resolves at once when nothing is pending', async () => {
    await expect(drainInputGate()).resolves.toBeUndefined();
  });
});
