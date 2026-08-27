import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb, getDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import { createAgentGroup } from './agent-groups.js';
import { createSession } from './sessions.js';
import { recordSource, getSourceFor } from './a2a-session-sources.js';
import { migration925 } from './migrations/925-a2a-drop-self-referential-sources.js';
import type { DbDriver } from './driver.js';
import type { Session } from '../types.js';

const now = () => new Date().toISOString();

/**
 * migration925 is declared as the `Migration` union, whose `up` takes either the
 * portable driver or a raw SQLite handle. Narrow on the discriminant so the test
 * hands it the driver its own implementation actually accepts.
 */
async function runMigration925(db: DbDriver): Promise<void> {
  if (migration925.sqliteOnly) throw new Error('migration925 is portable — expected the DbDriver signature');
  await migration925.up(db);
}

async function mkGroup(id: string): Promise<void> {
  await createAgentGroup({
    id,
    name: id,
    folder: id,
    is_admin: 0,
    agent_provider: null,
    container_config: null,
    coworker_type: null,
    allowed_mcp_tools: null,
    created_at: now(),
  });
}

async function mkSession(id: string, agentGroupId: string): Promise<Session> {
  const s: Session = {
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: now(),
  };
  await createSession(s);
  return s;
}

async function insertSourceRow(recipient: string, recipientAg: string, source: string, sourceAg: string) {
  await getDb().run(
    `INSERT INTO a2a_session_sources
         (recipient_session_id, recipient_agent_group_id, recipient_thread_id,
          source_session_id, source_agent_group_id, source_thread_id, created_at)
       VALUES (?, ?, NULL, ?, ?, NULL, ?)`,
    recipient,
    recipientAg,
    source,
    sourceAg,
    now(),
  );
}

beforeEach(async () => {
  const db = await initTestDb();
  await runMigrations(db);
});

afterEach(async () => {
  await closeDb();
});

describe('recordSource self-referential guard (G6b)', () => {
  it('refuses to write a self-referential lineage row (recipient === source)', async () => {
    await mkGroup('ag-x');
    await mkSession('sess-x', 'ag-x');
    await recordSource({
      recipientSessionId: 'sess-x',
      recipientAgentGroupId: 'ag-x',
      recipientThreadId: null,
      sourceSessionId: 'sess-x',
      sourceAgentGroupId: 'ag-x',
      sourceThreadId: null,
    });
    expect(await getSourceFor('sess-x')).toBeUndefined();
  });

  it('records a normal (non-self) lineage row', async () => {
    await mkGroup('ag-a');
    await mkGroup('ag-b');
    await mkSession('sess-a', 'ag-a');
    await mkSession('sess-b', 'ag-b');
    await recordSource({
      recipientSessionId: 'sess-b',
      recipientAgentGroupId: 'ag-b',
      recipientThreadId: null,
      sourceSessionId: 'sess-a',
      sourceAgentGroupId: 'ag-a',
      sourceThreadId: null,
    });
    expect((await getSourceFor('sess-b'))?.source_session_id).toBe('sess-a');
  });
});

describe('migration 925: drop self-referential a2a lineage rows (G6b / G3 cleanup)', () => {
  it('deletes historical self-referential rows and leaves normal rows intact', async () => {
    await mkGroup('ag-a');
    await mkGroup('ag-b');
    await mkSession('sess-a', 'ag-a');
    await mkSession('sess-b', 'ag-b');
    // Historical corruption: a self-referential row written directly, bypassing
    // the recordSource guard (as pre-guard code did).
    await insertSourceRow('sess-a', 'ag-a', 'sess-a', 'ag-a');
    // A legitimate lineage row that must survive.
    await insertSourceRow('sess-b', 'ag-b', 'sess-a', 'ag-a');
    expect(await getSourceFor('sess-a')).toBeDefined();

    await runMigration925(getDb());

    expect(await getSourceFor('sess-a')).toBeUndefined();
    expect((await getSourceFor('sess-b'))?.source_session_id).toBe('sess-a');
  });
});
