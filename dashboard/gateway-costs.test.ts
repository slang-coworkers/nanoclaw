/**
 * OneCLI-gateway fleet cost (dashboard/gateway-costs.ts) and its wiring into the
 * fleet cost views: pricing (incl. the 5m/1h cache-write split), the per-group
 * per-day source switch, fail-soft fallback, cost-per-PR on the new totals, and
 * — the invariant everything hangs on — no (group, day) is ever counted from
 * both the gateway and transcripts.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import {
  buildGatewayDaily,
  buildGatewayDailySql,
  costSourceMeta,
  createGatewayCostSource,
  gatewayCutover,
  normalizeGatewayClaudeModel,
  normalizeGatewayCodexModel,
  overlayGatewayDays,
  parseGatewayRows,
  priceGatewayRow,
  safeTimezone,
  type CostDayEntry,
  type GatewayAggRow,
} from './gateway-costs.js';
import { CODEX_MODEL_PRICING } from './codex-costs.js';
import { MODEL_PRICING, priceUsage } from './session-costs.js';
import { unitCostByWeek } from './unit-cost.js';
import {
  refreshCcusageCacheForTests,
  resetTransientDashboardStateForTests,
  setGatewayPsqlRunnerForTests,
  startServer,
} from './server.js';

const OPUS = MODEL_PRICING['claude-opus-5-5'];
const SOL = CODEX_MODEL_PRICING['gpt-6.1-sol'];

function aggRow(p: Partial<GatewayAggRow> & { groupId: string; day: string }): GatewayAggRow {
  return {
    usageApi: 'anthropic_messages_v1',
    model: 'claude-opus-5-5',
    calls: 1,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheCreateFlat: 0,
    cacheCreate5m: 0,
    cacheCreate1h: 0,
    ...p,
  };
}

/** psql -tA line for one aggregate row (column order of buildGatewayDailySql). */
function psqlLine(r: GatewayAggRow): string {
  return [
    r.groupId,
    r.day,
    r.usageApi,
    r.model,
    r.calls,
    r.input,
    r.output,
    r.cacheRead,
    r.cacheCreateFlat,
    r.cacheCreate5m,
    r.cacheCreate1h,
  ].join('|');
}

function ccDay(date: string, totalCost: number): CostDayEntry {
  return {
    date,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost,
    modelsUsed: [],
    modelBreakdowns: [],
  };
}

describe('pricing', () => {
  it('prices Anthropic usage with the 5m/1h cache-write split (1h = 2x input) and flat at the 5m rate', () => {
    const r = aggRow({
      groupId: 'ag-1',
      day: '2026-10-01',
      input: 1000,
      output: 2000,
      cacheRead: 50_000,
      cacheCreateFlat: 300,
      cacheCreate5m: 400,
      cacheCreate1h: 500,
    });
    const p = priceGatewayRow(r);
    const want =
      1000 * OPUS.input + 2000 * OPUS.output + 50_000 * OPUS.cacheRead + 700 * OPUS.cacheCreate + 500 * OPUS.input * 2;
    expect(p.provider).toBe('claude');
    expect(p.usd).toBeCloseTo(want, 12);
    // Same answer as the transcript pricer given the same split usage.
    const transcript =
      priceUsage('claude-opus-5-5', {
        input_tokens: 1000,
        output_tokens: 2000,
        cache_read_input_tokens: 50_000,
        cache_creation: { ephemeral_5m_input_tokens: 400, ephemeral_1h_input_tokens: 500 },
      }) +
      300 * OPUS.cacheCreate;
    expect(p.usd).toBeCloseTo(transcript, 12);
    expect(p.cacheCreationTokens).toBe(1200);
    expect(p.totalTokens).toBe(1000 + 2000 + 50_000 + 1200);
  });

  it('normalises the provider ids a streamed body carries', () => {
    expect(normalizeGatewayClaudeModel('anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('claude-haiku-4-5');
    expect(normalizeGatewayClaudeModel('aws/anthropic/bedrock-claude-opus-5')).toBe('claude-opus-5');
    expect(normalizeGatewayClaudeModel('claude-opus-5-5')).toBe('claude-opus-5-5');
    expect(normalizeGatewayClaudeModel('llama-70b')).toBe('');
    expect(normalizeGatewayCodexModel('gpt-5.6-sol-global')).toBe('gpt-5.6-sol');
    expect(normalizeGatewayCodexModel('azure/openai/gpt-6.1-sol')).toBe('gpt-6.1-sol');
    expect(normalizeGatewayCodexModel('constructor')).toBe('');
  });

  it('prices OpenAI usage with input INCLUSIVE of cached tokens, net of cache in the token columns', () => {
    const p = priceGatewayRow(
      aggRow({
        groupId: 'ag-1',
        day: '2026-10-01',
        usageApi: 'openai_responses_v1',
        model: 'gpt-6.1-sol-global',
        input: 10_000,
        cacheRead: 4_000,
        output: 500,
      }),
    );
    expect(p.provider).toBe('codex');
    expect(p.usd).toBeCloseTo(6000 * SOL.input + 4000 * SOL.cacheRead + 500 * SOL.output, 12);
    expect(p.inputTokens).toBe(6000);
    expect(p.cacheReadTokens).toBe(4000);
    expect(p.totalTokens).toBe(10_500);
  });

  it('an unpriced model is UNKNOWN (null), listed, and adds no dollars', () => {
    const p = priceGatewayRow(aggRow({ groupId: 'ag-1', day: '2026-10-01', model: 'mystery-9', output: 1000 }));
    expect(p.usd).toBeNull();
    const g = buildGatewayDaily([aggRow({ groupId: 'ag-1', day: '2026-10-01', model: 'mystery-9', output: 1000 })]);
    expect(g.unpricedModels).toEqual(['mystery-9']);
    expect(g.groups.get('ag-1')!.days.get('2026-10-01')!.totalCost).toBe(0);
  });
});

describe('SQL + parsing', () => {
  it('aggregates in SQL with the success / count_tokens / usage filters', () => {
    const sql = buildGatewayDailySql('UTC');
    expect(sql).toContain('GROUP BY 1, 2, 3, 4');
    expect(sql).toContain('r.status BETWEEN 200 AND 299');
    expect(sql).toContain("r.path NOT LIKE '%count_tokens%'");
    expect(sql).toContain("LIKE 'anthropic%'");
    expect(sql).toContain("LIKE 'openai%'");
    expect(sql).toContain("r.extra_data ? 'usage_input_tokens'");
    expect(sql).not.toContain('x-litellm');
  });

  it('never interpolates an unsafe timezone', () => {
    expect(safeTimezone("UTC'; DROP TABLE agents; --")).toBe('UTC');
    expect(buildGatewayDailySql("x' OR 1=1 --")).toContain("AT TIME ZONE 'UTC'");
    expect(buildGatewayDailySql('Asia/Kolkata')).toContain("AT TIME ZONE 'Asia/Kolkata'");
  });

  it('skips malformed lines', () => {
    const good = aggRow({ groupId: 'ag-1', day: '2026-10-01', output: 5 });
    const rows = parseGatewayRows(
      ['SET', '', 'garbage|x', psqlLine(good), psqlLine({ ...good, groupId: 'evil' })].join('\n'),
    );
    expect(rows).toEqual([good]);
  });
});

describe('per-day source switch', () => {
  it('cuts over the day after the fleet deploy day, or on a later first day', () => {
    expect(gatewayCutover('2026-09-03', '2026-09-03')).toBe('2026-09-04');
    expect(gatewayCutover('2026-09-20', '2026-09-03')).toBe('2026-09-20');
    const g = buildGatewayDaily([
      aggRow({ groupId: 'ag-1', day: '2026-09-03', output: 1 }),
      aggRow({ groupId: 'ag-2', day: '2026-09-20', output: 1 }),
    ]);
    expect(g.fleetFirstDay).toBe('2026-09-03');
    expect(g.groups.get('ag-1')!.cutover).toBe('2026-09-04');
    expect(g.groups.get('ag-2')!.cutover).toBe('2026-09-20');
  });

  it('transcript days before the cutover, gateway days on/after it, never both (no double count)', () => {
    const gw = buildGatewayDaily([
      aggRow({ groupId: 'ag-1', day: '2026-09-03', output: 1_000_000 }), // deploy day: partial, ignored
      aggRow({ groupId: 'ag-1', day: '2026-09-05', output: 100_000 }),
      aggRow({ groupId: 'ag-1', day: '2026-09-06', input: 100_000 }),
    ]);
    const ccusage = [
      ccDay('2026-09-02', 7),
      ccDay('2026-09-03', 8), // kept: before the cutover
      ccDay('2026-09-04', 9), // after cutover, gateway saw nothing → $0, NOT the transcript figure
      ccDay('2026-09-05', 1), // replaced by the gateway figure, never added to it
    ];
    const out = overlayGatewayDays(ccusage, gw.groups.get('ag-1'));
    expect(out.map((d) => [d.date, d.source])).toEqual([
      ['2026-09-02', 'ccusage'],
      ['2026-09-03', 'ccusage'],
      ['2026-09-05', 'gateway'],
      ['2026-09-06', 'gateway'],
    ]);
    const g5 = 100_000 * OPUS.output;
    const g6 = 100_000 * OPUS.input;
    expect(out.find((d) => d.date === '2026-09-05')!.totalCost).toBeCloseTo(g5, 12);
    const total = out.reduce((s, d) => s + d.totalCost, 0);
    expect(total).toBeCloseTo(7 + 8 + g5 + g6, 12);
    // Exactly one entry per day.
    expect(new Set(out.map((d) => d.date)).size).toBe(out.length);
  });

  it('a group the gateway never captured keeps its transcript series, tagged ccusage', () => {
    const out = overlayGatewayDays([ccDay('2026-09-10', 3)], undefined);
    expect(out).toEqual([{ ...ccDay('2026-09-10', 3), source: 'ccusage' }]);
  });
});

describe('cached, fail-soft fetch', () => {
  it('caches a good result for the TTL and single-flights concurrent reads', async () => {
    const run = vi.fn(async () => psqlLine(aggRow({ groupId: 'ag-1', day: '2026-10-01', output: 10 })));
    let t = 1_000_000;
    const src = createGatewayCostSource({ runPsql: run, now: () => t, ttlMs: 600_000 });
    const [a, b] = await Promise.all([src.get('UTC'), src.get('UTC')]);
    expect(a.ok && b.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    t += 599_000;
    await src.get('UTC');
    expect(run).toHaveBeenCalledTimes(1);
    t += 2_000;
    await src.get('UTC');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('an unreachable Postgres yields ok:false with the reason, never throws, and retries after the error TTL', async () => {
    const run = vi.fn(async () => {
      throw new Error('Error response from daemon: No such container: onecli-postgres-1');
    });
    let t = 0;
    const src = createGatewayCostSource({ runPsql: run, now: () => t, errorTtlMs: 120_000 });
    const r = await src.get('UTC');
    expect(r.ok).toBe(false);
    const meta = costSourceMeta(r);
    expect(meta.gatewayAvailable).toBe(false);
    expect(meta.unavailable).toContain('No such container');
    await src.get('UTC');
    expect(run).toHaveBeenCalledTimes(1);
    t += 121_000;
    await src.get('UTC');
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('cost per PR on the gateway totals', () => {
  it('sums the overlaid series (gateway after cutover) and tags each week', () => {
    // Weeks (Monday): 2026-09-28 and 2026-10-05. Cutover 2026-10-01 for slang-fixer.
    const gw = buildGatewayDaily([
      aggRow({ groupId: 'ag-boot', day: '2026-09-29', output: 1 }), // fleet first day (another group)
      aggRow({ groupId: 'ag-fix', day: '2026-10-01', output: 200_000 }),
      aggRow({ groupId: 'ag-fix', day: '2026-10-06', output: 400_000 }),
    ]);
    const fixer = overlayGatewayDays(
      [ccDay('2026-09-29', 10), ccDay('2026-10-01', 2), ccDay('2026-10-06', 3)],
      gw.groups.get('ag-fix'),
    );
    const nowMs = Date.parse('2026-10-07T12:00:00Z');
    const r = unitCostByWeek(
      [{ groupName: 'slang-fixer', daily: fixer }],
      new Map([
        ['2026-09-28', 2],
        ['2026-10-05', 4],
      ]),
      2,
      nowMs,
    );
    const [w1, w2] = r.weeks;
    expect(w1.week).toBe('2026-09-28');
    expect(w1.cost).toBeCloseTo(10 + 200_000 * OPUS.output, 9); // transcript 09-29 + gateway 10-01 (not the $2)
    expect(w1.source).toBe('mixed');
    expect(w2.cost).toBeCloseTo(400_000 * OPUS.output, 9); // gateway only, never + $3
    expect(w2.source).toBe('gateway');
    expect(w2.costPerPr).toBeCloseTo((400_000 * OPUS.output) / 4, 9);
  });
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const TEST_TMP_ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-gateway-cost-test-'));
const DATA_DIR = path.join(TEST_TMP_ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');
const dayIso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);

describe('fleet cost routes read the gateway', () => {
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
    seedCentral();
    server = startServer(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('expected a TCP port');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    setGatewayPsqlRunnerForTests(null);
    resetTransientDashboardStateForTests();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    rmSync(DATA_DIR, { recursive: true, force: true });
  });

  function seedCentral(): void {
    mkdirSync(path.join(DATA_DIR, 'v2-sessions'), { recursive: true });
    const db = new Database(DB_PATH);
    db.exec(`CREATE TABLE agent_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL UNIQUE,
      is_admin INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`);
    const now = new Date().toISOString();
    db.prepare("INSERT INTO agent_groups (id, name, folder, created_at) VALUES ('ag-1', 'cw', 'cw', ?)").run(now);
    db.prepare("INSERT INTO agent_groups (id, name, folder, created_at) VALUES ('ag-2', 'cw2', 'cw2', ?)").run(now);
    db.close();
  }

  /** One transcript message on `daysAgo`; returns its transcript-priced cost. */
  function writeTranscript(groupId: string, daysAgo: number, outputTokens: number): number {
    const dir = path.join(DATA_DIR, 'v2-sessions', groupId, '.claude-shared', 'projects', '-workspace-group');
    mkdirSync(dir, { recursive: true });
    const ts = new Date(Date.now() - daysAgo * 86400_000).toISOString();
    const usage = { input_tokens: 0, output_tokens: outputTokens };
    writeFileSync(
      path.join(dir, `sdk-${daysAgo}.jsonl`),
      JSON.stringify({
        type: 'assistant',
        timestamp: ts,
        message: { id: `msg-${daysAgo}`, model: 'claude-opus-5-5', usage },
      }) + '\n',
    );
    return priceUsage('claude-opus-5-5', usage);
  }

  const gatewayRows = () =>
    [
      aggRow({ groupId: 'ag-2', day: dayIso(4), output: 1 }), // fleet deploy day
      aggRow({ groupId: 'ag-1', day: dayIso(4), output: 9_000_000 }), // partial deploy day → ignored
      aggRow({ groupId: 'ag-1', day: dayIso(2), output: 300_000 }),
      aggRow({ groupId: 'ag-1', day: dayIso(0), output: 100_000 }),
      aggRow({ groupId: 'ag-foreign', day: dayIso(1), output: 5_000_000 }), // another install's agent
    ]
      .map(psqlLine)
      .join('\n');

  it('/api/cost-history: transcript before the cutover, gateway after, one source per day', async () => {
    const t5 = writeTranscript('ag-1', 5, 10_000);
    writeTranscript('ag-1', 2, 50_000); // superseded by the gateway figure
    setGatewayPsqlRunnerForTests(async () => gatewayRows());
    const res = await fetch(`${baseUrl}/api/cost-history?from=${dayIso(10)}&by=day`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const cw = body.groups.find((g: any) => g.group_folder === 'cw');
    const byDay = Object.fromEntries(cw.buckets.map((b: any) => [b.bucket, b]));
    expect(byDay[dayIso(5)].source).toBe('transcript');
    expect(byDay[dayIso(5)].usd).toBeCloseTo(t5, 9);
    expect(byDay[dayIso(4)]).toBeUndefined();
    expect(byDay[dayIso(2)].source).toBe('gateway');
    expect(byDay[dayIso(2)].usd).toBeCloseTo(300_000 * OPUS.output, 9);
    expect(byDay[dayIso(0)].usd).toBeCloseTo(100_000 * OPUS.output, 9);
    expect(cw.total_usd).toBeCloseTo(t5 + 400_000 * OPUS.output, 9);
    expect(body.groups.some((g: any) => g.group_folder === 'ag-foreign')).toBe(false);
    expect(body.costSource.gatewayAvailable).toBe(true);
    expect(body.source).toBe('mixed');
  });

  it('/api/cost-history falls back to transcripts for every day when Postgres is unreachable', async () => {
    const t5 = writeTranscript('ag-1', 5, 10_000);
    const t2 = writeTranscript('ag-1', 2, 50_000);
    setGatewayPsqlRunnerForTests(async () => {
      throw new Error('connection refused');
    });
    const body = (await (await fetch(`${baseUrl}/api/cost-history?from=${dayIso(10)}&by=total`)).json()) as any;
    const cw = body.groups.find((g: any) => g.group_folder === 'cw');
    expect(cw.total_usd).toBeCloseTo(t5 + t2, 9);
    expect(cw.buckets[0].source).toBe('transcript');
    expect(body.source).toBe('transcript');
    expect(body.costSource.gatewayAvailable).toBe(false);
    expect(body.costSource.unavailable).toContain('connection refused');
  });

  it('/api/token-metrics: gateway-only groups of THIS install count; foreign agents never do', async () => {
    // No transcripts at all (all cleaned up) — the gateway alone carries the spend.
    setGatewayPsqlRunnerForTests(async () => gatewayRows());
    await refreshCcusageCacheForTests();
    const body = (await (await fetch(`${baseUrl}/api/token-metrics?period=all`)).json()) as any;
    const ids = body.byCoworker.map((g: any) => g.groupId).sort();
    expect(ids).toEqual(['ag-1']); // ag-2's only row is its partial deploy day
    const ag1 = body.byCoworker.find((g: any) => g.groupId === 'ag-1');
    expect(ag1.daily.every((d: any) => d.source === 'gateway')).toBe(true);
    const total = body.daily.reduce((s: number, d: any) => s + d.totalCost, 0);
    // ag-2's only row is on the deploy day (before its cutover) → nothing; ag-1 = 2 days.
    expect(total).toBeCloseTo(400_000 * OPUS.output, 9);
    expect(body.costSource.gatewayAvailable).toBe(true);
  });
});
