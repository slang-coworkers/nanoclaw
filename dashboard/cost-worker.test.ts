/**
 * The per-session cost scan runs in cost-worker.ts, off the dashboard's event
 * loop (startCostWorker in server.ts). These tests boot the real worker thread
 * against a fixture data dir and check that:
 *   - its snapshot matches the in-process computation number for number;
 *   - the API keeps answering while a slow pass is running;
 *   - a failed pass or a dead worker leaves the last snapshot served, marked stale.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import {
  __costWorkerTestHooks as hooks,
  forceOpenDbForTests,
  refreshSessionCostsForTests,
  resetTransientDashboardStateForTests,
  startServer,
} from './server.js';
import { clearLedgerCacheForTests } from './session-ledger-cost.js';

const TEST_TMP_ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-cost-worker-test-'));
const DATA_DIR = path.join(TEST_TMP_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');
const TODAY = new Date().toISOString();
const FIVE_DAYS_AGO = new Date(Date.now() - 5 * 86400_000).toISOString();

const COST_EVENTS_DDL = `
  CREATE TABLE IF NOT EXISTS cost_events (
    id TEXT PRIMARY KEY, ts TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0, cache_read_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0, cache_write_5m_tokens INTEGER NOT NULL DEFAULT 0,
    cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
    reasoning_tokens INTEGER NOT NULL DEFAULT 0, priced_usd REAL NOT NULL, rate_version INTEGER NOT NULL,
    adjustment_usd REAL NOT NULL DEFAULT 0, window_gen INTEGER NOT NULL DEFAULT 0,
    thread_id TEXT, gh_ref TEXT, created_at TEXT NOT NULL,
    acct_seg INTEGER, acct_epoch INTEGER, acct_cfg_model INTEGER
  );
`;

function sessionDir(sessId: string): string {
  return path.join(DATA_DIR, 'v2-sessions', 'ag-1', sessId);
}

/** A ledger session: Claude rows today and 5 days ago, a codex row and an adjustment. */
function writeLedgerSession(): void {
  const p = path.join(sessionDir('sess-ledger'), 'outbound.db');
  mkdirSync(path.dirname(p), { recursive: true });
  const db = new Database(p);
  db.exec(COST_EVENTS_DDL);
  const ins = db.prepare(
    `INSERT INTO cost_events (id, ts, provider, model, input_tokens, output_tokens, cache_read_tokens,
       priced_usd, rate_version, adjustment_usd, acct_seg, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  );
  ins.run('claude:1:msg_A', TODAY, 'claude', 'claude-opus-5-5', 1000, 2000, 40_000, 0, 0, 1, TODAY);
  ins.run('claude:1:msg_B', FIVE_DAYS_AGO, 'claude', 'claude-sonnet-5-5', 300, 900, 0, 0, 0, 1, FIVE_DAYS_AGO);
  ins.run('codex:r#1', TODAY, 'codex', 'gpt-5.5', 7000, 400, 3000, 0.42, 0, null, TODAY);
  ins.run('adj:sess-ledger:1', TODAY, 'claude', '', 0, 0, 0, 1.5, 1.5, null, TODAY);
  db.close();
}

/** A pre-ledger session: an outbound.db without cost_events, priced from its transcript. */
function writeTranscriptSession(): void {
  const out = path.join(sessionDir('sess-old'), 'outbound.db');
  mkdirSync(path.dirname(out), { recursive: true });
  const odb = new Database(out);
  odb.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT)');
  odb.close();
  const dir = path.join(DATA_DIR, 'v2-sessions', 'ag-1', '.claude-shared', 'projects', '-workspace-group');
  mkdirSync(dir, { recursive: true });
  const line = (id: string, ts: string, out: number) =>
    JSON.stringify({
      type: 'assistant',
      timestamp: ts,
      message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: out } },
    });
  writeFileSync(
    path.join(dir, 'sdk-old.jsonl'),
    [line('m1', TODAY, 2000), line('m2', FIVE_DAYS_AGO, 500), line('m1', TODAY, 2000)].join('\n') + '\n',
  );
}

/** A pre-ledger session with a codex rollout. */
function writeCodexSession(): void {
  const out = path.join(sessionDir('sess-codex'), 'outbound.db');
  mkdirSync(path.dirname(out), { recursive: true });
  const odb = new Database(out);
  odb.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT)');
  odb.close();
  const d = TODAY.slice(0, 10).split('-');
  const dir = path.join(sessionDir('sess-codex'), 'codex', 'sessions', d[0], d[1], d[2]);
  mkdirSync(dir, { recursive: true });
  const lines = [
    { timestamp: TODAY, type: 'turn_context', payload: { model: 'gpt-5.5' } },
    {
      timestamp: TODAY,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { last_token_usage: { input_tokens: 200_000, cached_input_tokens: 50_000, output_tokens: 10_000 } },
      },
    },
  ];
  writeFileSync(
    path.join(dir, `rollout-${d.join('-')}T00-00-00-x.jsonl`),
    lines.map((l) => JSON.stringify(l)).join('\n'),
  );
}

function seedFixture(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE agent_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, agent_group_id TEXT NOT NULL, thread_id TEXT,
      status TEXT DEFAULT 'active', container_status TEXT DEFAULT 'stopped', last_active TEXT, created_at TEXT NOT NULL);
    CREATE TABLE sdk_session_routes (sdk_session_id TEXT PRIMARY KEY, nanoclaw_session_id TEXT);
  `);
  db.prepare("INSERT INTO agent_groups (id, name, folder, created_at) VALUES ('ag-1', 'cw', 'cw', ?)").run(TODAY);
  for (const id of ['sess-ledger', 'sess-old', 'sess-codex']) {
    db.prepare("INSERT INTO sessions (id, agent_group_id, created_at) VALUES (?, 'ag-1', ?)").run(id, TODAY);
  }
  db.prepare("INSERT INTO sdk_session_routes VALUES ('sdk-old', 'sess-old')").run();
  db.close();
  writeLedgerSession();
  writeTranscriptSession();
  writeCodexSession();
}

async function waitFor(cond: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const PERIODS = ['1d', '7d', '30d', 'all'] as const;
const COST_FIELDS = ['cost', 'claudeUsd', 'codexUsd', 'openUsd', 'costSource', 'tokens'] as const;

describe('cost worker', () => {
  let server: ReturnType<typeof startServer>;
  let baseUrl = '';
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
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
    clearLedgerCacheForTests();
    hooks.reset();
    seedFixture();
    forceOpenDbForTests();
    server = startServer(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('expected a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    await hooks.stopCostWorker();
    hooks.reset();
    resetTransientDashboardStateForTests();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  async function getSessions(period: string): Promise<{ rows: Record<string, any>; body: Record<string, any> }> {
    const res = await fetch(`${baseUrl}/api/sessions?period=${period}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: Array<Record<string, any>> } & Record<string, any>;
    return { rows: Object.fromEntries(body.sessions.map((s) => [s.session_id, s])), body };
  }

  async function costColumns(): Promise<Record<string, Record<string, unknown>>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const period of PERIODS) {
      const { rows } = await getSessions(period);
      for (const [id, r] of Object.entries(rows)) {
        out[`${period}/${id}`] = Object.fromEntries(COST_FIELDS.map((f) => [f, r[f]]));
      }
    }
    return out;
  }

  it('publishes the same numbers as the in-process computation', async () => {
    refreshSessionCostsForTests();
    const inProcess = await costColumns();
    // Every source in the fixture is priced (non-zero) in some period.
    expect((inProcess['all/sess-ledger'] as any).costSource).toBe('ledger');
    expect((inProcess['all/sess-ledger'] as any).cost).toBeGreaterThan(1.5);
    expect((inProcess['all/sess-old'] as any).costSource).toBe('transcript');
    expect((inProcess['all/sess-old'] as any).cost).toBeGreaterThan(0);
    expect((inProcess['1d/sess-codex'] as any).codexUsd).toBeGreaterThan(0);

    // Start from nothing served, and a cold worker (no persisted per-file cache).
    hooks.reset();
    rmSync(path.join(DATA_DIR, 'cost-thresholds.json'), { force: true });
    expect((await getSessions('all')).rows['sess-ledger'].cost).toBeFalsy();
    hooks.startCostWorker({ firstDelayMs: 0, intervalMs: 3_600_000, restartOnFailure: false });
    await waitFor(() => hooks.costSnapshotView().generation >= 1, 20_000, 'first worker snapshot');

    expect(await costColumns()).toEqual(inProcess);
    const { body } = await getSessions('30d');
    expect(body.costSnapshot).toMatchObject({ generation: 1, stale: false, workerRunning: true, lastError: null });
    expect(body.costSnapshot.phases).toMatchObject({ sessions: 3, ledgerSessions: 1 });
    expect(body.costSnapshot.phases.totalMs).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('keeps answering requests while a slow pass runs in the worker', async () => {
    // Each pass holds the worker thread for 3s, standing in for a large fleet.
    hooks.startCostWorker({ firstDelayMs: 0, intervalMs: 3_600_000, testDelayMs: 3_000, restartOnFailure: false });
    // Give the worker time to start and enter the busy pass.
    await new Promise((r) => setTimeout(r, 1_000));
    expect(hooks.costSnapshotView().generation).toBe(0);
    const latencies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t0 = Date.now();
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.ok).toBe(true);
      latencies.push(Date.now() - t0);
    }
    // All answered during the pass, not after it.
    expect(hooks.costSnapshotView().generation).toBe(0);
    expect(Math.max(...latencies)).toBeLessThan(500);
    await waitFor(() => hooks.costSnapshotView().generation >= 1, 20_000, 'slow worker snapshot');
    expect(hooks.costSnapshotView().phases!.totalMs).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('a dead worker leaves the last snapshot served, marked stale', async () => {
    const worker = hooks.startCostWorker({ firstDelayMs: 0, intervalMs: 3_600_000, restartOnFailure: false });
    expect(worker).not.toBeNull();
    await waitFor(() => hooks.costSnapshotView().generation >= 1, 20_000, 'first worker snapshot');
    const before = (await getSessions('all')).rows['sess-ledger'].cost;
    expect(before).toBeGreaterThan(0);

    await worker!.terminate();
    await waitFor(() => !hooks.costSnapshotView().workerRunning, 5_000, 'worker exit');

    const { rows, body } = await getSessions('all');
    expect(rows['sess-ledger'].cost).toBe(before);
    expect(body.costSnapshot).toMatchObject({ generation: 1, stale: true, workerRunning: false });
    expect(body.costSnapshot.lastError).toMatch(/exited/);
  }, 30_000);

  it('a dead worker is restarted and publishes again', async () => {
    const worker = hooks.startCostWorker({ firstDelayMs: 0, intervalMs: 3_600_000, restartMinMs: 200 });
    await waitFor(() => hooks.costSnapshotView().generation >= 1, 20_000, 'first worker snapshot');
    await worker!.terminate();
    await waitFor(() => hooks.costSnapshotView().generation >= 2, 20_000, 'snapshot from the restarted worker');
    expect(hooks.costSnapshotView()).toMatchObject({ restarts: 1, stale: false, workerRunning: true });
  }, 30_000);

  it('a failed pass keeps the last snapshot and reports the error', async () => {
    refreshSessionCostsForTests();
    const before = (await getSessions('all')).rows['sess-ledger'].cost;
    expect(before).toBeGreaterThan(0);
    hooks.startCostWorker({
      firstDelayMs: 0,
      intervalMs: 3_600_000,
      centralDbPath: path.join(DATA_DIR, 'missing.db'),
      restartOnFailure: false,
    });
    await waitFor(() => hooks.costSnapshotView().lastError !== null, 20_000, 'worker error');
    const { rows, body } = await getSessions('all');
    expect(rows['sess-ledger'].cost).toBe(before);
    expect(body.costSnapshot).toMatchObject({ generation: 1, stale: true, workerRunning: true });
    expect(body.costSnapshot.lastError).toMatch(/missing\.db|unable to open|does not exist/i);
  }, 30_000);
});
