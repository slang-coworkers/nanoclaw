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
 *
 * SCOPE OF THAT FIT — read before trusting a row. The 2 model ids it covered
 * were `gpt-5.6-sol` and `gpt-5.5`. NO codex-tuned model appeared in the prod
 * data, so their rates are NOT empirical; they are the published per-model
 * prices, and they are lower than the fitted tier. Adding a model here without
 * prod data means reading its documented rate, not copying a neighbouring row —
 * that copy is what made codex spend read ~2.9x high. `dashboard/codex-costs.ts`
 * (nv-dashboard) holds the same table and a cross-branch test fails on drift.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface CodexRate {
  /** USD per non-cached input token. */
  input: number;
  /** USD per output token (reasoning tokens are already inside output_tokens). */
  output: number;
  /** USD per cached (re-read) input token. */
  cacheRead: number;
}

/**
 * Rate for a codex model id that the table does not name.
 *
 * NOT zero, deliberately. Pricing an unrecognized model at $0 would let a model
 * rename buy unlimited unaccounted spend — the exact hole this module exists to
 * close. Every codex model this fleet has run carries these identical rates, so
 * it is the best available estimate rather than an arbitrary penalty. The scan
 * flags the id (`unpricedModels`) and the caller logs it.
 */
export const DEFAULT_CODEX_RATE: CodexRate = { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 };

/**
 * Keyed by BASE model id — `normalizeCodexModel` strips the provider prefix.
 *
 * `gpt-5.6-sol` and `gpt-5.5` are SOLVED: eight per-day rows from real prod
 * sessions fit these three rates with zero residual against `ccusage codex`.
 * The `-codex` siblings resolve to the same azure LiteLLM family and are listed
 * so a routine model switch does not raise a spurious "unknown model" warning;
 * numerically they are identical to `DEFAULT_CODEX_RATE`, so listing them
 * changes no charge either way.
 *
 * Field names and keys mirror `dashboard/codex-costs.ts` (the host copy) — the
 * two tables are duplicated, not shared, for the same reason `pricing.ts` is:
 * the Dockerfile copies only `container/agent-runner/` into the image and
 * `src/container-runner.ts` bind-mounts only `container/agent-runner/src` at
 * `/app/src`, so nothing under `dashboard/` is resolvable inside the container.
 * `codex-cost.test.ts` pins the rates on this side; the dashboard's suite pins
 * them on that side and cross-checks the shared keys.
 */
export const CODEX_MODEL_PRICING: Record<string, CodexRate> = {
  // Empirically fitted against ccusage (see RATES above) — prod-observed.
  'gpt-5.6-sol': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
  'gpt-5.5': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
  // Rest of the 5.6 family. Not prod-observed here, but the dashboard prices
  // them, and a model it bills for that this table lacks is a model the cost cap
  // cannot see — the enforcement hole #1327 closes, reopened by omission.
  'gpt-5.6': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
  'gpt-5.6-terra': { input: 2e-6, output: 12e-6, cacheRead: 0.2e-6 },
  'gpt-5.6-luna': { input: 0.2e-6, output: 1.2e-6, cacheRead: 0.02e-6 },
  // The codex-tuned variants are NOT the $5/$30 tier: they price identically to
  // their base models, which is cheaper. The ccusage fit above only ever saw
  // `gpt-5.6-sol` and `gpt-5.5`, so these six entries came from extrapolating
  // that tier — which silently overstated codex spend by ~2.9x and disagreed
  // with dashboard/codex-costs.ts. Values below are the published per-model
  // rates (developers.openai.com/api/docs/models/<id>), matching the dashboard.
  'gpt-5.5-codex': { input: 5e-6, output: 30e-6, cacheRead: 0.5e-6 },
  'gpt-5.3-codex': { input: 1.75e-6, output: 14e-6, cacheRead: 0.175e-6 },
  'gpt-5.2-codex': { input: 1.75e-6, output: 14e-6, cacheRead: 0.175e-6 },
  'gpt-5.1-codex': { input: 1.25e-6, output: 10e-6, cacheRead: 0.125e-6 },
  'gpt-5-codex': { input: 1.25e-6, output: 10e-6, cacheRead: 0.125e-6 },
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

/** One billed model call, as reported by `info.last_token_usage`. */
export interface CodexUsageEvent {
  /** UTC day ("YYYY-MM-DD") the call was billed on. */
  day: string;
  /** The model id verbatim off the wire — kept for the unknown-model report. */
  rawModel: string;
  input: number;
  cached: number;
  output: number;
}

/** Non-negative finite number, or 0. Guards against corrupt/partial rows. */
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Dollar cost of ONE call under its model's rate. */
export function priceCodexEvent(e: CodexUsageEvent): number {
  const rate = CODEX_MODEL_PRICING[normalizeCodexModel(e.rawModel)] ?? DEFAULT_CODEX_RATE;
  // `input_tokens` is inclusive of `cached_input_tokens` (verified against
  // ccusage, which reports the non-cached remainder). Clamp: a corrupt row must
  // not produce a negative charge.
  return Math.max(0, e.input - e.cached) * rate.input + e.cached * rate.cacheRead + e.output * rate.output;
}

/**
 * Identity of one billed call, for cross-file de-duplication.
 *
 * A codex subagent thread spawn writes its OWN rollout file that REPLAYS the
 * parent thread's already-billed turns, so the same call appears in two files.
 * Measured on prod: charging both over-counts by 13.7% and 19.2% on the two of
 * thirty sampled sessions that had forked rollouts. ccusage de-duplicates by the
 * usage tuple, and doing the same reproduced its figure EXACTLY on all thirty.
 *
 * `day` is part of the key, not just a payload field: a fork replay happens
 * within the same short-lived rollout (same UTC day almost always), so
 * including it costs nothing against the fork case, but WITHOUT it two
 * genuinely distinct calls on different days that happen to share a token
 * tuple would collide and the later one would silently vanish — permanently,
 * since a scan is recomputed from scratch every time and the earlier day
 * always sorts first.
 */
export function codexEventKey(e: CodexUsageEvent): string {
  return `${normalizeCodexModel(e.rawModel)}|${e.day}|${e.input}|${e.cached}|${e.output}`;
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
 * Parse one rollout file into the list of calls it billed.
 *
 * Reads `info.last_token_usage` — the THIS-CALL figure — rather than differencing
 * the cumulative `total_token_usage`. Both agree on an ordinary file, but a
 * forked subagent rollout starts its cumulative counter at the parent's total,
 * so differencing from zero charges the parent's whole history again. Per-call
 * figures let the caller de-duplicate across files instead (`codexEventKey`).
 *
 * Tracks the model from the most recent preceding `turn_context`: a rollout CAN
 * switch models mid-file, and pricing every call under one model would be wrong.
 *
 * `corrupted` distinguishes a genuinely bad line from the ordinary case of
 * codex still writing the file: only the LAST non-empty line of a rollout can
 * be a benign in-flight write (the next scan re-reads it once the write
 * finishes), so a parse failure on any EARLIER line is real corruption, not a
 * race — the caller must not treat that scan as complete for baselining or
 * enforcement purposes.
 */
export function parseCodexRollout(
  content: string,
  key: string,
): { key: string; events: CodexUsageEvent[]; corrupted: boolean } {
  const events: CodexUsageEvent[] = [];
  let rawModel = '';
  const lines = content.split('\n');
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]) {
      lastNonEmpty = i;
      break;
    }
  }
  let corrupted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Cheap pre-filter: the vast majority of rollout lines are response_items.
    if (line.indexOf('"turn_context"') < 0 && line.indexOf('"token_count"') < 0) continue;
    let row: { type?: string; timestamp?: string; payload?: Record<string, unknown> };
    try {
      row = JSON.parse(line) as typeof row;
    } catch {
      // A failure on the file's last line is codex mid-write — benign, self-heals
      // next scan. Anywhere else is real corruption: flag it.
      if (i !== lastNonEmpty) corrupted = true;
      continue;
    }
    const payload = row.payload;
    if (!payload) continue;
    if (row.type === 'turn_context') {
      const m = payload.model;
      if (typeof m === 'string' && m) rawModel = m;
      continue;
    }
    if (payload.type !== 'token_count') continue;
    const info = payload.info as { last_token_usage?: Record<string, unknown> } | undefined;
    const u = info?.last_token_usage;
    if (!u) continue;
    const input = num(u.input_tokens);
    const cached = num(u.cached_input_tokens);
    const output = num(u.output_tokens);
    // An all-zero row is codex reporting "no call happened" (a cancelled turn,
    // a bookkeeping tick). It also has a degenerate dedup key, so it must not
    // enter the set and swallow the next genuinely-zero call.
    if (input === 0 && output === 0) continue;
    events.push({ day: dayKeyOf(row.timestamp) || MISSING_DAY_KEY, rawModel, input, cached, output });
  }
  return { key, events, corrupted };
}

/**
 * Price parsed files into per-file, per-UTC-day USD, de-duplicating calls ACROSS
 * files.
 *
 * `owners` is the PERMANENT record of which file's rollout won each event key,
 * first-seen-ever — not a fresh Set rebuilt from this call's file list. Ownership
 * by "first in this scan's sorted+readable order" is unstable: if the file that
 * currently owns a key is unreadable on one scan, a later-sorted file claims it
 * and gets a ledger watermark for it; the moment the true owner becomes readable
 * again it would re-sort first and re-claim the key, and since it has no
 * watermark of its own that call is charged a second time (while the original
 * claimant's total silently drops, but a `delta <= 0` never reverses a charge).
 * Persisting the owner assignment across calls closes that: once a key is
 * claimed, it stays claimed by that file for the session's lifetime, so a
 * readability flip cannot move ownership, and the caller's per-file watermark
 * stays valid indefinitely. Pass a fresh Map for a one-off/test computation
 * that doesn't need cross-call stability.
 */
export function priceCodexFiles(
  files: Array<{ key: string; events: CodexUsageEvent[] }>,
  owners: Map<string, string> = new Map(),
): {
  files: CodexFileCost[];
  unpricedModels: string[];
} {
  const unpricedModels = new Set<string>();
  const out: CodexFileCost[] = [];
  for (const f of files) {
    const byDay: Record<string, number> = {};
    let totalUsd = 0;
    for (const e of f.events) {
      const k = codexEventKey(e);
      const owner = owners.get(k);
      if (owner === undefined) {
        owners.set(k, f.key);
      } else if (owner !== f.key) {
        continue; // permanently owned by a different file
      }
      if (e.rawModel && !normalizeCodexModel(e.rawModel)) unpricedModels.add(e.rawModel);
      const usd = priceCodexEvent(e);
      if (usd <= 0) continue;
      byDay[e.day] = (byDay[e.day] ?? 0) + usd;
      totalUsd += usd;
    }
    out.push({ key: f.key, byDay, totalUsd });
  }
  return { files: out, unpricedModels: [...unpricedModels] };
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
  parsed: { key: string; events: CodexUsageEvent[]; corrupted: boolean };
}
// Caches the PARSE (per file, deterministic), not the pricing — pricing depends
// on what earlier files claimed, so it has to be redone for the whole session
// on every scan. Parsing is the expensive half; the events lists are tiny.
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
 *
 * `owners` is the persistent cross-scan ownership map — see `priceCodexFiles`.
 * The caller must hold this across calls (same instance passed every fold);
 * a fresh Map here would reopen the readability-flip double-charge it exists
 * to close.
 */
export function scanCodexRollouts(home: string = codexHome(), owners: Map<string, string> = new Map()): CodexScan {
  const sessionsDir = path.join(home, 'sessions');
  const parsed: Array<{ key: string; events: CodexUsageEvent[]; corrupted: boolean }> = [];
  const listed = listRollouts(sessionsDir);
  let errors = listed.errors;
  // Sorted by path, which is chronological (`rollout-<ISO timestamp>-<uuid>`)
  // — so a forked replay always loses its duplicate calls to the original.
  for (const p of listed.paths.sort()) {
    const key = path.relative(sessionsDir, p);
    let st: fs.Stats;
    try {
      st = fs.statSync(p);
    } catch {
      errors++;
      continue;
    }
    const hit = memo.get(p);
    let entry: { key: string; events: CodexUsageEvent[]; corrupted: boolean };
    if (hit && hit.size === st.size && hit.mtimeMs === st.mtimeMs) {
      entry = hit.parsed;
    } else {
      let content: string;
      try {
        content = fs.readFileSync(p, 'utf-8');
      } catch {
        errors++;
        continue;
      }
      entry = parseCodexRollout(content, key);
      memo.set(p, { size: st.size, mtimeMs: st.mtimeMs, parsed: entry });
    }
    // A corrupted file (a parse failure on a non-trailing line) is NOT the
    // benign in-flight-write case — count it toward errors so the caller
    // treats this scan as incomplete rather than a session that genuinely
    // has less usage in that file than it truly billed.
    if (entry.corrupted) errors++;
    parsed.push(entry);
  }
  const { files, unpricedModels } = priceCodexFiles(parsed, owners);
  return { files, unpricedModels, errors };
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
