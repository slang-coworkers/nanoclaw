/**
 * A thread holds one session per privilege, and no session ever mixes the two
 * (src/modules/session-privilege). Runs `resolveSession` against a real test
 * database and a real session folder.
 */
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  return {
    ...actual,
    DATA_DIR: '/tmp/nanoclaw-test-session-privilege',
    GROUPS_DIR: '/tmp/nanoclaw-test-session-privilege/groups',
  };
});

import { closeDb, createAgentGroup, createMessagingGroup, initTestDb, runMigrations } from './db/index.js';
import { getDb } from './db/connection.js';
import { findSessionByAgentThread } from './db/sessions.js';
import './mailbox/compose.js';
import { resolveSession } from './session-manager.js';

const TEST_DIR = '/tmp/nanoclaw-test-session-privilege';
const now = () => new Date().toISOString();

beforeEach(async () => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  await createAgentGroup({ id: 'ag-1', name: 'Fixer', folder: 'fixer', agent_provider: null, created_at: now() });
  await createMessagingGroup({
    id: 'mg-1',
    channel_type: 'slack',
    platform_id: 'slack:C1',
    name: 'Chat',
    is_group: 1,
    unknown_sender_policy: 'public',
    created_at: now(),
  });
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('resolveSession with a privilege', () => {
  it('gives one thread an open and a closed session, and reuses each', async () => {
    const open = await resolveSession('ag-1', 'mg-1', 'thread-1', 'per-thread', 'open');
    const closed = await resolveSession('ag-1', 'mg-1', 'thread-1', 'per-thread', 'closed');
    expect(open.created).toBe(true);
    expect(closed.created).toBe(true);
    expect(open.session.id).not.toBe(closed.session.id);
    expect(open.session.privilege).toBe('open');
    expect(closed.session.privilege).toBe('closed');

    const openAgain = await resolveSession('ag-1', 'mg-1', 'thread-1', 'per-thread', 'open');
    const closedAgain = await resolveSession('ag-1', 'mg-1', 'thread-1', 'per-thread', 'closed');
    expect(openAgain).toMatchObject({ created: false, session: { id: open.session.id } });
    expect(closedAgain).toMatchObject({ created: false, session: { id: closed.session.id } });
  });

  it('asks for an open session when no privilege is given', async () => {
    const closed = await resolveSession('ag-1', 'mg-1', 'thread-1', 'per-thread', 'closed');
    const plain = await resolveSession('ag-1', 'mg-1', 'thread-1', 'per-thread');
    expect(plain.created).toBe(true);
    expect(plain.session.id).not.toBe(closed.session.id);
    expect(plain.session.privilege).toBe('open');
  });

  it('keeps an open and a closed session per GitHub issue thread', async () => {
    const thread = 'gh-issue-shader-slang/slang-123';
    const open = await resolveSession('ag-1', null, thread, 'per-thread', 'open');
    const closed = await resolveSession('ag-1', null, thread, 'per-thread', 'closed');
    expect(open.session.id).not.toBe(closed.session.id);
    expect((await resolveSession('ag-1', null, thread, 'per-thread', 'closed')).session.id).toBe(closed.session.id);
  });

  it('keeps an open and a closed session for an agent-shared agent', async () => {
    const open = await resolveSession('ag-1', 'mg-1', null, 'agent-shared', 'open');
    const closed = await resolveSession('ag-1', 'mg-1', null, 'agent-shared', 'closed');
    expect(open.session.id).not.toBe(closed.session.id);
    expect((await resolveSession('ag-1', 'mg-1', null, 'agent-shared', 'open')).session.id).toBe(open.session.id);
  });

  it('counts a session row from before the column as open', async () => {
    await getDb().run(
      "INSERT INTO sessions (id, agent_group_id, thread_id, status, container_status, created_at) VALUES ('legacy', 'ag-1', 'gh-pr-x', 'active', 'stopped', ?)",
      now(),
    );
    expect((await findSessionByAgentThread('ag-1', 'gh-pr-x', 'open'))?.id).toBe('legacy');
    expect(await findSessionByAgentThread('ag-1', 'gh-pr-x', 'closed')).toBeUndefined();
    // No privilege named: either matches.
    expect((await findSessionByAgentThread('ag-1', 'gh-pr-x'))?.id).toBe('legacy');
  });
});
