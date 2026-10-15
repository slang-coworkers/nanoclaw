/**
 * Per-session cost from the runner's `cost_events` ledger (session-ledger-cost.ts)
 * and its wiring into GET /api/sessions:
 *   - folding mirrors the runner's sumWindow/priceTokens: every row summed
 *     (base + signed top-ups + residuals + adjustments), Claude rows repriced
 *     from tokens (priced_usd ignored), codex rows keep priced_usd;
 *   - a session with ledger rows is priced ONLY from the ledger (its transcript
 *     and codex rollouts are skipped — no double count);
 *   - a session with no ledger rows falls back to transcript pricing.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import {
  forceOpenDbForTests,
  refreshSessionCostsForTests,
  resetTransientDashboardStateForTests,
  startServer,
} from './server.js';
import { MODEL_PRICING, priceUsage } from './session-costs.js';
import {
  clearLedgerCacheForTests,
  foldLedgerRows,
  getSessionLedgerCost,
  priceLedgerRow,
  readLedgerFromDb,
  type LedgerRow,
} from './session-ledger-cost.js';

const OPUS = MODEL_PRICING['claude-opus-5-5'];
const SONNET = MODEL_PRICING['claude-sonnet-5-5'];

const TEST_TMP_ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-ledger-cost-test-'));
const DATA_DIR = path.join(TEST_TMP_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');

const TODAY = new Date().toISOString();
const THREE_DAYS_AGO = new Date(Date.now() - 3 * 86400_000).toISOString();

/** The runner's cost_events DDL (container/agent-runner/src/cost-events.ts createCostEventsTable). */
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
  CREATE INDEX IF NOT EXISTS cost_events_ts ON cost_events(ts);
`;

function row(p: Partial<LedgerRow> & { id: string }): LedgerRow {
  return {
    ts: TODAY,
    provider: 'claude',
    model: 'claude-opus-5-5',
    input_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cache_write_5m_tokens: 0,
    cache_write_1h_tokens: 0,
    output_tokens: 0,
    // Deliberately WRONG write-time cache on Claude rows: reads must reprice from tokens.
    priced_usd: 999,
    adjustment_usd: 0,
    window_gen: 1,
    ...p,
  };
}

/**
 * One session's worth of every row shape the runner writes:
 *  - msg_A: base row with the start-of-stream output snapshot + a signed top-up `#1`
 *  - msg_B: first reported under sonnet, model-corrected to opus (`#1` negative
 *    under sonnet, `#2` full usage under opus) — net = the opus usage only
 *  - a backstop residual and a negative residual claimed back by a late call
 *  - an `adj:` adjustment (dollars, zero tokens) and the migration `adj:…:base:` seed
 *  - a codex call (priced_usd kept)
 *  - one older msg_C (3 days ago) to exercise the period windows
 */
function fixtureRows(): LedgerRow[] {
  return [
    row({
      id: 'claude:1:msg_A',
      input_tokens: 1000,
      output_tokens: 10,
      cache_read_tokens: 50_000,
      cache_write_1h_tokens: 2000,
    }),
    row({ id: 'claude:1:msg_A#1', output_tokens: 990 }),
    row({
      id: 'claude:1:msg_B',
      model: 'claude-sonnet-5-5',
      input_tokens: 500,
      output_tokens: 200,
      cache_write_5m_tokens: 100,
    }),
    row({
      id: 'claude:1:msg_B#1',
      model: 'claude-sonnet-5-5',
      input_tokens: -500,
      output_tokens: -200,
      cache_write_5m_tokens: -100,
    }),
    row({ id: 'claude:1:msg_B#2', input_tokens: 500, output_tokens: 200, cache_write_5m_tokens: 100 }),
    row({ id: 'claude:1:residual:seg1:t1:claude-opus-5-5', output_tokens: 3000, cache_write_tokens: 400 }),
    row({ id: 'claude:1:residual:seg1:c7:claude-opus-5-5', output_tokens: -1000 }),
    row({ id: 'adj:sess-ledger:3', model: 'claude-opus-5-5', adjustment_usd: 2.5, priced_usd: 2.5 }),
    row({ id: 'adj:sess-ledger:base:1', model: '', adjustment_usd: 10, priced_usd: 10 }),
    row({
      id: 'codex:rollout-x#call-1',
      provider: 'codex',
      model: 'gpt-5.5',
      input_tokens: 7000,
      cache_read_tokens: 3000,
      output_tokens: 400,
      priced_usd: 0.42,
    }),
    row({ id: 'claude:0:msg_C', ts: THREE_DAYS_AGO, input_tokens: 100, output_tokens: 1000 }),
  ];
}

const msgA = 1000 * OPUS.input + 1000 * OPUS.output + 50_000 * OPUS.cacheRead + 2000 * OPUS.input * 2;
const msgB = 500 * OPUS.input + 200 * OPUS.output + 100 * OPUS.cacheCreate;
const residual = 2000 * OPUS.output + 400 * OPUS.cacheCreate;
const adjustments = 2.5 + 10;
const codex = 0.42;
const msgC = 100 * OPUS.input + 1000 * OPUS.output;
const TODAY_CLAUDE = msgA + msgB + residual + adjustments;
const LIFETIME = TODAY_CLAUDE + codex + msgC;

function writeLedger(dbPath: string, rows: LedgerRow[]): void {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(COST_EVENTS_DDL);
  const ins = db.prepare(
    `INSERT INTO cost_events (id, ts, provider, model, input_tokens, cache_read_tokens, cache_write_tokens,
       cache_write_5m_tokens, cache_write_1h_tokens, output_tokens, priced_usd, rate_version, adjustment_usd, window_gen, created_at)
     VALUES (@id, @ts, @provider, @model, @input_tokens, @cache_read_tokens, @cache_write_tokens,
       @cache_write_5m_tokens, @cache_write_1h_tokens, @output_tokens, @priced_usd, 1, @adjustment_usd, @window_gen, @ts)`,
  );
  for (const r of rows) ins.run(r);
  db.close();
}

describe('priceLedgerRow — mirrors the runner priceTokens + adjustment_usd', () => {
  it('reprices a Claude row from tokens, ignoring the stale priced_usd cache', () => {
    const r = row({
      id: 'x',
      input_tokens: 1000,
      output_tokens: 100,
      cache_read_tokens: 10,
      cache_write_1h_tokens: 20,
    });
    // Same number the transcript pricer gives for the same usage → the two sources agree per call.
    const viaTranscript = priceUsage('claude-opus-5-5', {
      input_tokens: 1000,
      output_tokens: 100,
      cache_read_input_tokens: 10,
      cache_creation_input_tokens: 20,
      cache_creation: { ephemeral_1h_input_tokens: 20, ephemeral_5m_input_tokens: 0 },
    });
    expect(priceLedgerRow(r).usd).toBeCloseTo(viaTranscript, 12);
  });

  it('prices 1h cache writes at 2x input and the flat write at the 5m rate', () => {
    expect(priceLedgerRow(row({ id: 'a', cache_write_1h_tokens: 1000 })).usd).toBeCloseTo(1000 * OPUS.input * 2, 12);
    expect(priceLedgerRow(row({ id: 'b', cache_write_tokens: 1000 })).usd).toBeCloseTo(1000 * OPUS.cacheCreate, 12);
  });

  it('prices a negative (signed correction) row as a negative amount', () => {
    expect(priceLedgerRow(row({ id: 'c#1', output_tokens: -1000 })).usd).toBeCloseTo(-1000 * OPUS.output, 12);
  });

  it('counts an adjustment row as its stored dollars, even with an empty model', () => {
    const p = priceLedgerRow(row({ id: 'adj:s:1', model: '', adjustment_usd: 3.25, priced_usd: 3.25 }));
    expect(p.usd).toBeCloseTo(3.25, 12);
    expect(p.unpriced).toBe(false);
  });

  it('keeps priced_usd for codex rows', () => {
    const p = priceLedgerRow(
      row({ id: 'codex:k', provider: 'codex', model: 'gpt-5.5', input_tokens: 5, priced_usd: 0.07 }),
    );
    expect(p.usd).toBe(0.07);
  });

  it('flags billed tokens on an unknown Claude model as unpriced ($0)', () => {
    const p = priceLedgerRow(row({ id: 'u', model: 'claude-mystery-9', input_tokens: 100 }));
    expect(p).toMatchObject({ usd: 0, unpriced: true });
  });
});

describe('foldLedgerRows — session total = sum of every row', () => {
  it('folds base + top-up + model correction + residual + adj + codex rows', () => {
    const f = foldLedgerRows(fixtureRows());
    expect(f.hasRows).toBe(true);
    expect(f.rowCount).toBe(11);
    let total = 0;
    let claude = 0;
    let codexUsd = 0;
    for (const d of f.days.values()) {
      total += d.cost;
      claude += d.claudeUsd;
      codexUsd += d.codexUsd;
    }
    expect(total).toBeCloseTo(LIFETIME, 9);
    expect(claude).toBeCloseTo(LIFETIME - codex, 9);
    expect(codexUsd).toBeCloseTo(codex, 12);
    // Day buckets come from each row's own UTC ts.
    expect(f.days.get(THREE_DAYS_AGO.slice(0, 10).replace(/-/g, ''))!.cost).toBeCloseTo(msgC, 12);
  });

  it('drops LEDGER_BASELINE_GEN (-1) rows when the migration seed covers them', () => {
    // poll-loop.ts performLedgerMigrationBaseline: the seed `adj:<sess>:base:<n>`
    // holds the counter's pre-ledger spend; the codex history that existed then is
    // stamped at gen -1 because its dollars are already inside the seed.
    const rows = [
      row({ id: 'adj:s:base:1', model: '', adjustment_usd: 10, priced_usd: 10, window_gen: 2 }),
      row({ id: 'codex:old#1', provider: 'codex', model: 'gpt-5.5', input_tokens: 5, priced_usd: 4, window_gen: -1 }),
      row({ id: 'codex:new#1', provider: 'codex', model: 'gpt-5.5', input_tokens: 5, priced_usd: 1, window_gen: 2 }),
    ];
    const total = [...foldLedgerRows(rows).days.values()].reduce((s, d) => s + d.cost, 0);
    expect(total).toBeCloseTo(11, 12);
  });

  it('keeps gen -1 rows dated AFTER the migration seed (a later /clear re-baseline)', () => {
    const seedTs = '2026-10-01T12:00:00.000Z';
    const rows = [
      row({ id: 'adj:s:base:1', ts: seedTs, model: '', adjustment_usd: 10, priced_usd: 10, window_gen: 2 }),
      row({
        id: 'codex:pre#1',
        ts: '2026-10-01T00:00:00.000Z',
        provider: 'codex',
        model: 'gpt-5.5',
        input_tokens: 5,
        priced_usd: 3,
        window_gen: -1,
      }),
      row({
        id: 'codex:post#1',
        ts: '2026-10-05T00:00:00.000Z',
        provider: 'codex',
        model: 'gpt-5.5',
        input_tokens: 5,
        priced_usd: 4,
        window_gen: -1,
      }),
    ];
    const total = [...foldLedgerRows(rows).days.values()].reduce((s, d) => s + d.cost, 0);
    expect(total).toBeCloseTo(14, 12);
  });

  it('keeps gen -1 rows when no migration seed covers them (first metering / clear re-baseline)', () => {
    const rows = [
      row({ id: 'codex:old#1', provider: 'codex', model: 'gpt-5.5', input_tokens: 5, priced_usd: 4, window_gen: -1 }),
      row({ id: 'adj:s:3', adjustment_usd: 1, priced_usd: 1 }),
    ];
    const total = [...foldLedgerRows(rows).days.values()].reduce((s, d) => s + d.cost, 0);
    expect(total).toBeCloseTo(5, 12);
  });

  it('an empty ledger is not a ledger session', () => {
    expect(foldLedgerRows([]).hasRows).toBe(false);
  });
});

describe('readLedgerFromDb / getSessionLedgerCost', () => {
  const dir = mkdtempSync(path.join('/tmp', 'nanoclaw-ledger-read-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a fixture outbound.db read-only', () => {
    const p = path.join(dir, 'a', 'outbound.db');
    writeLedger(p, fixtureRows());
    const total = [...readLedgerFromDb(p).days.values()].reduce((s, d) => s + d.cost, 0);
    expect(total).toBeCloseTo(LIFETIME, 9);
  });

  it('reports no ledger for an outbound.db without cost_events, or no file at all', () => {
    const p = path.join(dir, 'b', 'outbound.db');
    mkdirSync(path.dirname(p), { recursive: true });
    const db = new Database(p);
    db.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT)');
    db.close();
    clearLedgerCacheForTests();
    expect(getSessionLedgerCost(p).hasRows).toBe(false);
    expect(getSessionLedgerCost(path.join(dir, 'missing', 'outbound.db')).hasRows).toBe(false);
  });

  it('a locked DB serves the last good ledger value, and reports UNKNOWN (ok:false) without one', () => {
    const p = path.join(dir, 'd', 'outbound.db');
    writeLedger(p, [row({ id: 'adj:s:1', adjustment_usd: 4, priced_usd: 4 })]);
    clearLedgerCacheForTests();
    expect(getSessionLedgerCost(p).hasRows).toBe(true);
    // A writer mid-commit: EXCLUSIVE lock, and a change in size/mtime forces a re-read.
    const w = new Database(p);
    w.prepare(
      "INSERT INTO cost_events (id, ts, provider, model, priced_usd, rate_version, created_at) VALUES ('adj:s:2', ?, 'claude', '', 0, 1, ?)",
    ).run(TODAY, TODAY);
    w.exec('BEGIN EXCLUSIVE');
    try {
      const stale = getSessionLedgerCost(p);
      expect(stale.ok).toBe(true);
      expect([...stale.days.values()][0].cost).toBeCloseTo(4, 12);
      clearLedgerCacheForTests();
      const cold = getSessionLedgerCost(p);
      expect(cold).toMatchObject({ ok: false, hasRows: false });
    } finally {
      w.exec('ROLLBACK');
      w.close();
    }
  });

  it('re-reads when the outbound.db changes (mtime/size-keyed cache)', () => {
    const p = path.join(dir, 'c', 'outbound.db');
    writeLedger(p, [row({ id: 'adj:s:1', adjustment_usd: 1 })]);
    clearLedgerCacheForTests();
    const first = getSessionLedgerCost(p);
    expect([...first.days.values()][0].cost).toBeCloseTo(1, 12);
    writeLedger(p, [row({ id: 'adj:s:2', adjustment_usd: 2 })]);
    const second = getSessionLedgerCost(p);
    expect([...second.days.values()][0].cost).toBeCloseTo(3, 12);
  });
});

describe('GET /api/sessions — ledger is primary, transcript is the fallback, never both', () => {
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
    server = startServer(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('expected a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    resetTransientDashboardStateForTests();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  /** A transcript with one assistant message; returns its transcript-priced cost. */
  function writeTranscript(groupId: string, sdkId: string, msgId: string, outputTokens: number): number {
    const dir = path.join(DATA_DIR, 'v2-sessions', groupId, '.claude-shared', 'projects', '-workspace-group');
    mkdirSync(dir, { recursive: true });
    const usage = { input_tokens: 100, output_tokens: outputTokens };
    writeFileSync(
      path.join(dir, `${sdkId}.jsonl`),
      JSON.stringify({ type: 'assistant', timestamp: TODAY, message: { id: msgId, model: 'claude-opus-5-5', usage } }) +
        '\n',
    );
    return priceUsage('claude-opus-5-5', usage);
  }

  function writeCodexRollout(groupId: string, sessId: string): void {
    const d = TODAY.slice(0, 10).split('-');
    const dir = path.join(DATA_DIR, 'v2-sessions', groupId, sessId, 'codex', 'sessions', d[0], d[1], d[2]);
    mkdirSync(dir, { recursive: true });
    const lines = [
      { timestamp: TODAY, type: 'turn_context', payload: { model: 'gpt-5.5' } },
      {
        timestamp: TODAY,
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: { last_token_usage: { input_tokens: 1_000_000, cached_input_tokens: 0, output_tokens: 1_000_000 } },
        },
      },
    ];
    writeFileSync(
      path.join(dir, `rollout-${d.join('-')}T00-00-00-x.jsonl`),
      lines.map((l) => JSON.stringify(l)).join('\n'),
    );
  }

  function seedCentral(): void {
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
    for (const id of ['sess-ledger', 'sess-old']) {
      db.prepare("INSERT INTO sessions (id, agent_group_id, created_at) VALUES (?, 'ag-1', ?)").run(id, TODAY);
    }
    db.prepare("INSERT INTO sdk_session_routes VALUES ('sdk-ledger', 'sess-ledger'), ('sdk-old', 'sess-old')").run();
    db.close();
  }

  async function getSessions(period: string): Promise<Record<string, any>> {
    const res = await fetch(`${baseUrl}/api/sessions?period=${period}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: Array<Record<string, any>> };
    return Object.fromEntries(body.sessions.map((s) => [s.session_id, s]));
  }

  it('prices a ledger session from cost_events only, and an old session from its transcript', async () => {
    seedCentral();
    // sess-ledger has a ledger AND a (rotated, partial) transcript AND a codex
    // rollout. Only the ledger may count — adding either walk would double count.
    writeLedger(path.join(DATA_DIR, 'v2-sessions', 'ag-1', 'sess-ledger', 'outbound.db'), fixtureRows());
    writeTranscript('ag-1', 'sdk-ledger', 'msg_A', 50_000);
    writeCodexRollout('ag-1', 'sess-ledger');
    // sess-old predates the ledger: an outbound.db with no cost_events, plus a transcript.
    const oldOut = path.join(DATA_DIR, 'v2-sessions', 'ag-1', 'sess-old', 'outbound.db');
    mkdirSync(path.dirname(oldOut), { recursive: true });
    const odb = new Database(oldOut);
    odb.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT)');
    odb.close();
    const oldCost = writeTranscript('ag-1', 'sdk-old', 'msg_old', 2000);

    forceOpenDbForTests();
    refreshSessionCostsForTests();

    const s30 = await getSessions('30d');
    expect(s30['sess-ledger'].cost).toBeCloseTo(LIFETIME, 9);
    expect(s30['sess-ledger'].claudeUsd).toBeCloseTo(LIFETIME - codex, 9);
    expect(s30['sess-ledger'].codexUsd).toBeCloseTo(codex, 12);
    expect(s30['sess-ledger'].costSource).toBe('ledger');
    expect(s30['sess-old'].cost).toBeCloseTo(oldCost, 12);
    expect(s30['sess-old'].codexUsd).toBe(0);
    expect(s30['sess-old'].costSource).toBe('transcript');

    // Period windows bucket ledger rows by their own ts: msg_C (3 days ago) is out of 1d.
    const s1 = await getSessions('1d');
    expect(s1['sess-ledger'].cost).toBeCloseTo(TODAY_CLAUDE + codex, 9);
    expect(s1['sess-ledger'].costSource).toBe('ledger');
  });

  it('keeps the last published figure while a session ledger is unreadable — never a transcript fallback mix', async () => {
    seedCentral();
    const oldOut = path.join(DATA_DIR, 'v2-sessions', 'ag-1', 'sess-old', 'outbound.db');
    mkdirSync(path.dirname(oldOut), { recursive: true });
    const odb = new Database(oldOut);
    odb.exec('CREATE TABLE session_state (key TEXT PRIMARY KEY, value TEXT)');
    odb.close();
    const oldCost = writeTranscript('ag-1', 'sdk-old', 'msg_old', 2000);
    forceOpenDbForTests();
    refreshSessionCostsForTests();
    expect((await getSessions('30d'))['sess-old'].cost).toBeCloseTo(oldCost, 12);

    // The runner starts writing a ledger AND makes a codex call; the dashboard's
    // next read hits the write lock. The source is unknown → keep last figure
    // (adding the new rollout on top of the transcript would be a mixed number).
    writeLedger(oldOut, [row({ id: 'adj:sess-old:1', adjustment_usd: 7, priced_usd: 7 })]);
    writeCodexRollout('ag-1', 'sess-old');
    const w = new Database(oldOut);
    w.exec('BEGIN EXCLUSIVE');
    try {
      refreshSessionCostsForTests();
      const locked = (await getSessions('30d'))['sess-old'];
      expect(locked.cost).toBeCloseTo(oldCost, 12);
      expect(locked.costSource).toBe('transcript');
    } finally {
      w.exec('ROLLBACK');
      w.close();
    }

    // Lock released → the ledger is the only source.
    refreshSessionCostsForTests();
    const after = (await getSessions('30d'))['sess-old'];
    expect(after.cost).toBeCloseTo(7, 12);
    expect(after.codexUsd).toBe(0);
    expect(after.costSource).toBe('ledger');
  });
});
