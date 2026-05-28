import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { upsertPrMapping } from './store.js';

beforeEach(() => {
  initTestDb();
});

afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
});

describe('upsertPrMapping', () => {
  it('inserts a new mapping with owner_instance', () => {
    const db = initTestDb();
    runMigrations(db);

    const { priorOwner } = upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 100,
      ownerInstance: 'prod',
      agentGroupId: 'g1',
      sessionId: 's1',
      threadId: null,
    });

    expect(priorOwner).toBeNull();
    const row = db
      .prepare(
        'SELECT owner_instance, agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      )
      .get('shader-slang/slang', 100) as {
      owner_instance: string;
      agent_group_id: string;
      session_id: string;
      thread_id: string | null;
    };
    expect(row.owner_instance).toBe('prod');
    expect(row.agent_group_id).toBe('g1');
    expect(row.session_id).toBe('s1');
    expect(row.thread_id).toBeNull();
  });

  it('replaces an existing mapping (last-writer-wins) and reports prior owner', () => {
    const db = initTestDb();
    runMigrations(db);

    upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 200,
      ownerInstance: 'prod',
      agentGroupId: 'g1',
      sessionId: 's1',
      threadId: 't1',
    });

    const { priorOwner } = upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 200,
      ownerInstance: 'lego',
      agentGroupId: 'g2',
      sessionId: 's2',
      threadId: 't2',
    });

    expect(priorOwner).toBe('prod');
    const row = db
      .prepare(
        'SELECT owner_instance, agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      )
      .get('shader-slang/slang', 200) as {
      owner_instance: string;
      agent_group_id: string;
      session_id: string;
      thread_id: string;
    };
    expect(row.owner_instance).toBe('lego');
    expect(row.agent_group_id).toBe('g2');
    expect(row.session_id).toBe('s2');
    expect(row.thread_id).toBe('t2');
  });

  it('logs a warning when owner_instance changes', async () => {
    const db = initTestDb();
    runMigrations(db);

    const { log } = await import('../../log.js');
    const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => undefined);

    upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 300,
      ownerInstance: 'prod',
      agentGroupId: 'g1',
      sessionId: 's1',
      threadId: null,
    });
    upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 300,
      ownerInstance: 'lego',
      agentGroupId: 'g2',
      sessionId: 's2',
      threadId: null,
    });

    const ownerChangeCalls = warnSpy.mock.calls.filter((c) => c[0] === 'pr-mapping ownership changed');
    expect(ownerChangeCalls).toHaveLength(1);
    expect(ownerChangeCalls[0][1]).toMatchObject({
      repo: 'shader-slang/slang',
      pr: 300,
      from: 'prod',
      to: 'lego',
    });
  });

  it('does NOT warn when re-writing the same owner_instance (refresh)', async () => {
    const db = initTestDb();
    runMigrations(db);

    const { log } = await import('../../log.js');
    const warnSpy = vi.spyOn(log, 'warn').mockImplementation(() => undefined);

    upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 400,
      ownerInstance: 'lego',
      agentGroupId: 'g1',
      sessionId: 's1',
      threadId: null,
    });
    upsertPrMapping(db, {
      repo: 'shader-slang/slang',
      prNumber: 400,
      ownerInstance: 'lego',
      agentGroupId: 'g1',
      sessionId: 's1-new',
      threadId: null,
    });

    const ownerChangeCalls = warnSpy.mock.calls.filter((c) => c[0] === 'pr-mapping ownership changed');
    expect(ownerChangeCalls).toHaveLength(0);
  });
});
