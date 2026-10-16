/**
 * `ncl tasks isolate` — moving a legacy series out of a shared session into its
 * own `system:tasks:<series>` lane, and the SQLite hold/release helpers it rests on.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return {
    ...actual,
    DATA_DIR: '/tmp/nanoclaw-test-task-isolate',
    GROUPS_DIR: '/tmp/nanoclaw-test-task-isolate/groups',
    TIMEZONE: 'UTC',
  };
});

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
}));

const TEST_DIR = '/tmp/nanoclaw-test-task-isolate';

import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { createSession, getSession, taskThreadId } from '../../db/sessions.js';
import { inboundDbPath } from '../../mailbox/sqlite/paths.js';
import { ensureSchema, openInboundDb } from '../../mailbox/sqlite/session-db.js';
import { copyHeldTaskRows, holdTaskSeries, insertTaskRow, releaseHeldTaskRows } from '../../mailbox/sqlite/tasks.js';
import { wrapSqliteInbound } from '../../mailbox/sqlite/index.js';
import { initSessionFolder, resolveTaskSession } from '../../session-manager.js';
import type { Session } from '../../types.js';
import { dispatch } from '../../cli/dispatch.js';
import type { CallerContext } from '../../cli/frame.js';
import '../../cli/resources/tasks.js';
import { handleRecurrence } from './recurrence.js';
import { isolateTaskSeries } from './isolate.js';

const HOST: CallerContext = { caller: 'host' } as CallerContext;
const FUTURE = '2999-01-01T00:00:00.000Z';

function now(): string {
  return new Date().toISOString();
}

async function createChatSession(group: string, id: string): Promise<void> {
  await createSession({
    id,
    agent_group_id: group,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: now(),
  });
  initSessionFolder(group, id);
}

function withChatDb<T>(fn: (db: Database.Database) => T): T {
  const db = new Database(inboundDbPath('ag-1', 'chat-1'));
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function seedLegacy(id: string, opts: { status?: 'pending' | 'paused'; recurrence?: string | null } = {}): void {
  withChatDb((db) =>
    insertTaskRow(db, {
      id,
      seriesId: id,
      processAfter: FUTURE,
      recurrence: opts.recurrence === undefined ? '0 0 * * *' : opts.recurrence,
      content: JSON.stringify({ prompt: `run ${id}`, script: null, originSessionId: null }),
      status: opts.status ?? 'pending',
    }),
  );
}

function taskRows(dbPath: string, series: string): Array<{ id: string; status: string; recurrence: string | null }> {
  const db = new Database(dbPath, { readonly: true });
  try {
    return db
      .prepare("SELECT id, status, recurrence FROM messages_in WHERE kind = 'task' AND series_id = ? ORDER BY seq")
      .all(series) as Array<{ id: string; status: string; recurrence: string | null }>;
  } finally {
    db.close();
  }
}

describe('isolateTaskSeries / ncl tasks isolate', () => {
  beforeEach(async () => {
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(TEST_DIR, { recursive: true });
    const db = await initTestDb();
    await runMigrations(db);
    await createAgentGroup({ id: 'ag-1', name: 'ag-1', folder: 'ag-1', agent_provider: null, created_at: now() });
    await createChatSession('ag-1', 'chat-1');
  });

  afterEach(async () => {
    await closeDb();
    if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  });

  it('moves a legacy series out of the chat session into its own system:tasks lane', async () => {
    seedLegacy('wiki-synth-1a2b');

    const resp = await dispatch(
      { id: 'i-1', command: 'tasks-isolate', args: { id: 'wiki-synth-1a2b', group: 'ag-1' } },
      HOST,
    );
    expect(resp.ok).toBe(true);
    if (!resp.ok) return;
    const out = resp.data as { from_session_id: string; to_session_id: string; moved: number };
    expect(out.from_session_id).toBe('chat-1');
    expect(out.moved).toBe(1);

    const target = await getSession(out.to_session_id);
    expect(target?.thread_id).toBe(taskThreadId('wiki-synth-1a2b'));
    expect(taskRows(inboundDbPath('ag-1', out.to_session_id), 'wiki-synth-1a2b')).toEqual([
      { id: 'wiki-synth-1a2b', status: 'pending', recurrence: '0 0 * * *' },
    ]);
    // The source keeps its history but can never fire or re-arm the series again.
    expect(taskRows(inboundDbPath('ag-1', 'chat-1'), 'wiki-synth-1a2b')).toEqual([
      { id: 'wiki-synth-1a2b', status: 'cancelled', recurrence: null },
    ]);

    // Exactly one live copy, now reported as isolated.
    const list = await dispatch({ id: 'l-1', command: 'tasks-list', args: { group: 'ag-1' } }, HOST);
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    const rows = (list.data as Array<{ series_id: string; session_id: string; isolated: boolean }>).filter(
      (r) => r.series_id === 'wiki-synth-1a2b',
    );
    expect(rows).toEqual([expect.objectContaining({ session_id: out.to_session_id, isolated: true })]);
  });

  it('leaves other series in the shared session where they are (opt-out is: do not isolate)', async () => {
    seedLegacy('wiki-synth-1a2b');
    seedLegacy('supervise-issues-3c4d', { recurrence: '0 */12 * * *' });

    await isolateTaskSeries('ag-1', 'chat-1', 'wiki-synth-1a2b');

    expect(taskRows(inboundDbPath('ag-1', 'chat-1'), 'supervise-issues-3c4d')).toEqual([
      { id: 'supervise-issues-3c4d', status: 'pending', recurrence: '0 */12 * * *' },
    ]);
    const list = await dispatch({ id: 'l-2', command: 'tasks-list', args: { group: 'ag-1' } }, HOST);
    if (!list.ok) throw new Error('list failed');
    const sup = (list.data as Array<{ series_id: string; session_id: string; isolated: boolean }>).find(
      (r) => r.series_id === 'supervise-issues-3c4d',
    );
    expect(sup).toMatchObject({ session_id: 'chat-1', isolated: false });
  });

  it('keeps a paused series paused in its new lane', async () => {
    seedLegacy('okf-synth-5e6f', { status: 'paused' });
    const out = await isolateTaskSeries('ag-1', 'chat-1', 'okf-synth-5e6f');
    expect(out.statuses).toEqual(['paused']);
    expect(taskRows(inboundDbPath('ag-1', out.to_session_id), 'okf-synth-5e6f')[0].status).toBe('paused');
  });

  it('the moved series re-arms inside its own lane, never back in the chat session', async () => {
    seedLegacy('watchdog-7a8b');
    const out = await isolateTaskSeries('ag-1', 'chat-1', 'watchdog-7a8b');

    const targetPath = inboundDbPath('ag-1', out.to_session_id);
    const db = new Database(targetPath);
    db.prepare("UPDATE messages_in SET status = 'completed' WHERE id = 'watchdog-7a8b'").run();
    db.close();

    const target = (await getSession(out.to_session_id)) as Session;
    const inDb = openInboundDb(targetPath);
    await handleRecurrence(wrapSqliteInbound(inDb), target);
    inDb.close();

    const rows = taskRows(targetPath, 'watchdog-7a8b');
    expect(rows.map((r) => r.status)).toEqual(['completed', 'pending']);
    expect(taskRows(inboundDbPath('ag-1', 'chat-1'), 'watchdog-7a8b').map((r) => r.status)).toEqual(['cancelled']);
  });

  it('refuses while an occurrence is in flight, and leaves the series untouched', async () => {
    // A completed occurrence still carrying the recurrence = awaiting re-arm by the sweep.
    withChatDb((db) =>
      insertTaskRow(db, {
        id: 'sup-run-1',
        seriesId: 'supervise-issues-3c4d',
        processAfter: '2026-01-01T00:00:00.000Z',
        recurrence: '0 */12 * * *',
        content: JSON.stringify({ prompt: 'x', script: null }),
      }),
    );
    withChatDb((db) => db.prepare("UPDATE messages_in SET status = 'completed' WHERE id = 'sup-run-1'").run());
    // plus a pending on-demand run row in the same series
    withChatDb((db) =>
      insertTaskRow(db, {
        id: 'sup-adhoc',
        seriesId: 'supervise-issues-3c4d',
        processAfter: FUTURE,
        recurrence: null,
        content: JSON.stringify({ prompt: 'x', script: null }),
      }),
    );

    await expect(isolateTaskSeries('ag-1', 'chat-1', 'supervise-issues-3c4d')).rejects.toThrow(/running or awaiting/);
    expect(taskRows(inboundDbPath('ag-1', 'chat-1'), 'supervise-issues-3c4d').map((r) => r.status)).toEqual([
      'completed',
      'pending',
    ]);
  });

  it('a re-run after a crash between copy and retire does not duplicate the series', async () => {
    seedLegacy('wiki-synth-1a2b');
    // Simulate a previous run that copied the row but died before cancelling the source.
    const { session } = await resolveTaskSession('ag-1', 'wiki-synth-1a2b');
    const t = new Database(inboundDbPath('ag-1', session.id));
    insertTaskRow(t, {
      id: 'wiki-synth-1a2b',
      seriesId: 'wiki-synth-1a2b',
      processAfter: FUTURE,
      recurrence: '0 0 * * *',
      content: JSON.stringify({ prompt: 'run', script: null }),
    });
    t.close();

    const out = await isolateTaskSeries('ag-1', 'chat-1', 'wiki-synth-1a2b');
    expect(out.moved).toBe(0);
    expect(taskRows(inboundDbPath('ag-1', session.id), 'wiki-synth-1a2b')).toHaveLength(1);
    expect(taskRows(inboundDbPath('ag-1', 'chat-1'), 'wiki-synth-1a2b')[0].status).toBe('cancelled');
  });

  it('isolating an already-isolated series is refused', async () => {
    seedLegacy('wiki-synth-1a2b');
    await isolateTaskSeries('ag-1', 'chat-1', 'wiki-synth-1a2b');
    const again = await dispatch(
      { id: 'i-2', command: 'tasks-isolate', args: { id: 'wiki-synth-1a2b', group: 'ag-1' } },
      HOST,
    );
    expect(again.ok).toBe(false);
  });

  it('a group-scoped agent can only isolate its own group series', async () => {
    seedLegacy('wiki-synth-1a2b');
    const foreign: CallerContext = {
      caller: 'agent',
      agentGroupId: 'ag-2',
      sessionId: 'chat-2',
      messagingGroupId: 'mg-2',
    };
    const resp = await dispatch({ id: 'i-3', command: 'tasks-isolate', args: { id: 'wiki-synth-1a2b' } }, foreign);
    expect(resp.ok).toBe(false);
    expect(taskRows(inboundDbPath('ag-1', 'chat-1'), 'wiki-synth-1a2b')[0].status).toBe('pending');
  });
});

describe('holdTaskSeries / releaseHeldTaskRows', () => {
  const DIR = '/tmp/nanoclaw-test-task-hold';
  const PATH = `${DIR}/inbound.db`;
  let db: Database.Database;

  beforeEach(() => {
    if (fs.existsSync(DIR)) fs.rmSync(DIR, { recursive: true });
    fs.mkdirSync(DIR, { recursive: true });
    ensureSchema(PATH, 'inbound');
    db = openInboundDb(PATH);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(DIR, { recursive: true, force: true });
  });

  it('pauses pending rows, reports prior status, and release restores only what it is given', () => {
    const base = { seriesId: 's-1', processAfter: FUTURE, recurrence: null, content: '{"prompt":"p"}' };
    insertTaskRow(db, { ...base, id: 's-1', recurrence: '0 0 * * *' });
    insertTaskRow(db, { ...base, id: 's-1-run', status: 'paused' });

    const held = holdTaskSeries(db, 's-1');
    expect(held.inFlight).toBe(false);
    if (held.inFlight) return;
    expect(held.rows.map((r) => [r.id, r.status])).toEqual([
      ['s-1', 'pending'],
      ['s-1-run', 'paused'],
    ]);
    const statuses = () =>
      db.prepare("SELECT id, status FROM messages_in WHERE series_id = 's-1' ORDER BY seq").all() as Array<{
        id: string;
        status: string;
      }>;
    expect(statuses().map((r) => r.status)).toEqual(['paused', 'paused']);

    expect(releaseHeldTaskRows(db, ['s-1'])).toBe(1);
    expect(statuses().map((r) => r.status)).toEqual(['pending', 'paused']);
  });

  it('copyHeldTaskRows skips row ids already present and copies the rest (re-run converges)', () => {
    const row = (id: string, recurrence: string | null) => ({
      id,
      seriesId: 's-2',
      processAfter: FUTURE,
      recurrence,
      content: '{"prompt":"p"}',
      status: 'pending' as const,
    });
    // A previous partial copy left only the on-demand row behind.
    insertTaskRow(db, row('s-2-run', null));
    expect(copyHeldTaskRows(db, [row('s-2-run', null), row('s-2', '0 0 * * *')])).toBe(1);
    const ids = db.prepare("SELECT id, recurrence FROM messages_in WHERE series_id = 's-2' ORDER BY seq").all();
    expect(ids).toEqual([
      { id: 's-2-run', recurrence: null },
      { id: 's-2', recurrence: '0 0 * * *' },
    ]);
  });
});
