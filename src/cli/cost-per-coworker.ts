/**
 * cost-per-coworker — exact per-coworker inference cost, read HOST-SIDE from the
 * OneCLI gateway's `request_logs`.
 *
 * The `ncl cost-cap coworkers` verb calls `readCostPerCoworker`. It reads the
 * EXACT litellm per-request cost that the (patched) OneCLI gateway records into
 * `request_logs.extra_data` under the header `x-litellm-response-cost-original`
 * (see scripts/onecli-cost-capture/), joined to `agents` so each row is
 * attributed to a NanoClaw agent group: `agents.identifier` IS the agent group id
 * (`ag-…`) and `agents.name` is the coworker's display name. Rolling that up by
 * `identifier` is cost-per-coworker, from the billing system's own number — no
 * token estimation, date-correct by construction.
 *
 * SECURITY — this only ever runs in the HOST process.
 *   The `cost-cap` resource is elevated-only (host operator or a cli_scope=global
 *   orchestrator). Even when a container issues `ncl cost-cap coworkers`, the
 *   handler is dispatched host-side (src/cli/delivery-action.ts) and the container
 *   receives only the aggregated dollar figures back through its session DB. A
 *   container has no docker socket, no Postgres credentials, and no network route
 *   to OneCLI's DB (host-loopback bound) — so there is no path by which a
 *   container reads OneCLI directly, and this module never executes inside one.
 *
 * CONFIG (host env, read at call time):
 *   ONECLI_PG_CONTAINER  the OneCLI Postgres container name (e.g. onecli-lego-postgres-1).
 *                        UNSET ⇒ the verb reports `configured:false` (a no-op, not an error),
 *                        so installs without the cost capture keep working.
 *   ONECLI_PG_RUNTIME    container runtime for `exec` (default 'docker').
 *   ONECLI_PG_USER       psql user (default 'onecli').
 *   ONECLI_PG_DB         psql database (default 'onecli').
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { getAllAgentGroups } from '../db/agent-groups.js';

const execFileAsync = promisify(execFile);

/** The captured litellm response header carrying the exact per-request cost. */
const COST_KEY = 'x-litellm-response-cost-original';

/** An `ag-…` id shape guard — the only value we interpolate into SQL besides a digit-derived interval. */
const GROUP_ID_RE = /^ag-[a-z0-9-]+$/i;

export interface CoworkerCostRow {
  groupId: string;
  folder: string | null;
  name: string;
  calls: number;
  costUsd: number;
}

export interface CostPerCoworkerResult {
  source: 'onecli-request-logs';
  /** false when ONECLI_PG_CONTAINER is unset — the cost source isn't wired here. */
  configured: boolean;
  /** false when the gateway has captured no cost rows yet (flag off, or no traffic). */
  captured: boolean;
  /** 'all', or the echoed --period (e.g. '30d'). */
  period: string;
  coworkers: CoworkerCostRow[];
  totalUsd: number;
  note?: string;
}

/**
 * Validate `--period` ("30d", "24h", …) → a safe Postgres interval literal built
 * only from a digit-count and a fixed unit word. Returns null when absent
 * (all-time). Throws on a malformed value rather than silently ignoring it.
 */
export function periodToInterval(period: string | undefined): string | null {
  if (!period) return null;
  const m = /^(\d{1,5})\s*([dh])$/i.exec(period.trim());
  if (!m) throw new Error(`--period must look like 30d or 24h (got: ${period})`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase() === 'd' ? 'days' : 'hours';
  return `${n} ${unit}`;
}

/**
 * Build the per-coworker aggregation SQL. The ONLY interpolations are
 * `intervalSql` (from {@link periodToInterval}: digits + a fixed unit word) and
 * `groupId` (an `ag-…` id the caller has already shape-checked) — never raw user
 * text. The verb runs via `execFile(..., [args])` (no shell), so there is no shell
 * layer either.
 */
export function buildCoworkerCostSql(opts: { intervalSql: string | null; groupId: string | null }): string {
  const filters = [`r.extra_data ? '${COST_KEY}'`, `a.identifier LIKE 'ag-%'`];
  if (opts.intervalSql) filters.push(`r.created_at > now() - interval '${opts.intervalSql}'`);
  if (opts.groupId) filters.push(`a.identifier = '${opts.groupId}'`);
  return (
    `SELECT a.identifier, coalesce(a.name,''), count(*), ` +
    `coalesce(round(sum((r.extra_data->>'${COST_KEY}')::numeric),6),0) ` +
    `FROM request_logs r JOIN agents a ON a.id = r.agent_id ` +
    `WHERE ${filters.join(' AND ')} ` +
    `GROUP BY a.identifier, a.name ORDER BY 4 DESC`
  );
}

/** Parse `psql -tAc` pipe-separated output into rows (folder is filled in by the caller). */
export function parseCoworkerRows(raw: string): Omit<CoworkerCostRow, 'folder'>[] {
  const rows: Omit<CoworkerCostRow, 'folder'>[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('|');
    if (parts.length < 4) continue;
    const groupId = parts[0].trim();
    const name = (parts[1] ?? '').trim();
    const calls = Number.parseInt(parts[2], 10);
    const costUsd = Number.parseFloat(parts[3]);
    if (!groupId || !Number.isFinite(calls)) continue;
    rows.push({ groupId, name, calls, costUsd: Number.isFinite(costUsd) ? costUsd : 0 });
  }
  return rows;
}

/** Runs one psql query and returns raw stdout. Injectable so tests need no docker. */
export type PsqlRunner = (sql: string) => Promise<string>;

export interface ReadCostPerCoworkerOpts {
  period?: string;
  groupFolder?: string;
}

export interface ReadCostPerCoworkerDeps {
  /** Override the psql runner (tests). Default = docker exec against ONECLI_PG_CONTAINER. */
  runPsql?: PsqlRunner;
  /** Pre-seeded id→folder map (tests); otherwise loaded from the central DB. */
  folderById?: Map<string, string>;
}

export async function readCostPerCoworker(
  opts: ReadCostPerCoworkerOpts,
  deps: ReadCostPerCoworkerDeps = {},
): Promise<CostPerCoworkerResult> {
  const container = process.env.ONECLI_PG_CONTAINER?.trim();
  const period = opts.period?.trim() || undefined;
  const intervalSql = periodToInterval(period);
  const periodLabel = period ?? 'all';

  // Resolve id→folder (for display) and --group folder→id (for the filter).
  let folderById = deps.folderById;
  let groupId: string | null = null;
  if (!folderById || opts.groupFolder) {
    const groups = await getAllAgentGroups();
    if (!folderById) folderById = new Map(groups.map((g) => [g.id, g.folder]));
    if (opts.groupFolder) {
      const match = groups.find((g) => g.folder === opts.groupFolder);
      if (!match) throw new Error(`unknown group folder: ${opts.groupFolder}`);
      groupId = match.id;
    }
  }
  if (groupId && !GROUP_ID_RE.test(groupId)) throw new Error(`unexpected group id shape: ${groupId}`);

  if (!container) {
    return {
      source: 'onecli-request-logs',
      configured: false,
      captured: false,
      period: periodLabel,
      coworkers: [],
      totalUsd: 0,
      note:
        'Cost source not configured. Set ONECLI_PG_CONTAINER to the OneCLI Postgres container name ' +
        '(see scripts/onecli-cost-capture/README.md).',
    };
  }

  const sql = buildCoworkerCostSql({ intervalSql, groupId });
  const runPsql = deps.runPsql ?? defaultRunPsql(container);
  const raw = await runPsql(sql);

  const coworkers: CoworkerCostRow[] = parseCoworkerRows(raw).map((r) => ({
    ...r,
    folder: folderById?.get(r.groupId) ?? null,
  }));
  const totalUsd = Number(coworkers.reduce((sum, r) => sum + r.costUsd, 0).toFixed(6));

  return {
    source: 'onecli-request-logs',
    configured: true,
    captured: coworkers.length > 0,
    period: periodLabel,
    coworkers,
    totalUsd,
    note:
      coworkers.length === 0
        ? `No captured cost rows. Is ONECLI_CAPTURE_RESPONSE_HEADERS set on the OneCLI gateway (including '${COST_KEY}')?`
        : undefined,
  };
}

function defaultRunPsql(container: string): PsqlRunner {
  const runtime = process.env.ONECLI_PG_RUNTIME?.trim() || 'docker';
  const user = process.env.ONECLI_PG_USER?.trim() || 'onecli';
  const db = process.env.ONECLI_PG_DB?.trim() || 'onecli';
  return async (sql: string) => {
    const { stdout } = await execFileAsync(runtime, ['exec', container, 'psql', '-U', user, '-d', db, '-tAc', sql], {
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout;
  };
}
