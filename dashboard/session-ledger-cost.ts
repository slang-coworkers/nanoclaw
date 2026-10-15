/**
 * Per-session cost from the runner's cost LEDGER (`cost_events` in each
 * session's `outbound.db`) — the primary source for the Sessions tab's cost
 * column whenever a session has ledger rows.
 *
 * Why: the transcript walk in server.ts (`scanFileCost`) can only price what is
 * still on disk, and transcript rotation deletes large/old transcripts, so a
 * long session under-reports (one session that really cost ~$372 showed $123).
 * The ledger is written by the agent-runner at charge time and is never pruned.
 *
 * Folding rules MIRROR the runner (container/agent-runner/src/cost-events.ts
 * `sumWindow` / `priceTokens`, and scripts/verify-cost-ledger-vs-gateway.py
 * `row_usd`) — nothing new is invented here:
 *   - The table is append-only and SIGNED. A call's first report is its base row
 *     `<id>`; later top-ups / model corrections are rows `<id>#<seq>` (a model
 *     correction appends a negative row under the old model and a positive one
 *     under the new). Backstop residual rows (`…:residual:…`, signed) and
 *     adjustment rows (`adj:…`, dollars in `adjustment_usd`, zero tokens) are
 *     ordinary rows too. A session's total is therefore the plain SUM over every
 *     row — exactly what `sumWindow` does (no generation filter = lifetime).
 *   - Claude rows: `priced_usd` is only a write-time cache. Reprice each row's
 *     TOKENS at the current MODEL_PRICING (the runner's pricing.ts is a verbatim
 *     copy of session-costs.ts), 1h cache write = 2x input, then add the row's
 *     stored `adjustment_usd`. Unknown model with billed tokens → $0 + unpriced.
 *   - Codex rows: keep `priced_usd` (it already includes `adjustment_usd`).
 *   - One documented exception to "sum every row": when the session carries the
 *     one-time migration seed `adj:<session>:base:<seq>`, rows stamped at the
 *     runner's LEDGER_BASELINE_GEN (-1) and dated at or before that seed are
 *     left out. That seed is the counter's
 *     pre-ledger spend, and the runner stamps the pre-existing codex history at
 *     gen -1 precisely because "its dollars are already inside the single
 *     adjustment; re-counting the repriced tokens would double it"
 *     (poll-loop.ts performLedgerMigrationBaseline). Gen -1 rows dated after
 *     the seed, or in a session with no seed, are history no adjustment covers
 *     (a native-codex session's first metering, a later /clear re-baseline) and
 *     they count. (Codex rows carry a day-granular `ts` — `<day>T00:00:00.000Z`
 *     — so a call from the migration day itself is treated as pre-seed.)
 *
 * Read-only: the DB is opened `readonly` + `fileMustExist`; nothing here writes.
 */
import { statSync } from 'fs';

import Database from 'better-sqlite3';

import { normalizeCodexModel } from './codex-costs.js';
import { MODEL_PRICING, normalizeModel } from './session-costs.js';

/** The `cost_events` columns this module reads (one row). */
export interface LedgerRow {
  id: string;
  /** `window_gen`; the runner's LEDGER_BASELINE_GEN is -1. Absent on early tables (= 0). */
  window_gen?: number;
  ts: string;
  provider: string;
  model: string;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_write_5m_tokens: number;
  cache_write_1h_tokens: number;
  output_tokens: number;
  priced_usd: number;
  adjustment_usd: number;
}

export interface PricedLedgerRow {
  usd: number;
  tokens: number;
  unpriced: boolean;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * One ledger row's dollars at the CURRENT rates. Claude rows mirror the
 * runner's `priceTokens` + `adjustment_usd` (sumWindow); codex rows keep their
 * write-time `priced_usd`.
 */
export function priceLedgerRow(row: LedgerRow): PricedLedgerRow {
  const input = n(row.input_tokens);
  const output = n(row.output_tokens);
  const cacheRead = n(row.cache_read_tokens);
  const cwFlat = n(row.cache_write_tokens);
  const cw5 = n(row.cache_write_5m_tokens);
  const cw1h = n(row.cache_write_1h_tokens);
  const tokens = input + output + cacheRead + cwFlat + cw5 + cw1h;
  if (row.provider === 'codex') {
    const billed = input + output + cacheRead;
    return {
      usd: n(row.priced_usd),
      tokens,
      // Same `*` rule the rollout walk uses: billed tokens on a model we can't name.
      unpriced: billed !== 0 && !normalizeCodexModel(row.model),
    };
  }
  const adjustment = n(row.adjustment_usd);
  const rate = MODEL_PRICING[normalizeModel(row.model)];
  if (!rate) {
    // priceTokens: a zero-token row legitimately costs $0; billed tokens on an
    // unknown model are UNPRICED ($0, flagged). The stored adjustment still counts.
    return { usd: adjustment, tokens, unpriced: tokens !== 0 };
  }
  // Any non-zero TTL field marks the row as split (signed rows carry negatives).
  const hasSplit = cw5 !== 0 || cw1h !== 0;
  const usd =
    input * rate.input +
    output * rate.output +
    cacheRead * rate.cacheRead +
    (hasSplit ? cw5 * rate.cacheCreate + cw1h * (rate.input * 2) : cwFlat * rate.cacheCreate) +
    adjustment;
  return { usd, tokens, unpriced: false };
}

/** Day bucket key `YYYYMMDD` from the row's own UTC `ts` (the shape server.ts's isoDayKey uses). */
export const LEDGER_MISSING_DAY_KEY = '00000000';
export function ledgerDayKey(ts: unknown): string {
  if (typeof ts !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(ts)) return LEDGER_MISSING_DAY_KEY;
  return ts.slice(0, 10).replace(/-/g, '');
}

export interface LedgerDay {
  cost: number;
  claudeUsd: number;
  codexUsd: number;
  tokens: number;
}

export interface SessionLedgerCost {
  /** The session has at least one `cost_events` row → the ledger is its cost source. */
  hasRows: boolean;
  /** The read completed (a failed read is never cached). */
  ok: boolean;
  days: Map<string, LedgerDay>;
  unpriced: boolean;
  rowCount: number;
}

/** The runner's sentinel generation for baselined (pre-existing) codex history. */
export const LEDGER_BASELINE_GEN = -1;
/** The runner's one-time migration seed id: `adj:<session>:base:<seq>` (poll-loop.ts). */
export function isMigrationBaseRow(id: string): boolean {
  return id.startsWith('adj:') && id.includes(':base:');
}

/** Fold a session's ledger rows into per-day buckets. Pure — the unit under test. */
export function foldLedgerRows(input: Iterable<LedgerRow>): SessionLedgerCost {
  const out: SessionLedgerCost = { hasRows: false, ok: true, days: new Map(), unpriced: false, rowCount: 0 };
  const rows = Array.isArray(input) ? (input as LedgerRow[]) : [...input];
  // See the module header: the migration seed already holds the dollars of the
  // history the runner stamped at LEDGER_BASELINE_GEN.
  // Earliest seed ts ('' = no seed). ISO-8601 Z strings order lexically.
  let seedTs = '';
  for (const r of rows) {
    if (isMigrationBaseRow(String(r.id)) && (seedTs === '' || String(r.ts) < seedTs)) seedTs = String(r.ts);
  }
  for (const row of rows) {
    out.hasRows = true;
    out.rowCount++;
    if (seedTs && Number(row.window_gen ?? 0) === LEDGER_BASELINE_GEN && String(row.ts) <= seedTs) continue;
    const p = priceLedgerRow(row);
    if (p.unpriced) out.unpriced = true;
    const key = ledgerDayKey(row.ts);
    const d = out.days.get(key) || { cost: 0, claudeUsd: 0, codexUsd: 0, tokens: 0 };
    d.cost += p.usd;
    if (row.provider === 'codex') d.codexUsd += p.usd;
    else d.claudeUsd += p.usd;
    d.tokens += p.tokens;
    out.days.set(key, d);
  }
  return out;
}

const LEDGER_BUSY_TIMEOUT_MS = 100;

/** Read + fold one outbound.db's ledger. Throws on a read failure (caller decides). */
export function readLedgerFromDb(dbPath: string): SessionLedgerCost {
  // Short busy timeout: this runs synchronously on the dashboard's event loop,
  // and better-sqlite3's default (5s) would stall every request each time the
  // runner holds the write lock. A busy read fails fast and is retried next tick.
  const db = new Database(dbPath, { readonly: true, fileMustExist: true, timeout: LEDGER_BUSY_TIMEOUT_MS });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'cost_events'").get();
    if (!hasTable) return { hasRows: false, ok: true, days: new Map(), unpriced: false, rowCount: 0 };
    // An early cost_events (pre-adjustment_usd) still prices: the column defaults to 0.
    const cols = new Set(
      (db.prepare("PRAGMA table_info('cost_events')").all() as { name: string }[]).map((c) => c.name),
    );
    const adj = cols.has('adjustment_usd') ? 'adjustment_usd' : '0 AS adjustment_usd';
    const gen = cols.has('window_gen') ? 'window_gen' : '0 AS window_gen';
    const rows = db
      .prepare(
        `SELECT id, ts, provider, model, input_tokens, cache_read_tokens, cache_write_tokens,
                cache_write_5m_tokens, cache_write_1h_tokens, output_tokens, priced_usd, ${adj}, ${gen}
           FROM cost_events`,
      )
      .iterate() as Iterable<LedgerRow>;
    return foldLedgerRows(rows);
  } finally {
    db.close();
  }
}

interface CachedLedger {
  mtimeMs: number;
  size: number;
  value: SessionLedgerCost;
}
const ledgerCache = new Map<string, CachedLedger>();

const NO_LEDGER: SessionLedgerCost = { hasRows: false, ok: true, days: new Map(), unpriced: false, rowCount: 0 };

/**
 * A session's ledger cost, cached per outbound.db keyed on mtime+size (the DB
 * runs journal_mode=DELETE, so every committed write bumps the main file).
 *
 * Missing outbound.db → no ledger (a stat miss is already cheap). A failed read
 * (e.g. the runner holds the write lock) serves the last good LEDGER value for the
 * path; otherwise — no cache, or a cached "no rows" that may since have gained
 * rows — it reports `ok:false`: the source is UNKNOWN this tick, and the caller
 * must not treat that as "no ledger, use the transcript" when it has a previous
 * figure to keep. Failures are never cached.
 */
export function getSessionLedgerCost(dbPath: string): SessionLedgerCost & { mtimeMs: number } {
  let st: { mtimeMs: number; size: number };
  try {
    st = statSync(dbPath);
  } catch {
    ledgerCache.delete(dbPath);
    return { ...NO_LEDGER, mtimeMs: 0 };
  }
  const cached = ledgerCache.get(dbPath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return { ...cached.value, mtimeMs: st.mtimeMs };
  }
  try {
    const value = readLedgerFromDb(dbPath);
    ledgerCache.set(dbPath, { mtimeMs: st.mtimeMs, size: st.size, value });
    return { ...value, mtimeMs: st.mtimeMs };
  } catch {
    if (cached?.value.hasRows) return { ...cached.value, mtimeMs: cached.mtimeMs };
    return { ...NO_LEDGER, ok: false, mtimeMs: st.mtimeMs };
  }
}

/** Drop cache entries for outbound.db paths no longer on disk / in any group. */
export function pruneLedgerCache(livePaths: Set<string>): void {
  for (const k of ledgerCache.keys()) if (!livePaths.has(k)) ledgerCache.delete(k);
}

/** Test-only: clear the per-path cache. */
export function clearLedgerCacheForTests(): void {
  ledgerCache.clear();
}
