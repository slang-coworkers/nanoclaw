/**
 * Codex (MCP tool) spend, read off the rollout files codex-cli writes.
 *
 * WHY THIS EXISTS (issue #1327). The `codex-critique` skill calls
 * `mcp__codex__codex` / `mcp__codex__codex-reply` as a DIRECT MCP tool — a
 * `codex mcp-server` stdio child, not a Claude subagent — so its model
 * inference never touches the Claude SDK stream the cost cap accounts from.
 * Before this module, codex spend was invisible to enforcement entirely: on the
 * session that motivated the issue it was $76.72 of real, uncapped money next
 * to $78.69 of Claude spend.
 *
 * `src/container-runner.ts` mounts `<sessionDir>/codex` at `/home/node/.codex`
 * for EVERY session (not just codex-provider ones), so `$CODEX_HOME` is
 * per-session and needs no cross-session attribution: everything under it
 * belongs to this session.
 *
 * ROLLOUT FORMAT (verified against real prod files):
 *   {"type":"session_meta","payload":{…}}
 *   {"type":"turn_context","payload":{…,"model":"gpt-5.6-sol",…}}
 *   {"type":"event_msg","payload":{"type":"token_count","info":{
 *      "total_token_usage":{input_tokens,cached_input_tokens,
 *        cache_write_input_tokens,output_tokens,reasoning_output_tokens,
 *        total_tokens},
 *      "last_token_usage":{…this call only…}}}}
 * `total_token_usage` is CUMULATIVE for the file; `input_tokens` INCLUDES
 * `cached_input_tokens`; `output_tokens` already includes
 * `reasoning_output_tokens`.
 *
 * RATES. Not guessed. `dashboard/server.ts` prices codex by shelling out to
 * `ccusage codex daily --json --offline`; those figures are the ones the
 * Overview already reports. I ran that exact oracle against 8 real prod session
 * codex directories, took the per-day token/cost rows, and solved the resulting
 * 8 linear equations across 2 distinct model ids. Exact fit, zero residual:
 * input $5.00/Mtok, cached-read $0.50/Mtok, output $30.00/Mtok, and
 * `cache_write_input_tokens` billed at $0 (charging it broke the fit). A
 * from-scratch reimplementation with those rates then reproduced ccusage on 4
 * whole sessions to the cent, including the issue's session ($76.7210 both) and
 * per UTC day. `codex-cost.test.ts` pins the table, in the same anti-drift style
 * `pricing.test.ts` uses for the Claude table.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface CodexRate {
  /** USD per non-cached input token. */
  input: number;
  /** USD per cached (re-read) input token. */
  cachedInput: number;
  /** USD per output token (reasoning tokens are already inside output_tokens). */
  output: number;
}

/**
 * Rate for a codex model id that the table does not name.
 *
 * NOT zero, deliberately. Pricing an unrecognized model at $0 would let a model
 * rename buy unlimited unaccounted spend — the exact hole this module exists to
 * close. Both model ids observed in production carry these identical rates, so
 * this is the best available estimate rather than an arbitrary penalty. The
 * scan flags it (`unpricedModels`) and the caller logs it.
 */
export const DEFAULT_CODEX_RATE: CodexRate = { input: 5e-6, cachedInput: 0.5e-6, output: 30e-6 };

/** Keyed by BASE model id — `normalizeCodexModel` strips the provider prefix. */
export const CODEX_MODEL_PRICING: Record<string, CodexRate> = {
  'gpt-5.6-sol': { input: 5e-6, cachedInput: 0.5e-6, output: 30e-6 },
  'gpt-5.5': { input: 5e-6, cachedInput: 0.5e-6, output: 30e-6 },
  'gpt-5.5-codex': { input: 5e-6, cachedInput: 0.5e-6, output: 30e-6 },
};

/**
 * Reduce a codex wire model id to its pricing key.
 *
 * Rollout `turn_context.payload.model` is the bare id (`gpt-5.6-sol`), but the
 * same model reaches ccusage/the dashboard provider-prefixed
 * (`azure/openai/gpt-5.6-sol`, `openai/openai/gpt-5.5`), and `CODEX_MODEL` on
 * the host is set in the prefixed form. Accept both. Returns '' when the id is
 * unknown so the caller can flag it rather than silently reading $0.
 */
export function normalizeCodexModel(model: string | undefined): string {
  if (!model) return '';
  let m = model.trim().toLowerCase();
  // Strip any leading provider path segments (`azure/openai/`, `openai/openai/`,
  // `openai/`) — the model id itself never contains a slash.
  const slash = m.lastIndexOf('/');
  if (slash >= 0) m = m.slice(slash + 1);
  return CODEX_MODEL_PRICING[m] ? m : '';
}

/** Cumulative token counters as they appear in `info.total_token_usage`. */
interface CodexTokenTotals {
  input: number;
  cached: number;
  output: number;
}

const ZERO_TOTALS: CodexTokenTotals = { input: 0, cached: 0, output: 0 };

/** Non-negative finite integer, or 0. Guards against corrupt/partial rows. */
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Dollar cost of a TOKEN DELTA under one model's rate. */
function priceCodexDelta(model: string | undefined, d: CodexTokenTotals): { usd: number; unpriced: boolean } {
  const key = normalizeCodexModel(model);
  const rate = CODEX_MODEL_PRICING[key] ?? DEFAULT_CODEX_RATE;
  // `input_tokens` is inclusive of `cached_input_tokens` (verified against
  // ccusage, which reports the non-cached remainder). Clamp: a corrupt row must
  // not produce a negative charge.
  const nonCached = Math.max(0, d.input - d.cached);
  const usd = nonCached * rate.input + d.cached * rate.cachedInput + d.output * rate.output;
  return { usd, unpriced: key === '' && (d.input > 0 || d.output > 0) };
}

/** One rollout file's spend, partitioned by the UTC day it was billed on. */
export interface CodexFileCost {
  /** Stable identity for the ledger: the path relative to `sessions/`. */
  key: string;
  /** UTC day ("YYYY-MM-DD") → cumulative USD spent on that day in this file. */
  byDay: Record<string, number>;
  /** Sum over `byDay` — the file's whole-life cost. */
  totalUsd: number;
}

export interface CodexScan {
  files: CodexFileCost[];
  /** Model ids seen that the rate table does not name (priced at the default). */
  unpricedModels: string[];
  /**
   * Rollout files (or directories) the scan could not read.
   *
   * Reported rather than swallowed: a scan that silently returns fewer files
   * looks identical to a session that simply spent less, and a caller that
   * baselines off it would absorb spend it never actually saw. An unreadable
   * file loses NOTHING permanently — its ledger entries are untouched, so the
   * whole delta is charged the moment it becomes readable again — but the
   * caller still needs to know not to treat this scan as authoritative.
   */
  errors: number;
}

/** UTC day key of an ISO timestamp; '' when unparseable. */
function dayKeyOf(ts: unknown): string {
  if (typeof ts !== 'string' || ts.length < 10) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * Parse one rollout file into per-UTC-day USD.
 *
 * Walks the file in order, tracking the model from the most recent preceding
 * `turn_context` — a rollout CAN switch models mid-file, and pricing one
 * cumulative total under a single model would then be wrong. Each `token_count`
 * entry's POSITIVE delta against the previous cumulative reading is priced under
 * the model in effect at that point and attributed to the entry's UTC day.
 */
export function parseCodexRollout(content: string, key: string): { file: CodexFileCost; unpriced: Set<string> } {
  const byDay: Record<string, number> = {};
  const unpriced = new Set<string>();
  let model: string | undefined;
  let prev: CodexTokenTotals = ZERO_TOTALS;
  let totalUsd = 0;

  for (const line of content.split('\n')) {
    if (!line) continue;
    // Cheap pre-filter: the vast majority of rollout lines are response_items.
    if (line.indexOf('"turn_context"') < 0 && line.indexOf('"token_count"') < 0) continue;
    let row: { type?: string; timestamp?: string; payload?: Record<string, unknown> };
    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      continue; // truncated tail while codex is mid-write — the next scan sees it
    }
    const payload = row.payload;
    if (!payload) continue;
    if (row.type === 'turn_context') {
      const m = payload.model;
      if (typeof m === 'string' && m) model = m;
      continue;
    }
    if (payload.type !== 'token_count') continue;
    const info = payload.info as { total_token_usage?: Record<string, unknown> } | undefined;
    const t = info?.total_token_usage;
    if (!t) continue;
    const cur: CodexTokenTotals = {
      input: num(t.input_tokens),
      cached: num(t.cached_input_tokens),
      output: num(t.output_tokens),
    };
    // Only POSITIVE deltas. A cumulative counter that goes backwards (a codex
    // restart writing into the same file, a corrupt row) must never refund.
    const delta: CodexTokenTotals = {
      input: Math.max(0, cur.input - prev.input),
      cached: Math.max(0, cur.cached - prev.cached),
      output: Math.max(0, cur.output - prev.output),
    };
    prev = {
      input: Math.max(prev.input, cur.input),
      cached: Math.max(prev.cached, cur.cached),
      output: Math.max(prev.output, cur.output),
    };
    const { usd, unpriced: isUnpriced } = priceCodexDelta(model, delta);
    if (isUnpriced && model) unpriced.add(model);
    if (usd <= 0) continue;
    const day = dayKeyOf(row.timestamp) || MISSING_DAY_KEY;
    byDay[day] = (byDay[day] ?? 0) + usd;
    totalUsd += usd;
  }
  return { file: { key, byDay, totalUsd }, unpriced };
}

/**
 * Day bucket for a `token_count` row with no usable timestamp. Charged like any
 * other bucket in a lifetime window; in a daily window it is NOT today's key, so
 * it is recorded and not charged — the conservative side of an unknowable date.
 */
export const MISSING_DAY_KEY = 'unknown-day';

/** Resolved `CODEX_HOME`, matching how codex-cli itself resolves it. */
export function codexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

interface MemoEntry {
  size: number;
  mtimeMs: number;
  file: CodexFileCost;
  unpriced: string[];
}
const memo = new Map<string, MemoEntry>();

/** Test seam: drop the per-file memo so a fixture rewritten within one mtime tick re-parses. */
export function __resetCodexCostMemo(): void {
  memo.clear();
}

/**
 * Recursively collect `rollout-*.jsonl` under `sessions/`. Synchronous by design.
 *
 * A missing `sessions/` dir is NOT an error — it is the normal state of a
 * session that has never called codex. Any other read failure is counted.
 */
function listRollouts(sessionsDir: string): { paths: string[]; errors: number } {
  const paths: string[] = [];
  let errors = 0;
  const walk = (dir: string, depth: number): void => {
    if (depth > 6) return; // sessions/YYYY/MM/DD/file — 6 is generous
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') errors++;
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) paths.push(p);
    }
  };
  walk(sessionsDir, 0);
  return { paths, errors };
}

/**
 * Scan every rollout under `<home>/sessions` and return each file's per-UTC-day
 * cost. ABSOLUTE (whole-life) figures — the caller diffs them against a
 * persisted ledger, so this function is idempotent and safe to call repeatedly.
 *
 * SYNCHRONOUS on purpose: the caller folds the result into live cost state, and
 * an `await` in the middle would let a `/clear`, a UTC-day rollover, or a second
 * scan interleave with the fold. No async, no interleaving, no locking needed.
 *
 * Unchanged files are served from a `(size, mtimeMs)` memo, so a steady-state
 * scan is one `stat` per file.
 */
export function scanCodexRollouts(home: string = codexHome()): CodexScan {
  const sessionsDir = path.join(home, 'sessions');
  const files: CodexFileCost[] = [];
  const unpricedModels = new Set<string>();
  const listed = listRollouts(sessionsDir);
  let errors = listed.errors;
  for (const p of listed.paths) {
    const key = path.relative(sessionsDir, p);
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      errors++;
      continue;
    }
    const hit = memo.get(p);
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) {
      files.push(hit.file);
      for (const m of hit.unpriced) unpricedModels.add(m);
      continue;
    }
    let content: string;
    try {
      content = fs.readFileSync(p, 'utf-8');
    } catch {
      errors++;
      continue;
    }
    const { file, unpriced } = parseCodexRollout(content, key);
    memo.set(p, { size: st.size, mtimeMs: st.mtimeMs, file, unpriced: [...unpriced] });
    files.push(file);
    for (const m of unpriced) unpricedModels.add(m);
  }
  return { files, unpricedModels: [...unpricedModels], errors };
}

/**
 * Ledger key for one (rollout file, UTC day) pair.
 *
 * A plain space joins them: the key is persisted inside JSON in the session DB,
 * so it has to stay printable (a NUL separator survives JSON but is a hazard in
 * SQLite text tooling), and rollout basenames never contain spaces
 * (`rollout-<ISO-with-dashes>-<uuid>.jsonl`). The day is a fixed-width suffix,
 * so the composite is unambiguous regardless.
 */
export function ledgerKey(fileKey: string, day: string): string {
  return `${fileKey} ${day}`;
}
