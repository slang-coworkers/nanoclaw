/**
 * The main view's thread summaries and the per-coworker context scans run in
 * summary-worker.ts, off the dashboard's event loop (startSummaryWorker in
 * server.ts). These tests boot the real worker against a fixture fleet and
 * check that:
 *   - /api/messages returns the same threadSummaries, byte for byte, as the
 *     per-request scan it replaces (re-implemented below as the oracle);
 *   - the main view does not hold the event loop, even for a large fleet, and
 *     requests keep being answered while a slow worker pass runs;
 *   - the handler reads the published result and opens no session DB;
 *   - a failed pass or a dead worker leaves the last result served, marked
 *     stale, and a dead worker is restarted;
 *   - the worker's context window, context stats and scheduled-task summaries
 *     match the in-process scans, and a task mutation triggers a pass at once;
 *   - the real dashboard process answers /api/health within seconds of starting
 *     on this fleet, stays responsive, and its workers publish afterwards.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'child_process';
import { once } from 'events';
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { createServer as createNetServer } from 'net';
import path from 'path';
import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';

import * as server from './server.js';

const { forceOpenDbForTests, resetTransientDashboardStateForTests, startServer } = server;
// Optional on purpose: the event-loop test also runs against the server.ts
// that predates the summary worker (the revert drill), which has no such hooks.
const hooks = (server as Record<string, any>).__summaryWorkerTestHooks as
  | {
      startSummaryWorker: (opts: Record<string, unknown>) => import('worker_threads').Worker | null;
      stopSummaryWorker: () => Promise<void>;
      summarySnapshotView: () => any;
      contextWindow: () => Record<string, unknown>;
      contextStats: () => Record<string, unknown>;
      groupTasks: () => Record<string, any>;
      requestSummaryPass: (pass: string) => void;
      reset: () => void;
    }
  | undefined;
const refreshThreadSummariesForTests = (server as Record<string, any>).refreshThreadSummariesForTests as
  (() => void) | undefined;
const refreshContextCachesForTests = (server as Record<string, any>).refreshContextCachesForTests as
  (() => void) | undefined;
const refreshGroupTasksForTests = (server as Record<string, any>).refreshGroupTasksForTests as (() => void) | undefined;
const REPO_ROOT = path.resolve(import.meta.dirname, '..');

const TEST_TMP_ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-summary-worker-test-'));
const DATA_DIR = path.join(TEST_TMP_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');
const SESSIONS_DIR = path.join(DATA_DIR, 'v2-sessions');
const NOW = Date.now();
// The main coworker gets enough per-thread sessions that the per-request scan
// this replaces costs well over the event-loop budget asserted below.
const MAIN_THREAD_SESSIONS = 1500;

const iso = (offsetMs: number): string => new Date(NOW - offsetMs).toISOString();
// outbound.db stores SQLite datetime, not ISO; the main view compares the two as strings.
const sqliteTs = (offsetMs: number): string => iso(offsetMs).replace('T', ' ').slice(0, 19);

interface FleetSession {
  id: string;
  group: string;
  mg: string;
  thread: string | null;
  status?: string;
  inbound?: Array<[string | null, number]> | 'legacy' | 'none';
  outbound?: Array<[string | null, number]> | 'no-table' | 'none';
}

/** Write one session's inbound.db / outbound.db. Rows are [thread_id, age ms]. */
function writeSessionDbs(s: FleetSession): void {
  const dir = path.join(SESSIONS_DIR, s.group, s.id);
  mkdirSync(dir, { recursive: true });
  if (s.inbound !== 'none') {
    const db = new Database(path.join(dir, 'inbound.db'));
    db.pragma('journal_mode = DELETE');
    db.pragma('synchronous = OFF'); // fixture speed: thousands of files, no fsync needed
    if (s.inbound === 'legacy') {
      db.exec('CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT)');
      const ins = db.prepare("INSERT INTO messages_in VALUES (?, 'chat', '{}', ?)");
      ins.run(`${s.id}-in-0`, iso(60_000));
      ins.run(`${s.id}-in-1`, iso(30_000));
    } else {
      db.exec(
        `CREATE TABLE messages_in (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, channel_type TEXT,
           platform_id TEXT, thread_id TEXT, source_session_id TEXT, recurrence TEXT, process_after TEXT, status TEXT);
         CREATE TABLE delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT);`,
      );
      const ins = db.prepare(
        "INSERT INTO messages_in (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', '{}', ?, 'dashboard', 'dashboard:x', ?)",
      );
      db.transaction(() => {
        (s.inbound as Array<[string | null, number]>).forEach(([tid, age], i) =>
          ins.run(`${s.id}-in-${i}`, iso(age), tid),
        );
      })();
    }
    db.close();
  }
  if (s.outbound !== 'none') {
    const db = new Database(path.join(dir, 'outbound.db'));
    db.pragma('journal_mode = DELETE');
    db.pragma('synchronous = OFF'); // fixture speed: thousands of files, no fsync needed
    if (s.outbound === 'no-table') {
      db.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT)');
    } else {
      db.exec(
        `CREATE TABLE messages_out (id TEXT PRIMARY KEY, kind TEXT, content TEXT, timestamp TEXT, in_reply_to TEXT,
           channel_type TEXT, platform_id TEXT, thread_id TEXT)`,
      );
      const ins = db.prepare(
        "INSERT INTO messages_out (id, kind, content, timestamp, channel_type, platform_id, thread_id) VALUES (?, 'chat', '{}', ?, 'dashboard', 'dashboard:x', ?)",
      );
      db.transaction(() => {
        (s.outbound as Array<[string | null, number]>).forEach(([tid, age], i) =>
          ins.run(`${s.id}-out-${i}`, sqliteTs(age), tid),
        );
      })();
    }
    db.close();
  }
}

/**
 * The fleet: a root session per coworker, per-thread sessions on the dashboard
 * channel and on the agent (a2a) channel, threads shared by several sessions,
 * rows from other threads, legacy and partial session DBs, plus sessions the
 * main view must ignore (Slack, closed).
 */
function fleet(): FleetSession[] {
  const out: FleetSession[] = [
    { id: 'sess-main-root', group: 'ag-main', mg: 'mg-dash-main', thread: null, inbound: [[null, 5_000]] },
    { id: 'sess-tri-root', group: 'ag-tri', mg: 'mg-dash-tri', thread: null, inbound: [[null, 5_000]] },
    // Excluded from the main view: another channel, and a closed session.
    { id: 'sess-slack-t', group: 'ag-main', mg: 'mg-slack', thread: 'slack-t', inbound: [['slack-t', 1_000]] },
    { id: 'sess-closed-t', group: 'ag-main', mg: 'mg-dash-main', thread: 'closed-t', status: 'closed' },
    // Edge shapes.
    { id: 'sess-legacy', group: 'ag-main', mg: 'mg-dash-main', thread: 'legacy-t', inbound: 'legacy' },
    {
      id: 'sess-no-out',
      group: 'ag-main',
      mg: 'mg-dash-main',
      thread: 'no-out-t',
      inbound: [['no-out-t', 2_000]],
      outbound: 'none',
    },
    {
      id: 'sess-no-table',
      group: 'ag-main',
      mg: 'mg-dash-main',
      thread: 'no-table-t',
      inbound: [['no-table-t', 2_000]],
      outbound: 'no-table',
    },
    { id: 'sess-empty', group: 'ag-main', mg: 'mg-dash-main', thread: 'empty-t', inbound: [], outbound: [] },
    {
      id: 'sess-no-files',
      group: 'ag-main',
      mg: 'mg-dash-main',
      thread: 'no-files-t',
      inbound: 'none',
      outbound: 'none',
    },
  ];
  for (let i = 0; i < MAIN_THREAD_SESSIONS; i++) {
    // Every fifth thread is shared by two sessions, so the main view sums them.
    const thread = i % 5 === 1 ? `t-${i - 1}` : `t-${i}`;
    out.push({
      id: `sess-main-${i}`,
      group: 'ag-main',
      mg: i % 7 === 0 ? 'mg-a2a' : 'mg-dash-main',
      thread,
      inbound: [
        [thread, 3_600_000 + i],
        [null, 1_800_000 + i],
        ['other-thread', 600_000],
      ],
      outbound: i % 3 === 0 ? [] : [[thread, 900_000 + i * 7]],
    });
  }
  for (let i = 0; i < 40; i++) {
    out.push({
      id: `sess-tri-${i}`,
      group: 'ag-tri',
      mg: 'mg-dash-tri',
      thread: `tri-${i % 30}`,
      inbound: [[`tri-${i % 30}`, 120_000 + i]],
      outbound: [[`tri-${i % 30}`, 60_000 + i]],
    });
  }
  return out;
}

function seedFleet(): void {
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE agent_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE messaging_groups (id TEXT PRIMARY KEY, channel_type TEXT NOT NULL, platform_id TEXT NOT NULL,
      instance TEXT, name TEXT, is_group INTEGER DEFAULT 0, unknown_sender_policy TEXT, created_at TEXT NOT NULL);
    CREATE TABLE messaging_group_agents (messaging_group_id TEXT, agent_group_id TEXT);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, messaging_group_id TEXT, thread_id TEXT,
      status TEXT DEFAULT 'active', container_status TEXT DEFAULT 'stopped', last_active TEXT, created_at TEXT NOT NULL);
  `);
  const now = new Date(NOW).toISOString();
  const ag = db.prepare('INSERT INTO agent_groups (id, name, folder, created_at) VALUES (?, ?, ?, ?)');
  ag.run('ag-main', 'Main', 'main', now);
  ag.run('ag-tri', 'Triager', 'triager', now);
  const mg = db.prepare('INSERT INTO messaging_groups (id, channel_type, platform_id, created_at) VALUES (?, ?, ?, ?)');
  mg.run('mg-dash-main', 'dashboard', 'dashboard:main', now);
  mg.run('mg-dash-tri', 'dashboard', 'dashboard:triager', now);
  mg.run('mg-a2a', 'agent', 'agent:ag-tri:ag-main', now);
  mg.run('mg-slack', 'slack', 'slack:C1', now);
  const sess = db.prepare(
    'INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const all = fleet();
  db.transaction(() => {
    for (const s of all) sess.run(s.id, s.group, s.mg, s.thread, s.status ?? 'active', now);
  })();
  db.close();
  for (const s of all) writeSessionDbs({ inbound: [], outbound: [], ...s });
  // Scheduled tasks: one recurring and one paused task in two triager sessions.
  addTask('sess-tri-1', 'task-cron', 'pending', '0 * * * *');
  addTask('sess-tri-2', 'task-paused', 'paused', null);
}

/** Add a scheduled task row to a triager session's inbound.db. */
function addTask(sessionId: string, id: string, status: string, recurrence: string | null): void {
  const db = new Database(path.join(SESSIONS_DIR, 'ag-tri', sessionId, 'inbound.db'));
  db.prepare(
    "INSERT INTO messages_in (id, kind, content, timestamp, recurrence, process_after, status) VALUES (?, 'task', ?, ?, ?, ?, ?)",
  ).run(id, JSON.stringify({ prompt: `run ${id}` }), iso(0), recurrence, iso(-3_600_000), status);
  db.close();
}

/**
 * The oracle: the per-request scan that /api/messages ran before the summary
 * worker, copied from the handler it replaced. It opens both DBs of every
 * per-thread session of the group, the way the main thread used to.
 */
function legacyThreadSummaries(folder: string): Record<string, unknown> {
  const db = new Database(DB_PATH, { readonly: true });
  const ag = db.prepare('SELECT id FROM agent_groups WHERE folder = ?').get(folder) as { id: string };
  const dashMgId = (
    db
      .prepare("SELECT id FROM messaging_groups WHERE channel_type = 'dashboard' AND platform_id = ?")
      .get(`dashboard:${folder}`) as { id: string }
  ).id;
  const threadSessions = db
    .prepare(
      `SELECT s.id, s.thread_id FROM sessions s LEFT JOIN messaging_groups mg ON s.messaging_group_id = mg.id
        WHERE s.agent_group_id = ? AND s.status = 'active' AND s.thread_id IS NOT NULL
          AND (s.messaging_group_id = ? OR mg.channel_type = 'agent')`,
    )
    .all(ag.id, dashMgId) as Array<{ id: string; thread_id: string }>;
  db.close();
  const threadSummaries: Record<string, { replyCount: number; lastReplyTs: string | null; sessionId: string | null }> =
    {};
  for (const ts of threadSessions) {
    let count = 0;
    let lastTs: string | null = null;
    for (const file of ['inbound.db', 'outbound.db']) {
      const p = path.join(SESSIONS_DIR, ag.id, ts.id, file);
      if (!existsSync(p)) continue;
      try {
        const sdb = new Database(p, { readonly: true });
        try {
          const table = file === 'inbound.db' ? 'messages_in' : 'messages_out';
          let row: { n: number; ts: string | null };
          try {
            row = sdb
              .prepare(
                `SELECT COUNT(*) AS n, MAX(timestamp) AS ts FROM ${table} WHERE thread_id = ? OR thread_id IS NULL`,
              )
              .get(ts.thread_id) as { n: number; ts: string | null };
          } catch {
            row = sdb.prepare(`SELECT COUNT(*) AS n, MAX(timestamp) AS ts FROM ${table}`).get() as {
              n: number;
              ts: string | null;
            };
          }
          count += row.n || 0;
          if (row.ts && (!lastTs || row.ts > lastTs)) lastTs = row.ts;
        } catch {
          /* ignore */
        }
        sdb.close();
      } catch {
        /* ignore */
      }
    }
    if (count > 0) {
      const existing = threadSummaries[ts.thread_id];
      if (!existing) {
        threadSummaries[ts.thread_id] = { replyCount: count, lastReplyTs: lastTs, sessionId: ts.id };
      } else {
        const newer = !!lastTs && (!existing.lastReplyTs || lastTs > existing.lastReplyTs);
        threadSummaries[ts.thread_id] = {
          replyCount: existing.replyCount + count,
          lastReplyTs: newer ? lastTs : existing.lastReplyTs,
          sessionId: newer ? ts.id : existing.sessionId,
        };
      }
    }
  }
  return threadSummaries;
}

/** Transcripts for the context scans: a busy session with a compaction and an idle older one. */
function writeTranscripts(): void {
  const dir = path.join(SESSIONS_DIR, 'ag-main', '.claude-shared', 'projects', '-workspace-group');
  mkdirSync(dir, { recursive: true });
  const turn = (ts: string, model: string, input: number, cacheRead: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: ts,
      message: {
        model,
        usage: {
          input_tokens: input,
          cache_read_input_tokens: cacheRead,
          cache_creation_input_tokens: 500,
          output_tokens: 90,
        },
      },
    });
  const compact = (ts: string) =>
    JSON.stringify({
      type: 'system',
      subtype: 'compact_boundary',
      timestamp: ts,
      compactMetadata: { trigger: 'auto', preTokens: 150_000 },
    });
  const old = path.join(dir, 'sdk-old.jsonl');
  writeFileSync(old, [turn(iso(9 * 86400_000), 'claude-sonnet-5-5', 1_000, 40_000)].join('\n') + '\n');
  // The context window reads the newest transcript, so the old one must not tie with the busy one.
  const nineDaysAgo = new Date(NOW - 9 * 86400_000);
  utimesSync(old, nineDaysAgo, nineDaysAgo);
  writeFileSync(
    path.join(dir, 'sdk-busy.jsonl'),
    [
      turn(iso(3_000), 'claude-opus-4-8[1m]', 2_000, 120_000),
      compact(iso(2_000)),
      turn(iso(1_000), 'claude-opus-4-8[1m]', 3_000, 60_000),
    ].join('\n') + '\n',
  );
}

async function waitFor(cond: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// Long intervals: each test drives the passes it needs through the first run.
const QUIET = {
  threadsIntervalMs: 3_600_000,
  contextWindowIntervalMs: 3_600_000,
  contextStatsIntervalMs: 3_600_000,
  tasksIntervalMs: 3_600_000,
};

/** Two free TCP ports on 127.0.0.1. */
async function freePorts(n: number): Promise<number[]> {
  const ports: number[] = [];
  const servers = [];
  for (let i = 0; i < n; i++) {
    const srv = createNetServer();
    srv.listen(0, '127.0.0.1');
    await once(srv, 'listening');
    ports.push((srv.address() as { port: number }).port);
    servers.push(srv);
  }
  for (const srv of servers) srv.close();
  return ports;
}

/** A summary without its publish time, for comparing two scans of the same files. */
function withoutRefreshedAt(groups: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(groups).map(([id, { refreshedAt: _t, ...rest }]) => [id, rest]));
}

describe('summary worker', () => {
  let srv: ReturnType<typeof startServer>;
  let baseUrl = '';
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env.NANOCLAW_DASHBOARD_DATA_DIR = DATA_DIR;
    process.env.NANOCLAW_DASHBOARD_DB_PATH = DB_PATH;
    seedFleet();
    writeTranscripts();
  }, 120_000);
  afterAll(() => {
    logSpy.mockRestore();
    rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
    delete process.env.NANOCLAW_DASHBOARD_DATA_DIR;
    delete process.env.NANOCLAW_DASHBOARD_DB_PATH;
  });
  beforeEach(async () => {
    process.env.NANOCLAW_DASHBOARD_DATA_DIR = DATA_DIR;
    process.env.NANOCLAW_DASHBOARD_DB_PATH = DB_PATH;
    resetTransientDashboardStateForTests();
    hooks?.reset();
    forceOpenDbForTests();
    srv = startServer(0);
    await once(srv, 'listening');
    const address = srv.address();
    if (!address || typeof address === 'string') throw new Error('expected a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    await hooks?.stopSummaryWorker();
    hooks?.reset();
    resetTransientDashboardStateForTests();
    await new Promise<void>((resolve, reject) => srv.close((err) => (err ? reject(err) : resolve())));
  });

  async function mainView(group: string): Promise<{ text: string; summaries: Record<string, any> }> {
    const res = await fetch(`${baseUrl}/api/messages?group=${group}&limit=30`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { threadSummaries: Record<string, any> };
    return { text: JSON.stringify(body.threadSummaries), summaries: body.threadSummaries };
  }

  async function debugView(): Promise<any> {
    const res = await fetch(`${baseUrl}/api/debug`);
    expect(res.status).toBe(200);
    return ((await res.json()) as { perf: { summaryWorker: any } }).perf.summaryWorker;
  }

  it('publishes the same threadSummaries as the per-request scan it replaces', async () => {
    const expectedMain = legacyThreadSummaries('main');
    const expectedTri = legacyThreadSummaries('triager');
    // The fixture exercises every branch: shared threads, a2a threads, legacy
    // and partial DBs; Slack, closed and empty sessions stay out.
    expect(Object.keys(expectedMain)).toHaveLength(MAIN_THREAD_SESSIONS - MAIN_THREAD_SESSIONS / 5 + 3);
    expect(expectedMain['t-0']).toMatchObject({ replyCount: 5 });
    expect(expectedMain['legacy-t']).toMatchObject({ replyCount: 2 });
    for (const t of ['slack-t', 'closed-t', 'empty-t', 'no-files-t']) expect(expectedMain[t]).toBeUndefined();
    expect(Object.keys(expectedTri)).toHaveLength(30);

    hooks!.startSummaryWorker({ ...QUIET, restartOnFailure: false });
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 1, 30_000, 'first threads pass');

    expect((await mainView('main')).text).toBe(JSON.stringify(expectedMain));
    expect((await mainView('triager')).text).toBe(JSON.stringify(expectedTri));
    const view = await debugView();
    expect(view).toMatchObject({ workerRunning: true, lastError: null, threads: { generation: 1, stale: false } });
    expect(view.threads.phases).toMatchObject({ sessions: MAIN_THREAD_SESSIONS + 40 + 6, readErrors: 0 });
  }, 60_000);

  it('picks up a new message on the next pass and reopens only the changed file', async () => {
    hooks!.startSummaryWorker({ ...QUIET, threadsIntervalMs: 200, restartOnFailure: false });
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 2, 30_000, 'second threads pass');
    expect(hooks!.summarySnapshotView().threads.phases.opens).toBe(0);
    const before = (await mainView('triager')).summaries['tri-3'].replyCount;

    const p = path.join(SESSIONS_DIR, 'ag-tri', 'sess-tri-3', 'inbound.db');
    const db = new Database(p);
    db.prepare(
      "INSERT INTO messages_in (id, kind, content, timestamp, thread_id) VALUES ('late-1', 'chat', '{}', ?, 'tri-3')",
    ).run(new Date().toISOString());
    db.close();

    await waitFor(() => hooks!.summarySnapshotView().threads.phases.opens >= 1, 10_000, 'a pass that saw the write');
    expect(hooks!.summarySnapshotView().threads.phases.opens).toBe(1);
    expect((await mainView('triager')).summaries['tri-3'].replyCount).toBe(before + 1);
  }, 60_000);

  it('serves the main view from the published result, without opening session DBs', async () => {
    hooks!.startSummaryWorker({ ...QUIET, restartOnFailure: false });
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 1, 30_000, 'first threads pass');
    await hooks!.stopSummaryWorker();
    const expected = JSON.stringify(legacyThreadSummaries('triager'));
    // With the session DBs gone, a handler that still opened them would find nothing.
    const moved = `${SESSIONS_DIR}.moved`;
    renameSync(SESSIONS_DIR, moved);
    try {
      expect((await mainView('triager')).text).toBe(expected);
    } finally {
      renameSync(moved, SESSIONS_DIR);
    }
  }, 60_000);

  // The revert drill: with the per-request scan back in server.ts this test
  // fails, because each main-view request holds the event loop while it opens
  // two DBs for each of the 1,500 per-thread sessions.
  it('answers the main view of a large coworker without holding the event loop', async () => {
    if (hooks) {
      hooks.startSummaryWorker({ ...QUIET, restartOnFailure: false });
      await waitFor(() => hooks.summarySnapshotView().threads.generation >= 1, 30_000, 'first threads pass');
    } else {
      refreshThreadSummariesForTests?.();
    }
    // The server runs on this thread, so a timer here sees every stall it causes.
    let last = performance.now();
    let maxLagMs = 0;
    const timer = setInterval(() => {
      const now = performance.now();
      maxLagMs = Math.max(maxLagMs, now - last - 5);
      last = now;
    }, 5);
    try {
      for (let i = 0; i < 5; i++) {
        const { summaries } = await mainView('main');
        expect(Object.keys(summaries).length).toBeGreaterThan(1000);
      }
    } finally {
      clearInterval(timer);
    }
    expect(maxLagMs).toBeLessThan(100);
  }, 60_000);

  it('keeps answering while a slow pass runs in the worker', async () => {
    // Each threads pass holds the worker thread for 3s, standing in for a cold scan of a large fleet.
    hooks!.startSummaryWorker({ ...QUIET, testDelayMs: 3_000, restartOnFailure: false });
    await new Promise((r) => setTimeout(r, 1_000));
    expect(hooks!.summarySnapshotView().threads.generation).toBe(0);
    const latencies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const res = await fetch(`${baseUrl}/api/messages?group=main&limit=30`);
      expect(res.ok).toBe(true);
      await res.json();
      latencies.push(Date.now() - t0);
    }
    // All answered during the pass, not after it.
    expect(hooks!.summarySnapshotView().threads.generation).toBe(0);
    expect(Math.max(...latencies)).toBeLessThan(500);
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 1, 30_000, 'slow threads pass');
  }, 60_000);

  it('a dead worker leaves the last result served, marked stale', async () => {
    const worker = hooks!.startSummaryWorker({ ...QUIET, restartOnFailure: false });
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 1, 30_000, 'first threads pass');
    const before = (await mainView('triager')).text;
    expect(before).not.toBe('{}');

    await worker!.terminate();
    await waitFor(() => !hooks!.summarySnapshotView().workerRunning, 5_000, 'worker exit');

    expect((await mainView('triager')).text).toBe(before);
    const view = await debugView();
    expect(view).toMatchObject({ workerRunning: false, threads: { generation: 1, stale: true } });
    expect(view.lastError).toMatch(/exited/);
  }, 60_000);

  it('a dead worker is restarted and publishes again', async () => {
    const worker = hooks!.startSummaryWorker({ ...QUIET, restartMinMs: 200 });
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 1, 30_000, 'first threads pass');
    await worker!.terminate();
    await waitFor(() => hooks!.summarySnapshotView().threads.generation >= 2, 30_000, 'restarted threads pass');
    expect(hooks!.summarySnapshotView()).toMatchObject({ restarts: 1, workerRunning: true, threads: { stale: false } });
    expect((await mainView('triager')).text).toBe(JSON.stringify(legacyThreadSummaries('triager')));
  }, 60_000);

  it('a failed pass keeps the last result and reports the error', async () => {
    refreshThreadSummariesForTests!();
    const before = (await mainView('triager')).text;
    expect(before).not.toBe('{}');
    hooks!.startSummaryWorker({ ...QUIET, centralDbPath: path.join(DATA_DIR, 'missing.db'), restartOnFailure: false });
    await waitFor(() => hooks!.summarySnapshotView().lastError !== null, 30_000, 'worker error');
    expect((await mainView('triager')).text).toBe(before);
    const view = await debugView();
    expect(view).toMatchObject({ workerRunning: true, threads: { generation: 1, stale: true } });
    expect(view.lastError).toMatch(/missing\.db|unable to open|does not exist/i);
  }, 60_000);

  it('publishes the same context window and context stats as the in-process scan', async () => {
    refreshContextCachesForTests!();
    const window = hooks!.contextWindow();
    const stats = hooks!.contextStats();
    expect(window.main).toMatchObject({ contextTokens: 63_500, maxContext: 1_000_000, model: 'claude-opus-4-8[1m]' });
    expect((stats['ag-main'] as any).all).toMatchObject({ sessions: 2, compactions: 1, avgPreTokens: 150_000 });
    expect((stats['ag-main'] as any)['1d']).toMatchObject({ sessions: 1, compactions: 1 });

    hooks!.reset();
    hooks!.startSummaryWorker({ ...QUIET, contextStatsFirstDelayMs: 0, restartOnFailure: false });
    await waitFor(
      () => {
        const v = hooks!.summarySnapshotView();
        return v.contextWindow.generation >= 1 && v.contextStats.generation >= 1;
      },
      30_000,
      'first context passes',
    );
    expect(hooks!.contextWindow()).toEqual(window);
    expect(hooks!.contextStats()).toEqual(stats);
  }, 60_000);

  it('publishes the same task summaries as the in-process scan, and rescans at once after a mutation', async () => {
    refreshGroupTasksForTests!();
    const inProcess = withoutRefreshedAt(hooks!.groupTasks());
    expect(inProcess['ag-tri']).toMatchObject({ active: 1, paused: 1 });
    // sess-legacy's inbound.db has no task columns: it reads as no tasks, not as a failed read.
    expect(inProcess['ag-main']).toMatchObject({ active: 0, paused: 0 });
    expect(inProcess['ag-tri'].tasks.map((t: any) => t.origId).sort()).toEqual(['task-cron', 'task-paused']);

    hooks!.reset();
    hooks!.startSummaryWorker({ ...QUIET, restartOnFailure: false });
    await waitFor(() => hooks!.summarySnapshotView().tasks.generation >= 1, 30_000, 'first tasks pass');
    expect(withoutRefreshedAt(hooks!.groupTasks())).toEqual(inProcess);

    addTask('sess-tri-3', 'task-new', 'pending', null);
    hooks!.requestSummaryPass('tasks');
    await waitFor(() => hooks!.summarySnapshotView().tasks.generation >= 2, 10_000, 'requested tasks pass');
    expect(hooks!.groupTasks()['ag-tri']).toMatchObject({ active: 2, paused: 1 });
    expect(hooks!.summarySnapshotView().tasks.phases).toMatchObject({ opens: 1, readErrors: 0 });
  }, 60_000);

  // Last on purpose: the dashboard process migrates the fixture's central DB.
  it('a real dashboard process answers within seconds of starting, and its workers publish afterwards', async () => {
    const [port, readOnlyPort] = await freePorts(2);
    const env: Record<string, string | undefined> = { ...process.env };
    for (const k of Object.keys(env)) if (k.startsWith('VITEST')) delete env[k];
    Object.assign(env, {
      NANOCLAW_DASHBOARD_DATA_DIR: DATA_DIR,
      NANOCLAW_DASHBOARD_DB_PATH: DB_PATH,
      NANOCLAW_DASHBOARD_GROUPS_DIR: path.join(TEST_TMP_ROOT, 'groups'),
      NANOCLAW_DASHBOARD_LOGS_DIR: path.join(TEST_TMP_ROOT, 'logs'),
      DASHBOARD_HOST: '127.0.0.1',
      DASHBOARD_PORT: String(port),
      DASHBOARD_READONLY_PORT: String(readOnlyPort),
    });
    const base = `http://127.0.0.1:${port}`;
    const startedAt = Date.now();
    const child = spawn(process.execPath, ['--import', 'tsx', 'dashboard/server.ts'], {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr!.on('data', (d) => (stderr += String(d)));
    const health = async (): Promise<number> => {
      const t0 = Date.now();
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5_000) });
      expect(res.status).toBe(200);
      await res.text();
      return Date.now() - t0;
    };
    try {
      for (;;) {
        if (child.exitCode !== null) throw new Error(`dashboard exited: ${stderr.slice(-2000)}`);
        try {
          await health();
          break;
        } catch {
          if (Date.now() - startedAt > 30_000) throw new Error(`no answer after 30s: ${stderr.slice(-2000)}`);
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      const bootMs = Date.now() - startedAt;
      // Process start and module load only: no session scan runs before the server answers.
      expect(bootMs).toBeLessThan(15_000);

      // The workers warm up now; the main thread keeps answering meanwhile.
      const latencies: number[] = [];
      for (let i = 0; i < 20; i++) {
        latencies.push(await health());
        await new Promise((r) => setTimeout(r, 250));
      }
      expect(Math.max(...latencies)).toBeLessThan(500);

      const perf = async (): Promise<any> => ((await (await fetch(`${base}/api/debug`)).json()) as { perf: any }).perf;
      await waitFor(() => true, 0, '');
      let last: any = null;
      const until = Date.now() + 60_000;
      for (;;) {
        last = await perf();
        const sw = last.summaryWorker;
        if (last.workerActive && sw.threads.generation >= 1 && sw.tasks.generation >= 1) break;
        if (Date.now() > until) throw new Error(`workers did not publish: ${JSON.stringify(last).slice(0, 2000)}`);
        await new Promise((r) => setTimeout(r, 250));
      }
      expect(last.scanWorkerState).toMatchObject({ workerRunning: true, lastError: null });
      expect(last.summaryWorker).toMatchObject({ workerRunning: true, lastError: null });
      const res = await fetch(`${base}/api/messages?group=triager&limit=30`);
      const body = (await res.json()) as { threadSummaries: unknown };
      expect(JSON.stringify(body.threadSummaries)).toBe(JSON.stringify(legacyThreadSummaries('triager')));
    } finally {
      child.kill('SIGKILL');
    }
  }, 120_000);
});
