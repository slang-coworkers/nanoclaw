/**
 * Stuck inbound retirement, end to end: a real central DB, real session
 * mailboxes on disk, and the real `reconcileSession`. The container runtime
 * and the wake are stubbed; everything that decides and writes is not.
 *
 * Shapes come from prod (2026-11-16): a late `ask_user_question` answer and a
 * hand-written recompose ping, both `system` rows stored as triggers, sat due
 * in active sessions for 47 and 160 days while the runner — whose poll loop
 * drops system rows — consumed everything around them. Closed sessions held
 * several hundred more pending trigger rows that nothing can ever run.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_DIR = vi.hoisted(() => `${process.env.TMPDIR ?? '/tmp'}/nanoclaw-test-stuck-inbound-${process.pid}`);
const running = vi.hoisted(() => new Set<string>());

vi.mock('./config.js', async () => ({
  ...(await vi.importActual<typeof import('./config.js')>('./config.js')),
  DATA_DIR: TEST_DIR,
}));
vi.mock('./container-runner.js', () => ({
  claudeMdStaleForSession: vi.fn(async () => null),
  getContainerStartedAtMs: vi.fn(() => 0),
  isContainerRunning: vi.fn((id: string) => running.has(id)),
  killContainer: vi.fn(),
  recomposeAndUpdateHash: vi.fn(),
}));
vi.mock('./request-wake.js', () => ({ requestWake: vi.fn(async () => true) }));
vi.mock('./modules/runaway/detect.js', () => ({ checkRunaway: vi.fn() }));
vi.mock('./modules/runaway/index.js', () => ({ runawayCardDeps: {} }));
vi.mock('./modules/critique-escalation/index.js', () => ({ checkCritiqueEscalation: vi.fn() }));

import { claudeMdStaleForSession, recomposeAndUpdateHash } from './container-runner.js';
import { closeDb, createAgentGroup, getDb, initTestDb, runMigrations } from './db/index.js';
import { createSession, getClosedSessionIdsInUnpausedGroups, getSession } from './db/sessions.js';
import { log } from './log.js';
import { inboundDbPath, outboundDbPath } from './mailbox/sqlite/paths.js';
import {
  countDueMessages,
  ensureSchema,
  getBouncedTriggerRow,
  getMessageForRetry,
  getNextDueAt,
  syncProcessingAcks,
} from './mailbox/sqlite/session-db.js';
import { wrapSqliteInbound, wrapSqliteOutbound } from './mailbox/sqlite/index.js';
import {
  CLOSED_SESSION_MAIL_MIN_AGE_MS,
  STUCK_INBOUND_PASSED_OVER_MS,
  _resetClosedMailForTesting,
  _resetQuietSessionsForTesting,
  reconcileSession,
  retireStuckInbound,
  unretiredClosedSessions,
} from './reconcile-session.js';
import { requestWake } from './request-wake.js';
import { initSessionFolder } from './session-manager.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const iso = () => new Date().toISOString();

async function group(id: string, paused = false): Promise<void> {
  await createAgentGroup({ id, name: id, folder: id, agent_provider: null, created_at: iso() });
  if (paused) await getDb().run('UPDATE agent_groups SET paused = 1 WHERE id = ?', id);
}

async function session(
  id: string,
  agentGroupId: string,
  status: 'active' | 'closed' = 'active',
  threadId: string | null = null,
): Promise<void> {
  await createSession({
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: threadId,
    agent_provider: null,
    status,
    container_status: 'stopped',
    last_active: null,
    created_at: iso(),
  });
  initSessionFolder(agentGroupId, id);
}

function inbound(ag: string, sid: string): Database.Database {
  return new Database(inboundDbPath(ag, sid));
}

function insert(
  ag: string,
  sid: string,
  rows: Array<{
    id: string;
    kind?: string;
    timestamp: string;
    status?: string;
    trigger?: 0 | 1;
    processAfter?: string;
  }>,
): void {
  const db = inbound(ag, sid);
  let seq = (db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM messages_in').get() as { m: number }).m;
  const stmt = db.prepare(
    `INSERT INTO messages_in (id, seq, kind, timestamp, status, process_after, trigger, content)
     VALUES (?, ?, ?, ?, ?, ?, ?, '{}')`,
  );
  for (const r of rows) {
    seq += 2;
    stmt.run(r.id, seq, r.kind ?? 'chat', r.timestamp, r.status ?? 'pending', r.processAfter ?? null, r.trigger ?? 1);
  }
  db.close();
}

function ack(ag: string, sid: string, messageId: string, status: string): void {
  const db = new Database(outboundDbPath(ag, sid));
  db.prepare('INSERT INTO processing_ack (message_id, status, status_changed) VALUES (?, ?, ?)').run(
    messageId,
    status,
    iso(),
  );
  db.close();
}

function statuses(ag: string, sid: string): Record<string, string> {
  const db = inbound(ag, sid);
  const rows = db.prepare('SELECT id, status FROM messages_in ORDER BY seq').all() as Array<{
    id: string;
    status: string;
  }>;
  db.close();
  return Object.fromEntries(rows.map((r) => [r.id, r.status]));
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.clearAllMocks();
  running.clear();
  _resetQuietSessionsForTesting();
  _resetClosedMailForTesting();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  warn = vi.spyOn(log, 'warn');
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('active sessions: a row the runner keeps passing over', () => {
  it('is retired with a reason, and stops arming a wake (prod: qr-msg answered after the tool timed out)', async () => {
    await group('ag-main');
    await session('sess-orch', 'ag-main');
    insert('ag-main', 'sess-orch', [
      { id: 'qr-msg-late', kind: 'system', timestamp: ago(47 * DAY) },
      { id: 'chat-today', timestamp: ago(60_000), status: 'completed' },
    ]);

    await reconcileSession('sess-orch');

    expect(statuses('ag-main', 'sess-orch')).toEqual({ 'qr-msg-late': 'failed', 'chat-today': 'completed' });
    expect(warn).toHaveBeenCalledWith(
      'Retired stuck inbound message',
      expect.objectContaining({
        sessionId: 'sess-orch',
        messageId: 'qr-msg-late',
        kind: 'system',
        reason: 'passed-over',
      }),
    );
    // Retired before the due count of the same pass: no wake for a ghost row.
    expect(requestWake).not.toHaveBeenCalled();
  });

  it('is never redriven once failed: every pending select skips it, and a late ack cannot revive it', async () => {
    await group('ag-babysitter');
    await session('sess-bs', 'ag-babysitter');
    insert('ag-babysitter', 'sess-bs', [
      { id: 'wake-recompose-20260609', kind: 'system', timestamp: ago(160 * DAY) },
      { id: 'task-done', kind: 'task', timestamp: ago(DAY), status: 'completed' },
    ]);
    await reconcileSession('sess-bs');
    _resetQuietSessionsForTesting();
    await reconcileSession('sess-bs');

    expect(requestWake).not.toHaveBeenCalled();
    const db = inbound('ag-babysitter', 'sess-bs');
    expect(countDueMessages(db)).toBe(0);
    expect(getNextDueAt(db)).toBeNull();
    expect(getMessageForRetry(db, 'wake-recompose-20260609', 'pending')).toBeUndefined();
    expect(getBouncedTriggerRow(db, 'wake-recompose-20260609')).toBeUndefined();
    // The runner's own poll select (container getPendingMessages) reads pending only.
    expect(db.prepare("SELECT id FROM messages_in WHERE status = 'pending'").all()).toEqual([]);
    db.close();

    // A stray completed ack arriving later does not flip it back.
    ack('ag-babysitter', 'sess-bs', 'wake-recompose-20260609', 'completed');
    const inDb = inbound('ag-babysitter', 'sess-bs');
    const outDb = new Database(outboundDbPath('ag-babysitter', 'sess-bs'), { readonly: true });
    syncProcessingAcks(inDb, outDb);
    expect(statuses('ag-babysitter', 'sess-bs')['wake-recompose-20260609']).toBe('failed');
    inDb.close();
    outDb.close();
  });

  it('is left alone until it has been passed over for the full window', async () => {
    await group('ag-main');
    await session('sess-orch', 'ag-main');
    insert('ag-main', 'sess-orch', [
      { id: 'qr-recent', kind: 'system', timestamp: ago(STUCK_INBOUND_PASSED_OVER_MS - DAY) },
      { id: 'chat-today', timestamp: ago(60_000), status: 'completed' },
    ]);

    await reconcileSession('sess-orch');

    expect(statuses('ag-main', 'sess-orch')['qr-recent']).toBe('pending');
  });

  it('is never retired in a paused group, however long it has been passed over', async () => {
    await group('ag-approver', true);
    await session('sess-appr', 'ag-approver');
    insert('ag-approver', 'sess-appr', [
      { id: 'qr-old', kind: 'system', timestamp: ago(60 * DAY) },
      { id: 'a2a-held', timestamp: ago(30 * DAY) },
      { id: 'chat-before-pause', timestamp: ago(2 * DAY), status: 'completed' },
    ]);

    await reconcileSession('sess-appr');

    expect(statuses('ag-approver', 'sess-appr')).toMatchObject({ 'qr-old': 'pending', 'a2a-held': 'pending' });
    expect(warn).not.toHaveBeenCalledWith('Retired stuck inbound message', expect.anything());
  });

  it('keeps held work in an unpaused group when nothing newer was consumed (prod: cost-stopped fixer, 17 days)', async () => {
    await group('ag-fixer');
    await session('sess-fix', 'ag-fixer');
    insert('ag-fixer', 'sess-fix', [
      { id: 'chat-before-stop', timestamp: ago(18 * DAY), status: 'completed' },
      { id: 'gh-review-comment', kind: 'webhook', timestamp: ago(17 * DAY) },
      // The cost-continue control row a stopped runner consumes does not count.
      { id: 'cost-continue', kind: 'cost_override', timestamp: ago(DAY), status: 'completed' },
    ]);

    await reconcileSession('sess-fix');

    expect(statuses('ag-fixer', 'sess-fix')['gh-review-comment']).toBe('pending');
  });
});

describe('retireStuckInbound', () => {
  it('leaves a passed-over row that holds a claim to its own retry budget', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-retire-claim-'));
    const inPath = path.join(dir, 'inbound.db');
    const outPath = path.join(dir, 'outbound.db');
    try {
      ensureSchema(inPath, 'inbound');
      ensureSchema(outPath, 'outbound');
      const inDb = new Database(inPath);
      inDb
        .prepare(
          `INSERT INTO messages_in (id, seq, kind, timestamp, status, trigger, content) VALUES
             ('bounced', 2, 'chat', ?, 'pending', 1, '{}'),
             ('processing', 4, 'chat', ?, 'pending', 1, '{}'),
             ('unclaimed', 6, 'chat', ?, 'pending', 1, '{}'),
             ('newer', 8, 'chat', ?, 'completed', 1, '{}')`,
        )
        .run(ago(30 * DAY), ago(30 * DAY), ago(30 * DAY), ago(DAY));
      const outDb = new Database(outPath);
      outDb
        .prepare(
          `INSERT INTO processing_ack (message_id, status, status_changed) VALUES
             ('bounced', 'bounced-transient', ?), ('processing', 'processing', ?)`,
        )
        .run(iso(), iso());
      const mailbox = { ...wrapSqliteInbound(inDb), ...wrapSqliteOutbound(outDb) };

      expect(retireStuckInbound(mailbox, { id: 's', agent_group_id: 'ag' }, 'passed-over')).toBe(1);
      const rows = inDb.prepare('SELECT id, status FROM messages_in ORDER BY seq').all();
      expect(rows).toEqual([
        { id: 'bounced', status: 'pending' },
        { id: 'processing', status: 'pending' },
        { id: 'unclaimed', status: 'failed' },
        { id: 'newer', status: 'completed' },
      ]);
      inDb.close();
      outDb.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('closed sessions: leftover pending mail', () => {
  it('is retired once due for the floor, while rows the runner already acked are completed instead', async () => {
    await group('ag-main');
    await session('sess-closed', 'ag-main', 'closed');
    insert('ag-main', 'sess-closed', [
      { id: 'gh-review-1', kind: 'webhook', timestamp: ago(80 * DAY) },
      { id: 'a2a-past-floor', timestamp: ago(CLOSED_SESSION_MAIL_MIN_AGE_MS + 60_000) },
      { id: 'claudemd-refresh-1', timestamp: ago(CLOSED_SESSION_MAIL_MIN_AGE_MS - DAY) },
      // Written long ago but due tomorrow: not yet due at all, let alone for the floor.
      { id: 'task-future', kind: 'task', timestamp: ago(30 * DAY), processAfter: new Date(NOW + DAY).toISOString() },
      { id: 'consumed-not-synced', timestamp: ago(DAY) },
      { id: 'context', timestamp: ago(80 * DAY), trigger: 0 },
    ]);
    ack('ag-main', 'sess-closed', 'consumed-not-synced', 'completed');

    await reconcileSession('sess-closed');

    expect(statuses('ag-main', 'sess-closed')).toEqual({
      'gh-review-1': 'failed',
      'a2a-past-floor': 'failed',
      'claudemd-refresh-1': 'pending',
      'task-future': 'pending',
      'consumed-not-synced': 'completed',
      context: 'pending',
    });
    expect(warn).toHaveBeenCalledWith(
      'Retired stuck inbound message',
      expect.objectContaining({ messageId: 'gh-review-1', reason: 'session-closed' }),
    );
    expect(requestWake).not.toHaveBeenCalled();
  });

  it('waits while the group is paused, and while a container for the session still runs', async () => {
    await group('ag-approver', true);
    await session('sess-paused-closed', 'ag-approver', 'closed');
    insert('ag-approver', 'sess-paused-closed', [{ id: 'a2a-1', timestamp: ago(60 * DAY) }]);
    await group('ag-fixer');
    await session('sess-live-closed', 'ag-fixer', 'closed');
    insert('ag-fixer', 'sess-live-closed', [{ id: 'gh-1', kind: 'webhook', timestamp: ago(30 * DAY) }]);
    running.add('sess-live-closed');

    await reconcileSession('sess-paused-closed');
    await reconcileSession('sess-live-closed');
    expect(statuses('ag-approver', 'sess-paused-closed')['a2a-1']).toBe('pending');
    expect(statuses('ag-fixer', 'sess-live-closed')['gh-1']).toBe('pending');

    // The scan still offers the running one (not yet retired), never the paused one.
    expect(await getClosedSessionIdsInUnpausedGroups()).toEqual(['sess-live-closed']);
    expect(unretiredClosedSessions(await getClosedSessionIdsInUnpausedGroups(), 10)).toEqual(['sess-live-closed']);

    running.clear();
    await reconcileSession('sess-live-closed');
    expect(statuses('ag-fixer', 'sess-live-closed')['gh-1']).toBe('failed');
    expect(unretiredClosedSessions(await getClosedSessionIdsInUnpausedGroups(), 10)).toEqual([]);

    // Unpaused, the paused group's closed session joins the scan.
    await getDb().run('UPDATE agent_groups SET paused = 0 WHERE id = ?', 'ag-approver');
    expect(unretiredClosedSessions(await getClosedSessionIdsInUnpausedGroups(), 10)).toEqual(['sess-paused-closed']);
  });

  it('keeps a row that just landed as its session closed, and the scan returns once it is due for the floor', async () => {
    // Prod 2026-11-16 04:49:23: a CLAUDE.md change killed a spent task
    // session's container with a refresh notice due in 5 s; the container
    // exited and the session closed 0.4 s later, before the notice was due.
    await group('ag-main');
    await session('sess-task', 'ag-main', 'active', 'system:tasks:rechase-1');
    insert('ag-main', 'sess-task', [{ id: 'task-last-run', kind: 'task', timestamp: ago(DAY), status: 'completed' }]);
    running.add('sess-task');
    vi.mocked(claudeMdStaleForSession).mockResolvedValueOnce({
      sessionId: 'sess-task',
      agentGroupId: 'ag-main',
      folder: 'ag-main',
    });
    vi.mocked(recomposeAndUpdateHash).mockResolvedValueOnce({ kind: 'restart-ready', hash: 'a'.repeat(64) });

    await reconcileSession('sess-task'); // writes the notice and kills the container
    running.clear(); // the container exits
    await reconcileSession('sess-task'); // nothing due yet, no live task: closes the session
    expect((await getSession('sess-task'))?.status).toBe('closed');
    const notice = Object.keys(statuses('ag-main', 'sess-task')).find((id) => id.startsWith('claudemd-refresh-'));
    expect(notice).toBeDefined();

    // The mail-write feed or the scan reaches the closed session at once.
    await reconcileSession('sess-task');
    expect(statuses('ag-main', 'sess-task')[notice!]).toBe('pending');
    expect(warn).not.toHaveBeenCalledWith('Retired stuck inbound message', expect.anything());

    // The scan skips it until the notice has been due for the floor.
    const closed = await getClosedSessionIdsInUnpausedGroups();
    expect(unretiredClosedSessions(closed, 10)).toEqual([]);
    expect(unretiredClosedSessions(closed, 10, Date.now() + CLOSED_SESSION_MAIL_MIN_AGE_MS + 60_000)).toEqual([
      'sess-task',
    ]);
  });

  it('hands the scan at most a batch of not-yet-retired closed sessions', () => {
    expect(unretiredClosedSessions(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
  });
});
