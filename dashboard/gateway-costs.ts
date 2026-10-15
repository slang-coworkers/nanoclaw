/**
 * Fleet / per-group spend from the OneCLI gateway's `request_logs` — the EXACT
 * cost source for the dashboard's fleet-level cost views (cost tiles, daily cost
 * chart, cost per PR, cost history by group).
 *
 * WHY: those views used to price Claude Code transcripts via ccusage. Transcript
 * cleanup deletes old and oversized transcripts, so every transcript-derived
 * total runs LOW, and the error grows with the window. The patched OneCLI
 * gateway records the token usage of EVERY inference response body it proxies
 * (`usage_*` keys in `request_logs.extra_data`, see
 * scripts/onecli-cost-capture/README.md §v2) — nothing deletes those rows.
 *
 * HOW: one aggregate query, grouped by (agent, day, usage_api, usage_model) —
 * never row-by-row — priced here with the dashboard's rate tables
 * (`session-costs.ts` MODEL_PRICING / `codex-costs.ts` CODEX_MODEL_PRICING, the
 * tested verbatim mirrors of the runner's `pricing.ts` / `codex-cost.ts`).
 * A 1-hour cache write is 2x input; a 5-minute (or un-split) write is the
 * `cacheCreate` rate. litellm's `x-litellm-response-cost-original` header is
 * NOT used: it is emitted before a streamed completion exists and reads $0 for
 * ~all coworker traffic.
 *
 * OpenAI (codex) calls carry the same `usage_*` keys (`usage_api =
 * openai_responses_v1`; `usage_input_tokens` INCLUDES the cached subset, which
 * is `usage_cache_read_input_tokens`), so codex spend is priced from the gateway
 * too, with the codex rate table.
 *
 * WHAT IT COUNTS: everything an agent group's OneCLI identity paid for —
 * including nested `claude --print` review runs and codex-critique calls that
 * never appear in the group's own session transcripts. For fleet/group spend
 * that is correct (it is real spend); the UI says so.
 *
 * SOURCE SWITCH, PER GROUP PER DAY: body-usage capture only exists from the v2
 * gateway deploy (~2026-09-03, mid-day). For each group, days BEFORE its cutover
 * keep the existing transcript figure; days ON/AFTER it come only from the
 * gateway. A (group, day) value is therefore always exactly one source — never
 * a sum of both — and every day is tagged with the source it came from. The
 * cutover is the group's first captured day, pushed one day later when that day
 * is the fleet's first captured day (the deploy day was only partly captured).
 *
 * FAIL SOFT: when Postgres is unreachable the caller keeps the transcript
 * figures for every day and reports `unavailable` with the reason.
 */
import { execFile } from 'child_process';

import { CODEX_MODEL_PRICING, normalizeCodexModel } from './codex-costs.js';
import { MODEL_PRICING, normalizeModel } from './session-costs.js';

/** The day-entry shape every cost feed in server.ts uses (ccusage's `daily` row). */
export interface CostDayEntry {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: {
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
  }[];
  /**
   * Where this day's figure came from. 'gateway' = OneCLI request_logs (exact);
   * 'ccusage' = transcripts. 'mixed' only appears on a COMBINED (multi-group)
   * day where different groups were on different sides of their cutover — each
   * group's own figure is still single-source.
   */
  source?: CostSource;
}

export type CostSource = 'gateway' | 'ccusage' | 'mixed';

/** Combine two source tags (for merging days across groups or into weeks). */
export function mergeSource<S extends string>(a: S | undefined, b: S | undefined): S | 'mixed' | undefined {
  if (!a) return b;
  if (!b) return a;
  return a === b ? a : 'mixed';
}

// ---------------------------------------------------------------------------
// Model normalisation for ids written INTO a response body
// ---------------------------------------------------------------------------

/**
 * Claude pricing key for a gateway `usage_model`. On streamed calls the body
 * tap records the PROVIDER id — a raw Bedrock id like
 * `anthropic.claude-haiku-4-5-20251001-v1:0` — which the transcript normaliser
 * has never had to see. Strip the `anthropic.` prefix and `:N` revision, then
 * defer to the shared `normalizeModel` so the rate table stays single-sourced.
 */
export function normalizeGatewayClaudeModel(model: string | undefined): string {
  if (!model) return '';
  const direct = normalizeModel(model);
  if (direct) return direct;
  const m = model
    .trim()
    .toLowerCase()
    .replace(/^anthropic\./, '')
    .replace(/:\d+$/, '');
  return normalizeModel(m);
}

/** Codex pricing key for a gateway `usage_model` (Azure `-global` deployment suffix stripped). */
export function normalizeGatewayCodexModel(model: string | undefined): string {
  if (!model) return '';
  const direct = normalizeCodexModel(model);
  if (direct) return direct;
  const last = model.trim().toLowerCase().split('/').pop() || '';
  return (
    normalizeCodexModel(last.replace(/-global$/, '')) ||
    normalizeCodexModel(last.replace(/-\d{8}$/, '').replace(/-global$/, ''))
  );
}

// ---------------------------------------------------------------------------
// SQL + parse
// ---------------------------------------------------------------------------

/** IANA zone names are the only text interpolated into the SQL; anything else → UTC. */
const TZ_RE = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;
export function safeTimezone(tz: string | undefined): string {
  return tz && TZ_RE.test(tz) ? tz : 'UTC';
}

const GROUP_ID_RE = /^ag-[A-Za-z0-9-]+$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One row per (agent group, local day, usage_api, usage_model). Only rows that
 * carry body usage are read, so pre-capture history and non-inference traffic
 * (GitHub API calls, …) never enter the sums. The day is the response's
 * `usage_observed_at_ms` (end of body — the transcript's timestamp is also the
 * completed message), falling back to `created_at`.
 */
export function buildGatewayDailySql(timezone = 'UTC'): string {
  const tz = safeTimezone(timezone);
  const x = (k: string) => `(r.extra_data->>'${k}')`;
  const tok = (k: string) => `coalesce(sum(${x(k)}::bigint),0)`;
  const at = `coalesce(to_timestamp(${x('usage_observed_at_ms')}::bigint / 1000.0), r.created_at::timestamptz)`;
  return (
    `SELECT a.identifier, to_char((${at} AT TIME ZONE '${tz}')::date, 'YYYY-MM-DD') AS day, ` +
    `${x('usage_api')}, coalesce(${x('usage_model')}, ''), count(*), ` +
    `${tok('usage_input_tokens')}, ${tok('usage_output_tokens')}, ${tok('usage_cache_read_input_tokens')}, ` +
    // Flat cache_creation only from calls WITHOUT a 5m/1h split — the split
    // keys are a breakdown of the same tokens, never added on top.
    `coalesce(sum(${x('usage_cache_creation_input_tokens')}::bigint) FILTER (WHERE NOT (r.extra_data ? 'usage_cache_creation_5m_input_tokens') ` +
    `AND NOT (r.extra_data ? 'usage_cache_creation_1h_input_tokens')),0), ` +
    `${tok('usage_cache_creation_5m_input_tokens')}, ${tok('usage_cache_creation_1h_input_tokens')} ` +
    `FROM request_logs r JOIN agents a ON a.id = r.agent_id ` +
    `WHERE a.identifier LIKE 'ag-%' AND r.status BETWEEN 200 AND 299 AND r.path NOT LIKE '%count_tokens%' ` +
    `AND (${x('usage_api')} LIKE 'anthropic%' OR ${x('usage_api')} LIKE 'openai%') ` +
    `AND r.extra_data ? 'usage_input_tokens' ` +
    `GROUP BY 1, 2, 3, 4 ORDER BY 1, 2`
  );
}

export interface GatewayAggRow {
  groupId: string;
  /** YYYY-MM-DD in the query's timezone. */
  day: string;
  usageApi: string;
  model: string;
  calls: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreateFlat: number;
  cacheCreate5m: number;
  cacheCreate1h: number;
}

/** Parse `psql -tA` output of {@link buildGatewayDailySql}. Malformed lines are skipped. */
export function parseGatewayRows(raw: string): GatewayAggRow[] {
  const out: GatewayAggRow[] = [];
  const num = (s: string | undefined) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  for (const line of raw.split('\n')) {
    const p = line.trim().split('|');
    if (p.length < 11) continue;
    const groupId = p[0].trim();
    const day = p[1].trim();
    if (!GROUP_ID_RE.test(groupId) || !DAY_RE.test(day)) continue;
    out.push({
      groupId,
      day,
      usageApi: p[2].trim(),
      model: p[3].trim(),
      calls: num(p[4]),
      input: num(p[5]),
      output: num(p[6]),
      cacheRead: num(p[7]),
      cacheCreateFlat: num(p[8]),
      cacheCreate5m: num(p[9]),
      cacheCreate1h: num(p[10]),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export interface PricedRow {
  provider: 'claude' | 'codex' | null;
  /** Pricing key, or '' when the model is not in the rate table. */
  modelKey: string;
  /** USD, or null when unpriced (UNKNOWN — never a confident $0). */
  usd: number | null;
  /** Token columns in ccusage's convention: input NET of cache reads. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
}

export function priceGatewayRow(r: GatewayAggRow): PricedRow {
  const api = r.usageApi.toLowerCase();
  if (api.startsWith('anthropic')) {
    const cacheCreationTokens = r.cacheCreateFlat + r.cacheCreate5m + r.cacheCreate1h;
    const key = normalizeGatewayClaudeModel(r.model);
    const rate = key ? MODEL_PRICING[key] : undefined;
    const usd = rate
      ? r.input * rate.input +
        r.output * rate.output +
        r.cacheRead * rate.cacheRead +
        (r.cacheCreateFlat + r.cacheCreate5m) * rate.cacheCreate +
        r.cacheCreate1h * rate.input * 2 // 1h cache write = 2x input
      : null;
    return {
      provider: 'claude',
      modelKey: key,
      usd,
      inputTokens: r.input,
      outputTokens: r.output,
      cacheReadTokens: r.cacheRead,
      cacheCreationTokens,
      totalTokens: r.input + r.output + r.cacheRead + cacheCreationTokens,
    };
  }
  if (api.startsWith('openai')) {
    // OpenAI input_tokens INCLUDES the cached subset.
    const cached = Math.min(r.cacheRead, r.input);
    const uncached = Math.max(0, r.input - cached);
    const key = normalizeGatewayCodexModel(r.model);
    const rate = key ? CODEX_MODEL_PRICING[key] : undefined;
    const usd = rate ? uncached * rate.input + cached * rate.cacheRead + r.output * rate.output : null;
    return {
      provider: 'codex',
      modelKey: key,
      usd,
      inputTokens: uncached,
      outputTokens: r.output,
      cacheReadTokens: cached,
      cacheCreationTokens: 0,
      totalTokens: r.input + r.output,
    };
  }
  return {
    provider: null,
    modelKey: '',
    usd: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface GatewayDay extends CostDayEntry {
  claudeUsd: number;
  codexUsd: number;
  source: 'gateway';
}

export interface GatewayGroup {
  groupId: string;
  /** First day (YYYY-MM-DD) with a captured, usage-bearing call for this group. */
  firstDay: string;
  /** First day served from the gateway; earlier days keep the transcript figure. */
  cutover: string;
  days: Map<string, GatewayDay>;
}

export interface GatewayDaily {
  timezone: string;
  fetchedAt: number;
  /** First captured day anywhere in the fleet (the v2 gateway deploy day), or null. */
  fleetFirstDay: string | null;
  groups: Map<string, GatewayGroup>;
  /** Model ids seen with usage that the rate table cannot price (their tokens count, their cost is unknown). */
  unpricedModels: string[];
}

/** YYYY-MM-DD + 1 day. */
export function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A group's first gateway-sourced day: its first captured day, except that the
 * fleet's first captured day (the deploy day) was only partly captured, so a
 * group that starts there switches the day after.
 */
export function gatewayCutover(groupFirstDay: string, fleetFirstDay: string | null): string {
  return fleetFirstDay && groupFirstDay <= fleetFirstDay ? nextDay(fleetFirstDay) : groupFirstDay;
}

function emptyGatewayDay(date: string): GatewayDay {
  return {
    date,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    modelsUsed: [],
    modelBreakdowns: [],
    claudeUsd: 0,
    codexUsd: 0,
    source: 'gateway',
  };
}

export function buildGatewayDaily(rows: GatewayAggRow[], timezone = 'UTC', fetchedAt = Date.now()): GatewayDaily {
  const groups = new Map<string, GatewayGroup>();
  const unpriced = new Set<string>();
  let fleetFirstDay: string | null = null;
  for (const r of rows) {
    const p = priceGatewayRow(r);
    if (!p.provider) continue;
    if (fleetFirstDay === null || r.day < fleetFirstDay) fleetFirstDay = r.day;
    let g = groups.get(r.groupId);
    if (!g) {
      g = { groupId: r.groupId, firstDay: r.day, cutover: r.day, days: new Map() };
      groups.set(r.groupId, g);
    }
    if (r.day < g.firstDay) g.firstDay = r.day;
    const d = g.days.get(r.day) ?? emptyGatewayDay(r.day);
    g.days.set(r.day, d);
    const usd = p.usd ?? 0;
    if (p.usd === null) unpriced.add(r.model || r.usageApi);
    d.inputTokens += p.inputTokens;
    d.outputTokens += p.outputTokens;
    d.cacheReadTokens += p.cacheReadTokens;
    d.cacheCreationTokens += p.cacheCreationTokens;
    d.totalTokens += p.totalTokens;
    d.totalCost += usd;
    if (p.provider === 'codex') d.codexUsd += usd;
    else d.claudeUsd += usd;
    const name = p.modelKey || r.model || '(unknown)';
    if (!d.modelsUsed.includes(name)) d.modelsUsed.push(name);
    const mb = d.modelBreakdowns.find((m) => m.modelName === name);
    if (mb) {
      mb.inputTokens += p.inputTokens;
      mb.outputTokens += p.outputTokens;
      mb.cacheReadTokens += p.cacheReadTokens;
      mb.cacheCreationTokens += p.cacheCreationTokens;
      mb.cost += usd;
    } else {
      d.modelBreakdowns.push({
        modelName: name,
        inputTokens: p.inputTokens,
        outputTokens: p.outputTokens,
        cacheReadTokens: p.cacheReadTokens,
        cacheCreationTokens: p.cacheCreationTokens,
        cost: usd,
      });
    }
  }
  for (const g of groups.values()) g.cutover = gatewayCutover(g.firstDay, fleetFirstDay);
  return { timezone, fetchedAt, fleetFirstDay, groups, unpricedModels: [...unpriced].sort() };
}

/**
 * One group's daily series: transcript (ccusage) days before the group's
 * cutover, gateway days on/after it. Every day appears at most once and carries
 * exactly one source — the two are never summed. A group the gateway never
 * captured keeps its transcript series untouched.
 */
export function overlayGatewayDays<T extends CostDayEntry>(
  ccusageDaily: T[],
  gw: GatewayGroup | undefined,
): CostDayEntry[] {
  if (!gw) return ccusageDaily.map((d) => ({ ...d, source: 'ccusage' as const }));
  const out: CostDayEntry[] = [];
  for (const d of ccusageDaily) {
    if (d.date && d.date < gw.cutover) out.push({ ...d, source: 'ccusage' });
  }
  for (const [day, g] of gw.days) {
    if (day < gw.cutover) continue;
    const { claudeUsd: _c, codexUsd: _x, ...entry } = g;
    out.push({
      ...entry,
      modelsUsed: [...g.modelsUsed],
      modelBreakdowns: g.modelBreakdowns.map((m) => ({ ...m })),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Cached, fail-soft fetch
// ---------------------------------------------------------------------------

export type PsqlRunner = (sql: string) => Promise<string>;

export type GatewayFetch = { ok: true; data: GatewayDaily } | { ok: false; reason: string; fetchedAt: number };

/** psql is slow and the data moves slowly: hold a good result this long. */
export const GATEWAY_TTL_MS = 10 * 60_000;
/** Retry an unreachable gateway sooner, but not on every request. */
export const GATEWAY_ERROR_TTL_MS = 2 * 60_000;

export function gatewayPgContainer(): string {
  return process.env.ONECLI_PG_CONTAINER?.trim() || 'onecli-postgres-1';
}

export function defaultPsqlRunner(): PsqlRunner {
  const container = gatewayPgContainer();
  const runtime = process.env.ONECLI_PG_RUNTIME?.trim() || 'docker';
  const user = process.env.ONECLI_PG_USER?.trim() || 'onecli';
  const db = process.env.ONECLI_PG_DB?.trim() || 'onecli';
  return (sql) =>
    new Promise((resolve, reject) => {
      // Read-only: a single SELECT; `-v ON_ERROR_STOP=1` makes a SQL error a non-zero exit.
      execFile(
        runtime,
        ['exec', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', db, '-tAc', sql],
        { timeout: 30_000, maxBuffer: 16 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            const msg = String(stderr || err.message || err)
              .trim()
              .split('\n')[0];
            reject(new Error(msg.slice(0, 200)));
          } else resolve(String(stdout));
        },
      );
    });
}

export interface GatewayCostSource {
  /** Cached fetch for `timezone` (single-flight per zone). Never throws. */
  get(timezone?: string): Promise<GatewayFetch>;
  /** Last result for `timezone` without fetching (null = never fetched). */
  peek(timezone?: string): GatewayFetch | null;
  reset(): void;
}

export function createGatewayCostSource(
  opts: { runPsql?: PsqlRunner; now?: () => number; ttlMs?: number; errorTtlMs?: number } = {},
): GatewayCostSource {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? GATEWAY_TTL_MS;
  const errTtl = opts.errorTtlMs ?? GATEWAY_ERROR_TTL_MS;
  const cache = new Map<string, GatewayFetch>();
  const inflight = new Map<string, Promise<GatewayFetch>>();
  const fetchedAt = (f: GatewayFetch) => (f.ok ? f.data.fetchedAt : f.fetchedAt);
  return {
    peek(timezone = 'UTC') {
      return cache.get(safeTimezone(timezone)) ?? null;
    },
    reset() {
      cache.clear();
      inflight.clear();
    },
    async get(timezone = 'UTC') {
      const tz = safeTimezone(timezone);
      const hit = cache.get(tz);
      if (hit && now() - fetchedAt(hit) < (hit.ok ? ttl : errTtl)) return hit;
      const pending = inflight.get(tz);
      if (pending) return pending;
      const p = (async (): Promise<GatewayFetch> => {
        const at = now();
        try {
          const run = opts.runPsql ?? defaultPsqlRunner();
          const raw = await run(buildGatewayDailySql(tz));
          return { ok: true, data: buildGatewayDaily(parseGatewayRows(raw), tz, at) };
        } catch (e) {
          return {
            ok: false,
            reason: `OneCLI gateway Postgres unreachable (${gatewayPgContainer()}): ${(e as Error)?.message ?? String(e)}`,
            fetchedAt: at,
          };
        }
      })();
      inflight.set(tz, p);
      try {
        const res = await p;
        cache.set(tz, res);
        return res;
      } finally {
        inflight.delete(tz);
      }
    },
  };
}

/** The `costSource` block every cost route returns alongside its data. */
export interface CostSourceMeta {
  gatewayAvailable: boolean;
  /** Why the gateway could not be read (every day then comes from transcripts), else null. */
  unavailable: string | null;
  fleetFirstDay: string | null;
  fetchedAt: number | null;
  unpricedModels: string[];
  note: string;
}

export const GATEWAY_COST_NOTE =
  'Days tagged "gateway" are exact spend from the OneCLI gateway request log (every inference call the ' +
  "group's identity made, including nested `claude --print` review runs and codex calls). Earlier days, " +
  'before body-usage capture began, come from transcripts (ccusage) and can run low where old transcripts ' +
  'were cleaned up. No day mixes both sources for one group.';

export function costSourceMeta(f: GatewayFetch | null): CostSourceMeta {
  if (!f) {
    return {
      gatewayAvailable: false,
      unavailable: 'gateway not read yet',
      fleetFirstDay: null,
      fetchedAt: null,
      unpricedModels: [],
      note: GATEWAY_COST_NOTE,
    };
  }
  if (!f.ok) {
    return {
      gatewayAvailable: false,
      unavailable: f.reason,
      fleetFirstDay: null,
      fetchedAt: f.fetchedAt,
      unpricedModels: [],
      note: GATEWAY_COST_NOTE,
    };
  }
  return {
    gatewayAvailable: true,
    unavailable: null,
    fleetFirstDay: f.data.fleetFirstDay,
    fetchedAt: f.data.fetchedAt,
    unpricedModels: f.data.unpricedModels,
    note: GATEWAY_COST_NOTE,
  };
}
