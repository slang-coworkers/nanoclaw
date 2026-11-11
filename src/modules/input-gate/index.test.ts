import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import {
  drainInputGate,
  observeGitHubDelivery,
  readGateSettings,
  scheduleGitHubObservation,
  setInputGateDepsForTest,
  type GateSettings,
} from './index.js';
import { listGateDecisions } from './store.js';

const shadow: GateSettings = { mode: 'shadow', rosterPath: '/nonexistent/roster.json', org: 'shader-slang' };
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
  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults to off, the default roster path and the shader-slang org', () => {
    delete process.env.NANOCLAW_INPUT_GATE;
    delete process.env.NANOCLAW_INPUT_GATE_ROSTER;
    delete process.env.NANOCLAW_INPUT_GATE_ORG;
    const s = readGateSettings();
    expect(s.mode).toBe('off');
    expect(s.rosterPath.endsWith('data/input-gate-roster.json')).toBe(true);
    expect(s.org).toBe('shader-slang');
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

  it('drainInputGate resolves at once when nothing is pending', async () => {
    await expect(drainInputGate()).resolves.toBeUndefined();
  });
});
