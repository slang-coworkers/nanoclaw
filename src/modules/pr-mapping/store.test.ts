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
import type { DbDriver } from '../../db/driver.js';
import { sqliteRaw } from '../../db/drivers/sqlite.js';
import { runMigrations } from '../../db/migrations/index.js';
import { log } from '../../log.js';
import { claimPrMapping, overridePrMapping } from './store.js';

interface Row {
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
}

let db: DbDriver;

const OWNER = {
  repo: 'shader-slang/slang',
  prNumber: 100,
  ownerInstance: 'prod',
  agentGroupId: 'ag-fixer',
  sessionId: 'sess-fixer-1',
  threadId: null as string | null,
};

async function read(repo = OWNER.repo, prNumber = OWNER.prNumber): Promise<Row | undefined> {
  return db.get<Row>(
    'SELECT owner_instance, agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
    repo,
    prNumber,
  );
}

beforeEach(async () => {
  db = await initTestDb();
  await runMigrations(db);
});

afterEach(async () => {
  await closeDb();
  vi.restoreAllMocks();
});

describe('the first claimant binds', () => {
  it('records a mapping when the PR is unclaimed', async () => {
    const claim = await claimPrMapping(db, OWNER);
    expect(claim.outcome).toBe('claimed');
    expect(claim.prior).toBeNull();
    expect(await read()).toMatchObject({
      owner_instance: 'prod',
      agent_group_id: 'ag-fixer',
      session_id: 'sess-fixer-1',
    });
  });
});

describe('a different claimant is refused, not applied', () => {
  beforeEach(async () => {
    await claimPrMapping(db, OWNER);
  });

  it('refuses a different agent group on the same instance and leaves the row alone', async () => {
    const claim = await claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-attacker', sessionId: 'sess-attacker' });
    expect(claim.outcome).toBe('rejected');
    expect(await read()).toMatchObject({ agent_group_id: 'ag-fixer', session_id: 'sess-fixer-1' });
  });

  it('refuses a different instance too', async () => {
    const claim = await claimPrMapping(db, { ...OWNER, ownerInstance: 'lego', agentGroupId: 'ag-other' });
    expect(claim.outcome).toBe('rejected');
    expect(await read()).toMatchObject({ owner_instance: 'prod', agent_group_id: 'ag-fixer' });
  });

  it('surfaces the refusal at ERROR, naming both claimants', async () => {
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {});
    await claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-attacker', sessionId: 'sess-attacker' });
    expect(spy).toHaveBeenCalledTimes(1);
    const [msg, ctx] = spy.mock.calls[0] as [string, Record<string, unknown>];
    expect(msg).toMatch(/REJECTED/);
    expect(ctx.heldBy).toMatchObject({ agentGroup: 'ag-fixer' });
    expect(ctx.attemptedBy).toMatchObject({ agentGroup: 'ag-attacker' });
  });

  it('reports who holds it, so the caller can tell the agent something actionable', async () => {
    const claim = await claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-attacker' });
    if (claim.outcome !== 'rejected') throw new Error('expected rejection');
    expect(claim.prior.agent_group_id).toBe('ag-fixer');
    expect(claim.reason).toContain('ag-fixer');
  });

  it('is symmetric — a same-instance takeover is no quieter than a cross-instance one', async () => {
    // The old code warned on an owner_instance flip and said nothing at all
    // about a sibling group on the same box, which is the likelier attack.
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {});
    await claimPrMapping(db, { ...OWNER, agentGroupId: 'ag-same-box' });
    await claimPrMapping(db, { ...OWNER, ownerInstance: 'lego', agentGroupId: 'ag-other-box' });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('the holder may refresh its own row', () => {
  it('follows the group to a new session — a container restart must not break routing', async () => {
    await claimPrMapping(db, OWNER);
    const claim = await claimPrMapping(db, { ...OWNER, sessionId: 'sess-fixer-2', threadId: 'thread-9' });
    expect(claim.outcome).toBe('refreshed');
    expect(await read()).toMatchObject({
      agent_group_id: 'ag-fixer',
      session_id: 'sess-fixer-2',
      thread_id: 'thread-9',
    });
  });

  it('treats an identical re-claim as a no-op refresh, not a conflict', async () => {
    await claimPrMapping(db, OWNER);
    expect((await claimPrMapping(db, OWNER)).outcome).toBe('refreshed');
  });

  it('does not log an error when the holder refreshes', async () => {
    const spy = vi.spyOn(log, 'error').mockImplementation(() => {});
    await claimPrMapping(db, OWNER);
    await claimPrMapping(db, { ...OWNER, sessionId: 'sess-fixer-2' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('claims are scoped to one PR', () => {
  it('holding one PR grants nothing on another', async () => {
    await claimPrMapping(db, OWNER);
    const other = await claimPrMapping(db, { ...OWNER, prNumber: 101, agentGroupId: 'ag-reviewer' });
    expect(other.outcome).toBe('claimed');
    expect(await read(OWNER.repo, 101)).toMatchObject({ agent_group_id: 'ag-reviewer' });
  });

  it('the same PR number in a different repo is a different claim', async () => {
    await claimPrMapping(db, OWNER);
    const other = await claimPrMapping(db, {
      ...OWNER,
      repo: 'shader-slang/slang-python',
      agentGroupId: 'ag-reviewer',
    });
    expect(other.outcome).toBe('claimed');
  });
});

/**
 * `ensureThreadIdNullable` relaxes `thread_id NOT NULL` in place.
 *
 * Not a legacy-install concern: migration 923 declares the column NOT NULL and
 * nothing since relaxes it, so a freshly migrated table IS the pre-relaxation
 * shape and this recreate runs on the first claim of every install. Every
 * threadId-null claim above depends on it.
 *
 * Asserted because the port had to replace the probe that drove it —
 * `PRAGMA table_info(...).notnull` is unavailable through the async DbDriver,
 * so it now offers the engine a NULL and reads the refusal. That probe writing
 * for real, or answering "already nullable" when it is not, are both silent
 * failures of a path the rest of the suite only exercises incidentally.
 */
describe('the NOT NULL thread_id column is relaxed in place', () => {
  const SEEDED = { repo: 'shader-slang/slang', prNumber: 900 };

  function threadIdNotNull(): number | undefined {
    return (
      sqliteRaw(db).prepare('PRAGMA table_info(pr_session_mappings)').all() as Array<{
        name: string;
        notnull: number;
      }>
    ).find((c) => c.name === 'thread_id')?.notnull;
  }

  beforeEach(async () => {
    // Seed through raw SQL so the recreate has a pre-existing row to carry, and
    // so the migrated NOT NULL shape is asserted rather than assumed.
    expect(threadIdNotNull()).toBe(1);
    await db.run(
      `INSERT INTO pr_session_mappings
       (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
       VALUES (?, ?, 'ag-seeded', 'sess-seeded', 'thread-seeded', ?, 'prod')`,
      SEEDED.repo,
      SEEDED.prNumber,
      new Date().toISOString(),
    );
  });

  it('accepts a claim carrying a null thread_id, having recreated the table', async () => {
    const claim = await claimPrMapping(db, { ...OWNER, threadId: null });
    expect(claim.outcome).toBe('claimed');
    expect(threadIdNotNull()).toBe(0);
    expect(await read()).toMatchObject({ agent_group_id: 'ag-fixer', thread_id: null });
  });

  it('carries the existing rows across, and drops the scratch table', async () => {
    await claimPrMapping(db, { ...OWNER, threadId: null });
    expect(await read(SEEDED.repo, SEEDED.prNumber)).toMatchObject({
      agent_group_id: 'ag-seeded',
      session_id: 'sess-seeded',
      thread_id: 'thread-seeded',
      owner_instance: 'prod',
    });
    expect(await db.all("SELECT name FROM sqlite_master WHERE name LIKE '\\_pr\\_session%' ESCAPE '\\'")).toEqual([]);
  });

  it('rebuilds both lookup indexes', async () => {
    await claimPrMapping(db, { ...OWNER, threadId: null });
    const names = (
      sqliteRaw(db).prepare('PRAGMA index_list(pr_session_mappings)').all() as Array<{ name: string }>
    ).map((i) => i.name);
    expect(names).toContain('idx_pr_map_lookup');
    expect(names).toContain('idx_pr_map_owner');
  });

  it('leaves no trace of the null probe, before or after the recreate', async () => {
    await claimPrMapping(db, { ...OWNER, threadId: null });
    // The second call probes the already-relaxed table — the branch where the
    // probe INSERT SUCCEEDS, and the rollback is the only thing undoing it.
    await claimPrMapping(db, { ...OWNER, prNumber: 901, threadId: null });
    expect(await db.all("SELECT repo FROM pr_session_mappings WHERE session_id = 'null-probe'")).toEqual([]);
  });
});

describe('overridePrMapping is the deliberate correction path', () => {
  it('reassigns unconditionally and reports the previous holder', async () => {
    await claimPrMapping(db, OWNER);
    const { prior } = await overridePrMapping(
      db,
      { ...OWNER, agentGroupId: 'ag-reviewer', sessionId: 'sess-reviewer' },
      'handed off after triage',
    );
    expect(prior).toMatchObject({ agent_group_id: 'ag-fixer' });
    expect(await read()).toMatchObject({ agent_group_id: 'ag-reviewer', session_id: 'sess-reviewer' });
  });

  it('logs the reassignment with both sides and the stated reason', async () => {
    const spy = vi.spyOn(log, 'warn').mockImplementation(() => {});
    await claimPrMapping(db, OWNER);
    await overridePrMapping(db, { ...OWNER, agentGroupId: 'ag-reviewer' }, 'handed off after triage');
    const call = spy.mock.calls.find(([m]) => String(m).includes('REASSIGNED'));
    expect(call).toBeDefined();
    const ctx = call![1] as Record<string, unknown>;
    expect(ctx.from).toMatchObject({ agentGroup: 'ag-fixer' });
    expect(ctx.to).toMatchObject({ agentGroup: 'ag-reviewer' });
    expect(ctx.reason).toBe('handed off after triage');
  });

  it('works on an unclaimed PR too, reporting no previous holder', async () => {
    const { prior } = await overridePrMapping(db, OWNER, 'seeding');
    expect(prior).toBeNull();
    expect(await read()).toMatchObject({ agent_group_id: 'ag-fixer' });
  });
});
