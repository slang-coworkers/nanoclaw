import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb, getDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import { createAgentGroup } from './agent-groups.js';
import { createSession } from './sessions.js';
import { recordSource, getSourceFor } from './a2a-session-sources.js';
import { migration925 } from './migrations/925-a2a-drop-self-referential-sources.js';
import type { Session } from '../types.js';

const now = () => new Date().toISOString();

function mkGroup(id: string): void {
  createAgentGroup({
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

function mkSession(id: string, agentGroupId: string): Session {
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
  createSession(s);
  return s;
}

function insertSourceRow(recipient: string, recipientAg: string, source: string, sourceAg: string): void {
  getDb()
    .prepare(
      `INSERT INTO a2a_session_sources
         (recipient_session_id, recipient_agent_group_id, recipient_thread_id,
          source_session_id, source_agent_group_id, source_thread_id, created_at)
       VALUES (?, ?, NULL, ?, ?, NULL, ?)`,
    )
    .run(recipient, recipientAg, source, sourceAg, now());
}

beforeEach(() => {
  const db = initTestDb();
  runMigrations(db);
});

afterEach(() => {
  closeDb();
});

describe('recordSource self-referential guard (G6b)', () => {
  it('refuses to write a self-referential lineage row (recipient === source)', () => {
    mkGroup('ag-x');
    mkSession('sess-x', 'ag-x');
    recordSource({
      recipientSessionId: 'sess-x',
      recipientAgentGroupId: 'ag-x',
      recipientThreadId: null,
      sourceSessionId: 'sess-x',
      sourceAgentGroupId: 'ag-x',
      sourceThreadId: null,
    });
    expect(getSourceFor('sess-x')).toBeUndefined();
  });

  it('records a normal (non-self) lineage row', () => {
    mkGroup('ag-a');
    mkGroup('ag-b');
    mkSession('sess-a', 'ag-a');
    mkSession('sess-b', 'ag-b');
    recordSource({
      recipientSessionId: 'sess-b',
      recipientAgentGroupId: 'ag-b',
      recipientThreadId: null,
      sourceSessionId: 'sess-a',
      sourceAgentGroupId: 'ag-a',
      sourceThreadId: null,
    });
    expect(getSourceFor('sess-b')?.source_session_id).toBe('sess-a');
  });
});

describe('migration 925: drop self-referential a2a lineage rows (G6b / G3 cleanup)', () => {
  it('deletes historical self-referential rows and leaves normal rows intact', () => {
    mkGroup('ag-a');
    mkGroup('ag-b');
    mkSession('sess-a', 'ag-a');
    mkSession('sess-b', 'ag-b');
    // Historical corruption: a self-referential row written directly, bypassing
    // the recordSource guard (as pre-guard code did).
    insertSourceRow('sess-a', 'ag-a', 'sess-a', 'ag-a');
    // A legitimate lineage row that must survive.
    insertSourceRow('sess-b', 'ag-b', 'sess-a', 'ag-a');
    expect(getSourceFor('sess-a')).toBeDefined();

    migration925.up(getDb());

    expect(getSourceFor('sess-a')).toBeUndefined();
    expect(getSourceFor('sess-b')?.source_session_id).toBe('sess-a');
  });
});
