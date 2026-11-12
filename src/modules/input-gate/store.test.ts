import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { listGateDecisions, recordGateDecision } from './store.js';
import type { GateDecision, GateRequest } from './types.js';

const req: GateRequest = {
  deliveryId: 'd-1',
  event: 'comment',
  repo: 'shader-slang/slang',
  number: 3,
  actor: { id: 101, login: 'alice', type: 'User', association: 'NONE' },
  startsWork: true,
};
const decision: GateDecision = {
  outcome: 'external_blocked',
  reason: 'not_allowlisted',
  tier: 'external',
  allowlist: { allowlisted: false, via: null, evidence: { association: 'NONE', rosterHit: false } },
  eligibility: null,
};

beforeEach(async () => {
  await runMigrations(await initTestDb());
});
afterEach(async () => {
  await closeDb();
});

describe('recordGateDecision', () => {
  it('appends one row with ids and evidence kinds only', async () => {
    expect(await recordGateDecision(req, decision, { mode: 'shadow', currentOutcome: 'local' })).toBe('recorded');
    const [row] = await listGateDecisions();
    expect(row).toMatchObject({
      delivery_id: 'd-1',
      mode: 'shadow',
      surface: 'github',
      event: 'comment',
      repo: 'shader-slang/slang',
      number: 3,
      actor_id: 101,
      actor_login: 'alice',
      actor_type: 'User',
      starts_work: 1,
      tier: 'external',
      tier_via: null,
      outcome: 'external_blocked',
      reason: 'not_allowlisted',
      current_outcome: 'local',
    });
    expect(JSON.parse(row.evidence)).toEqual({ association: 'NONE', rosterHit: false });
    expect(JSON.parse(row.eligibility)).toEqual({});
    expect(row.created_at).toMatch(/Z$/);
  });

  it('a redelivered or replayed delivery id is recorded once', async () => {
    await recordGateDecision(req, decision, { mode: 'shadow', currentOutcome: 'local' });
    expect(await recordGateDecision(req, decision, { mode: 'shadow', currentOutcome: 'local' })).toBe('duplicate');
    expect(await listGateDecisions()).toHaveLength(1);
  });

  it('a system event with no actor stores null actor fields', async () => {
    await recordGateDecision(
      { ...req, deliveryId: 'd-2', event: 'check_suite', actor: null, startsWork: false },
      { outcome: 'system_event', reason: null, tier: 'n/a', allowlist: null, eligibility: null },
      { mode: 'shadow', currentOutcome: 'local' },
    );
    const [row] = await listGateDecisions();
    expect(row).toMatchObject({ actor_id: null, actor_login: null, outcome: 'system_event', tier: 'n/a' });
  });

  it('returns unavailable when the table is missing, and never throws', async () => {
    await getDb().exec('DROP TABLE input_gate_decisions');
    expect(await recordGateDecision(req, decision, { mode: 'shadow', currentOutcome: 'local' })).toBe('unavailable');
  });
});
