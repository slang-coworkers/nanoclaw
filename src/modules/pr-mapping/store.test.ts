/**
 * `pr_session_mappings` writes are first-claim-wins.
 *
 * This file replaces a suite that asserted the opposite. It had a test called
 * "replaces an existing mapping (last-writer-wins)" — the vulnerability
 * written down as an expectation. The table routes GitHub webhooks, and both
 * writers take `repo`/`pr_number` from a message an agent composed, so
 * last-writer-wins meant any agent group could name any PR and capture its
 * traffic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { log } from '../../log.js';
import { claimPrMapping, overridePrMapping } from './store.js';

interface Row {
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
}

let db: ReturnType<typeof initTestDb>;

const OWNER = {
  repo: 'shader-slang/slang',
  prNumber: 100,
  ownerInstance: 'prod',
  agentGroupId: 'ag-fixer',
  sessionId: 'sess-fixer-1',
  threadId: null as string | null,
};

function read(repo = OWNER.repo, prNumber = OWNER.prNumber): Row | undefined {
  return db
    .prepare(
      'SELECT owner_instance, agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
    )
    .get(repo, prNumber) as Row | undefined;
}

beforeEach(() => {
  db = initTestDb();
  runMigrations(db);
});

afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
});

describe('the first claimant binds', () => {
  it('records a mapping when the PR is unclaimed', () => {
    const claim = claimPrMapping(db, OWNER);
    expect(claim.outcome).toBe('claimed');
    expect(claim.prior).toBeNull();
    expect(read()).toMatchObject({ owner_instance: 'prod', agent_group_id: 'ag-fixer', session_id: 'sess-fixer-1' });
  });
});

describe('a different claimant is refused, not applied', () => {
  beforeEach(() => {
    claimPrMapping(db, OWNER);
  });

  it('refuses a different agent group on the same instance and leaves the row alone', () => {
    const claim = claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-attacker', sessionId: 'sess-attacker' });
    expect(claim.outcome).toBe('rejected');
    expect(read()).toMatchObject({ agent_group_id: 'ag-fixer', session_id: 'sess-fixer-1' });
  });

  it('refuses a different instance too', () => {
    const claim = claimPrMapping(db, { ...OWNER, ownerInstance: 'lego', agentGroupId: 'ag-other' });
    expect(claim.outcome).toBe('rejected');
    expect(read()).toMatchObject({ owner_instance: 'prod', agent_group_id: 'ag-fixer' });
  });

  it('surfaces the refusal at ERROR, naming both claimants', () => {
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {});
    claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-attacker', sessionId: 'sess-attacker' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [msg, ctx] = spy.mock.calls[0] as [string, Record<string, unknown>];
    expect(msg).toMatch(/REJECTED/);
    expect(ctx.heldBy).toMatchObject({ agentGroup: 'ag-fixer' });
    expect(ctx.attemptedBy).toMatchObject({ agentGroup: 'ag-attacker' });
  });

  it('reports who holds it, so the caller can tell the agent something actionable', () => {
    const claim = claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-attacker' });
    if (claim.outcome !== 'rejected') throw new Error('expected rejection');
    expect(claim.prior.agent_group_id).toBe('ag-fixer');
    expect(claim.reason).toContain('ag-fixer');
  });

  it('is symmetric — a same-instance takeover is no quieter than a cross-instance one', () => {
    // The old code warned on an owner_instance flip and said nothing at all
    // about a sibling group on the same box, which is the likelier attack.
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {});
    claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-same-box' });
    claimPrMapping(db, { ...OWNER, ownerInstance: 'lego', agentGroupId: 'ag-other-box' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('the holder may refresh its own row', () => {
  it('follows the group to a new session — a container restart must not break routing', () => {
    claimPrMapping(db, OWNER);
    const claim = claimPrMapping(db, { ...OWNER, sessionId: 'sess-fixer-2', threadId: 'thread-9' });
    expect(claim.outcome).toBe('refreshed');
    expect(read()).toMatchObject({ agent_group_id: 'ag-fixer', session_id: 'sess-fixer-2', thread_id: 'thread-9' });
  });

  it('treats an identical re-claim as a no-op refresh, not a conflict', () => {
    claimPrMapping(db, OWNER);
    expect(claimPrMapping(db, OWNER).outcome).toBe('refreshed');
  });

  it('does not log an error when the holder refreshes', () => {
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {});
    claimPrMapping(db, OWNER);
    claimPrMapping(db, { ...OWNER, sessionId: 'sess-fixer-2' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('claims are scoped to one PR', () => {
  it('holding one PR grants nothing on another', () => {
    claimPrMapping(db, OWNER);
    const other = claimPrMapping(db, { ...OWNER, prNumber: 101, agentGroupId: 'ag-reviewer' });
    expect(other.outcome).toBe('claimed');
    expect(read(OWNER.repo, 101)).toMatchObject({ agent_group_id: 'ag-reviewer' });
  });

  it('the same PR number in a different repo is a different claim', () => {
    claimPrMapping(db, OWNER);
    const other = claimPrMapping(db, { ...OWNER, repo: 'shader-slang/slang-python', agentGroupId: 'ag-reviewer' });
    expect(other.outcome).toBe('claimed');
  });
});

describe('overridePrMapping is the deliberate correction path', () => {
  it('reassigns unconditionally and reports the previous holder', () => {
    claimPrMapping(db, OWNER);
    const { prior } = overridePrMapping(
      db,
      { ...OWNER, agentGroupId: 'ag-reviewer', sessionId: 'sess-reviewer' },
      'handed off after triage',
    );
    expect(prior).toMatchObject({ agent_group_id: 'ag-fixer' });
    expect(read()).toMatchObject({ agent_group_id: 'ag-reviewer', session_id: 'sess-reviewer' });
  });

  it('logs the reassignment with both sides and the stated reason', () => {
    const spy = vi.spyOn(log, 'warn').mockImplementation(() => {});
    claimPrMapping(db, OWNER);
    overridePrMapping(db, { ...OWNER, agentGroupId: 'ag-reviewer' }, 'handed off after triage');
    const call = spy.mock.calls.find(([m]) => String(m).includes('REASSIGNED'));
    expect(call).toBeDefined();
    const ctx = call![1] as Record<string, unknown>;
    expect(ctx.from).toMatchObject({ agentGroup: 'ag-fixer' });
    expect(ctx.to).toMatchObject({ agentGroup: 'ag-reviewer' });
    expect(ctx.reason).toBe('handed off after triage');
  });

  it('works on an unclaimed PR too, reporting no previous holder', () => {
    const { prior } = overridePrMapping(db, OWNER, 'seeding');
    expect(prior).toBeNull();
    expect(read()).toMatchObject({ agent_group_id: 'ag-fixer' });
  });
});
