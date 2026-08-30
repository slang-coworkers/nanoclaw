/**
 * Standing cost-parity harness: runner ↔ dashboard ↔ ccusage (issue #1375).
 *
 * WHY THIS EXISTS
 *
 * Three independent code paths price the same tokens, and they are duplicated
 * rather than shared:
 *
 *   1. `container/agent-runner/src/pricing.ts` + `codex-cost.ts` — the ENFORCER.
 *      Runs on Bun inside the container, drives the live Tier-2 cost cap.
 *   2. `dashboard/session-costs.ts` + `dashboard/codex-costs.ts` — the REPORTER.
 *      Runs on Node on the host, drives the cost column a human reads.
 *   3. `ccusage` (LiteLLM pricing) — the ORACLE. Neither of ours, and the only
 *      one that tracks upstream rate changes without a human editing a table.
 *
 * (1) and (2) cannot import each other: the Dockerfile copies only
 * `agent-runner/` into /app and `src/container-runner.ts` bind-mounts only
 * `container/agent-runner/src` at /app/src, so nothing under `dashboard/`
 * resolves inside the container. So the tables are copied, and a copy drifts.
 *
 * Every failure in this area has been DATA, not logic, and has failed SILENTLY:
 * a missing `claude-opus-5` row understated prod spend 52x ($603 shown against
 * $31,511 actual) and nothing went red, because an unpriced model and a free one
 * are indistinguishable in a total. `codex` extrapolation overstated codex spend
 * 2.9x. A dated-suffix normalizer disagreement priced `gpt-5.6-luna` at 25x and
 * hard-stopped sessions at ~4% of their configured ceiling. None of these were
 * catchable by testing a parser.
 *
 * So this harness asserts on the TABLES and on real DOLLARS, not on parsers.
 *
 * TWO LEGS
 *
 *   tables   — hermetic. Runner tables/normalizers == dashboard tables/
 *              normalizers. No network, no transcripts. Safe in CI. No-ops with
 *              an explicit SKIP when `dashboard/` is not in the tree (it lives
 *              on nv-dashboard; CI composes every nv-* branch into one tree, and
 *              a full deploy merges them, so both halves are present there).
 *
 *   session  — operational. Reprice real transcripts with the RUNNER's shipped
 *              pricing functions and compare to ccusage. Catches the thing leg 1
 *              structurally cannot: both of our copies agreeing with each other
 *              and both being wrong against upstream rates.
 *
 * USAGE
 *
 *   pnpm exec tsx scripts/cost-parity.ts tables
 *   pnpm exec tsx scripts/cost-parity.ts session \
 *       --codex-home  <dir>   # a session's codex/ dir (contains sessions/)
 *       --claude-dir  <dir>   # an agent group's .claude-shared/ (contains projects/)
 *       [--since YYYYMMDD] [--json] [--claude-threshold 5] [--codex-threshold 10]
 *
 * On a prod box (slang-coworkers), the two dirs for one agent group / session are:
 *
 *   CLAUDE=~/slang-coworkers-prod/nanoclaw/data/v2-sessions/<agent-group>/.claude-shared
 *   CODEX=~/slang-coworkers-prod/nanoclaw/data/v2-sessions/<agent-group>/<sess-id>/codex
 *   pnpm exec tsx scripts/cost-parity.ts session --claude-dir "$CLAUDE" --codex-home "$CODEX" --since 20260801
 *
 * `--claude-dir` also accepts the `projects/` dir itself; CLAUDE_CONFIG_DIR is
 * derived (ccusage wants the PARENT of `projects/`, our walk wants either).
 * Either flag may be omitted to run just the other leg.
 *
 * EXIT CODE: 0 = parity (or skipped); 1 = DRIFT, or the oracle was requested and
 * could not be reached. Never exits 0 on an unreachable oracle — "$0 because
 * ccusage did not run" is the exact failure this harness is here to prevent.
 *
 * THRESHOLDS — claude 5%, codex 10%. They are NOT symmetric, deliberately:
 *
 *   Claude reconciles to the CENT against ccusage run ONLINE (validated on prod:
 *   $3.295085 ours vs $3.2951 ccusage, identical tokens). 5% is pure headroom;
 *   anything above it is a real defect.
 *
 *   Codex carries a KNOWN ~2% aggregate residual that is not our bug: ccusage
 *   applies DATE-EFFECTIVE pricing (e.g. gpt-5.6-sol output at ~$45/Mtok on some
 *   dates, $30 on others) and our flat `CODEX_MODEL_PRICING` cannot express a
 *   rate that changes over time. Worst single session measured ~12%. The band
 *   absorbs that so the harness does not cry wolf every run; the real fix is a
 *   dated rate table (see docs/cost-cap-model.md and issue #1375).
 *
 * ccusage IS THE PINNED, LOCKFILE-RESOLVED DEPENDENCY (`"ccusage": "20.0.19"`),
 * resolved out of this project's node_modules and nowhere else — the same
 * discipline dashboard/server.ts uses. NEVER npx/bunx: `npx --yes` downloads and
 * runs whatever the registry currently serves, on the host, as the host user,
 * bypassing both the lockfile and this repo's 3-day release-age quarantine.
 *
 * The Claude oracle call MUST run ONLINE (no `--offline`). `--offline` prices
 * from the snapshot bundled inside ccusage 20.0.19, which has no entry for the
 * internal ids this fleet runs (`claude-opus-5`, `claude-sonnet-5`) and returns
 * cost 0 with the tokens intact. The codex oracle call keeps `--offline`:
 * ccusage's bundled snapshot knows `gpt-5.6-sol`, and the codex path is exactly
 * where the network-free run is trustworthy.
 */

import { execFile } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import {
  CODEX_MODEL_PRICING,
  MISSING_DAY_KEY,
  normalizeCodexModel,
  priceCodexEvent,
  scanCodexRollouts,
  __resetCodexCostMemo,
} from '../container/agent-runner/src/codex-cost.js';
import { MODEL_PRICING, normalizeModel, priceUsage, type TokenUsage } from '../container/agent-runner/src/pricing.js';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Day bucket for a transcript row with no usable timestamp. Mirrors codex's MISSING_DAY_KEY. */
export const MISSING_TS_KEY = 'unknown-day';

/** Default drift bands, in percent. See the header for why they differ. */
export const DEFAULT_THRESHOLDS = { claude: 5, codex: 10 } as const;

// ───────────────────────────── LEG 1: table parity ──────────────────────────

export interface TableParityResult {
  status: 'ok' | 'skipped' | 'drift';
  /** Why the run was skipped (dashboard half absent). */
  reason?: string;
  /** Human-readable drift descriptions. Non-empty iff status === 'drift'. */
  findings: string[];
  /** Non-fatal observations (e.g. runner prices a model the dashboard does not). */
  notes: string[];
  /** Dashboard modules discovered by content and compared against. */
  modules: string[];
  /** Number of table/normalizer comparisons actually performed. */
  checks: number;
}

/**
 * Discover the dashboard's pricing modules by CONTENT, never by filename.
 *
 * A rename of `session-costs.ts` must not silently disable this guard — a guard
 * that quietly stops guarding is worse than no guard, because the green run
 * reads as evidence. Match only files that EXPORT the table or the normalizer,
 * never mere consumers: importing a consumer risks dragging in `server.ts`
 * (which boots an HTTP server and opens the DB at import time) and turning a
 * pricing check into a red herring.
 *
 * `server.ts`'s FALLBACK_PRICING is deliberately NOT reached here for that
 * reason. It is already pinned to session-costs.ts's MODEL_PRICING by
 * `dashboard/session-costs.test.ts`, so it is transitively covered: this file
 * pins the runner to session-costs.ts, and that test pins session-costs.ts to
 * FALLBACK_PRICING.
 */
const DASHBOARD_CLAUDE_EXPORT_RE = /export\s+(?:function\s+normalizeModel|const\s+MODEL_(?:PRICING|RATES))\b/;
const DASHBOARD_CODEX_EXPORT_RE = /export\s+(?:function\s+normalizeCodexModel|const\s+CODEX_MODEL_(?:PRICING|RATES))\b/;

export function findDashboardPricingFiles(repoRoot: string = REPO_ROOT): string[] {
  const root = path.join(repoRoot, 'dashboard');
  const hits: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'public') continue;
        walk(full, depth + 1);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith('.ts') || e.name.endsWith('.test.ts')) continue;
      let source = '';
      try {
        source = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      if (DASHBOARD_CLAUDE_EXPORT_RE.test(source) || DASHBOARD_CODEX_EXPORT_RE.test(source)) hits.push(full);
    }
  };
  if (fs.existsSync(root)) walk(root, 0);
  return hits.sort();
}

type RateRecord = Record<string, Record<string, number>>;
type Normalizer = (m: string | undefined) => string;

function isRateTable(value: unknown): value is RateRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  );
}

/**
 * Wire forms one model id is seen in, across both sides. The normalizer battery
 * runs over the UNION of both tables' keys — enumerating only one side's keys
 * would miss the drift where a model EITHER side prices resolves to '' on the
 * other, which is precisely the 25x-overcharge shape that hard-stopped sessions.
 */
function normalizerInputs(bases: Iterable<string>, prefixes: string[]): (string | undefined)[] {
  const inputs: (string | undefined)[] = [
    undefined,
    '',
    '<synthetic>',
    'some-future-model',
    'totally-unknown-latest',
    // Inherited Object.prototype keys: a truthy-index membership test (rather
    // than hasOwnProperty) resolves these to a "known" model and prices garbage.
    'constructor',
    'constructor-20260101',
    '__proto__-latest',
    'toString',
    'valueOf',
  ];
  for (const base of bases) {
    inputs.push(base, `${base}-20260101`, `${base}-latest`, `  ${base.toUpperCase()} `, `${base}[1m]`, `${base}-v1`);
    for (const p of prefixes) inputs.push(`${p}${base}`, `${p}${base}-20260101`);
  }
  return inputs;
}

const CLAUDE_PREFIXES = ['aws/anthropic/', 'aws/anthropic/bedrock-', 'anthropic/'];
const CODEX_PREFIXES = ['azure/openai/', 'openai/openai/', 'openai/'];

/**
 * Leg 1. Pure, hermetic, no network. Returns rather than throws so both the CLI
 * and the vitest suite can consume the same result.
 */
export async function checkTableParity(repoRoot: string = REPO_ROOT): Promise<TableParityResult> {
  const findings: string[] = [];
  const notes: string[] = [];
  let checks = 0;

  const files = findDashboardPricingFiles(repoRoot);
  if (files.length === 0) {
    return {
      status: 'skipped',
      reason:
        `no dashboard/ pricing module in ${repoRoot} — the dashboard half lives on nv-dashboard. ` +
        'CI composes every nv-* branch into one tree and a full deploy merges them, so this leg runs there.',
      findings,
      notes,
      modules: [],
      checks: 0,
    };
  }

  const claudeTables: { where: string; table: RateRecord }[] = [];
  const codexTables: { where: string; table: RateRecord }[] = [];
  const claudeNormalizers: { where: string; fn: Normalizer }[] = [];
  const codexNormalizers: { where: string; fn: Normalizer }[] = [];

  for (const file of files) {
    // An import failure is NOT swallowed. A rate table the host cannot load is a
    // table nothing can check, which is the failure mode this guard prevents.
    const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod)) {
      const isCodexName = /CODEX/i.test(name);
      if (/MODEL_(PRICING|RATES)/i.test(name) && isRateTable(value)) {
        (isCodexName ? codexTables : claudeTables).push({ where: `${file}#${name}`, table: value });
      }
      if (name === 'normalizeModel' && typeof value === 'function') {
        claudeNormalizers.push({ where: `${file}#${name}`, fn: value as Normalizer });
      }
      if (name === 'normalizeCodexModel' && typeof value === 'function') {
        codexNormalizers.push({ where: `${file}#${name}`, fn: value as Normalizer });
      }
    }
  }

  // Found the files by content but got no usable export out of them: the module
  // shape changed under the discovery regex. Fail loudly — a vacuous pass here
  // is how a guard starts lying.
  if (claudeTables.length + codexTables.length === 0) {
    findings.push(
      `discovered dashboard pricing modules (${files.join(', ')}) but none exported a rate table — ` +
        'the discovery regex and the module shape have diverged; this guard is not guarding anything.',
    );
  }

  const sides: {
    label: 'claude' | 'codex';
    runnerTable: Record<string, Record<string, number>>;
    runnerNormalize: Normalizer;
    tables: { where: string; table: RateRecord }[];
    normalizers: { where: string; fn: Normalizer }[];
    prefixes: string[];
  }[] = [
    {
      label: 'claude',
      runnerTable: MODEL_PRICING as unknown as Record<string, Record<string, number>>,
      runnerNormalize: normalizeModel,
      tables: claudeTables,
      normalizers: claudeNormalizers,
      prefixes: CLAUDE_PREFIXES,
    },
    {
      label: 'codex',
      runnerTable: CODEX_MODEL_PRICING as unknown as Record<string, Record<string, number>>,
      runnerNormalize: normalizeCodexModel,
      tables: codexTables,
      normalizers: codexNormalizers,
      prefixes: CODEX_PREFIXES,
    },
  ];

  for (const side of sides) {
    for (const { where, table } of side.tables) {
      // (a) Every model BOTH sides know must be priced identically. A rate that
      //     differs renders with full confidence on both surfaces and invites no
      //     scrutiny — worse than a missing one.
      for (const [model, dashRate] of Object.entries(table)) {
        const runnerRate = side.runnerTable[model];
        if (!runnerRate) continue; // covered by (b)
        checks++;
        for (const [field, value] of Object.entries(dashRate)) {
          if (runnerRate[field] !== value) {
            findings.push(
              `${side.label}: rate drift on ${model}.${field} — runner ${runnerRate[field]} vs ${where} ${value}`,
            );
          }
        }
        for (const field of Object.keys(runnerRate)) {
          if (!(field in dashRate)) {
            findings.push(`${side.label}: ${where}[${model}] has no ${field}, runner does (${runnerRate[field]})`);
          }
        }
      }
      // (b) The runner must know every model the DASHBOARD prices. A model the
      //     dashboard bills for that the runner lacks is a model the cost cap
      //     cannot see — the enforcement hole #1327 closed, reopened by omission.
      checks++;
      const missing = Object.keys(table).filter((m) => !(m in side.runnerTable));
      if (missing.length > 0) {
        findings.push(
          `${side.label}: the runner cannot price ${missing.join(', ')} — priced by ${where}, so the cost cap ` +
            'is blind to spend the dashboard reports.',
        );
      }
      // The reverse is allowed (the enforcer may be more conservative than the
      // reporter) but is still worth surfacing: it means a session can be capped
      // for spend the human-facing column will render as $0.
      const extra = Object.keys(side.runnerTable).filter((m) => !(m in table));
      if (extra.length > 0) {
        notes.push(
          `${side.label}: runner prices ${extra.join(', ')}, ${where} does not (allowed, but it will read $0)`,
        );
      }
    }

    // (c) The two NORMALIZERS must agree. The tables agreeing proves nothing if
    //     the functions that decide WHICH row to read disagree — that drift
    //     dropped dated ids to DEFAULT_CODEX_RATE on the enforcer side only.
    if (side.tables.length > 0 && side.normalizers.length === 0) {
      findings.push(
        `${side.label}: dashboard exports a rate table but no normalize${side.label === 'codex' ? 'CodexModel' : 'Model'} — ` +
          'the normalizer half of this guard cannot run.',
      );
    }
    const bases = new Set<string>(Object.keys(side.runnerTable));
    for (const { table } of side.tables) for (const k of Object.keys(table)) bases.add(k);
    const inputs = normalizerInputs(bases, side.prefixes);
    for (const { where, fn } of side.normalizers) {
      for (const input of inputs) {
        checks++;
        const mine = side.runnerNormalize(input);
        const theirs = fn(input);
        if (mine !== theirs) {
          findings.push(
            `${side.label}: normalizer drift on ${JSON.stringify(input)} — ` +
              `runner ${JSON.stringify(mine)} vs ${where} ${JSON.stringify(theirs)}`,
          );
        }
      }
    }
  }

  return {
    status: findings.length > 0 ? 'drift' : 'ok',
    findings,
    notes,
    modules: files,
    checks,
  };
}

// ─────────────────────────── LEG 2: reprice vs oracle ───────────────────────

export interface ClaudeReprice {
  totalUsd: number;
  /** 'YYYY-MM-DD' → USD. MISSING_TS_KEY for rows with no parseable timestamp. */
  byDay: Record<string, number>;
  byModel: Record<string, number>;
  files: number;
  /** Assistant usage rows charged (post-dedup). */
  messages: number;
  /** Rows dropped because their `message.id` was already charged. */
  duplicates: number;
  /** Usage-bearing rows dropped because `type !== 'assistant'`. */
  nonAssistant: number;
  /** Usage rows with no `message.id`: undedupable, so NOT charged (matches the runner). */
  missingId: number;
  unpricedModels: string[];
  tokens: { input: number; output: number; cacheRead: number; cacheCreate: number };
}

/**
 * Reprice a Claude transcript tree with the RUNNER's shipped `priceUsage`.
 *
 * Deliberately imports the enforcer's pricing rather than re-deriving it: a copy
 * of the math here would prove only that the copy matches ccusage.
 *
 * DEDUP IS BY `message.id` ALONE. Not (id, requestId). The SDK emits one
 * transcript row per CONTENT BLOCK (thinking / text / tool_use), every block of
 * one API response repeating the same wire `message.id` AND the same
 * message-level `usage`; and a resumed/rewound session replays the same message
 * with a fresh top-level `uuid`. Counting every row runs 1.7x–2.8x the true
 * figure. `requestId` is NULL on Bedrock (`msg_bdrk_*` ids), so a gate on
 * (id, requestId) never fires and reinstates the double count. This is exactly
 * what the runner does (`seenMessageIds` in poll-loop.ts) and what the dashboard
 * does (`scanFileCost` in dashboard/server.ts).
 *
 * A row with NO id is counted and NOT charged, matching the runner: without an
 * id it cannot be deduplicated, so charging it risks charging one API response
 * once per block. `missingId > 0` in the report means our figure is a floor.
 */
export function repriceClaudeTranscripts(root: string, since?: string): ClaudeReprice {
  const files: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && e.name.endsWith('.jsonl')) files.push(p);
    }
  };
  const st = fs.statSync(root);
  if (st.isDirectory()) walk(root, 0);
  else files.push(root);

  const out: ClaudeReprice = {
    totalUsd: 0,
    byDay: {},
    byModel: {},
    files: files.length,
    messages: 0,
    duplicates: 0,
    nonAssistant: 0,
    missingId: 0,
    unpricedModels: [],
    tokens: { input: 0, output: 0, cacheRead: 0, cacheCreate: 0 },
  };
  // Session-wide, not per-file: a resumed session's transcript can be split
  // across files and ccusage dedupes globally.
  const seen = new Set<string>();
  const unpriced = new Set<string>();

  for (const f of files.sort()) {
    let content: string;
    try {
      content = fs.readFileSync(f, 'utf-8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      if (!line || line.indexOf('"usage"') < 0) continue;
      let row: { type?: string; timestamp?: string; message?: { id?: string; model?: string; usage?: TokenUsage } };
      try {
        row = JSON.parse(line) as typeof row;
      } catch {
        continue;
      }
      const msg = row.message;
      if (!msg?.usage) continue;
      if (row.type !== 'assistant') {
        out.nonAssistant++;
        continue;
      }
      if (!msg.id) {
        out.missingId++;
        continue;
      }
      if (seen.has(msg.id)) {
        out.duplicates++;
        continue;
      }
      seen.add(msg.id);

      const day = isoDayKey(row.timestamp) ?? MISSING_TS_KEY;
      if (!withinSince(day, since)) continue;

      const u = msg.usage;
      const usd = priceUsage(msg.model, u);
      out.totalUsd += usd;
      out.messages++;
      out.byDay[day] = (out.byDay[day] ?? 0) + usd;
      const key = normalizeModel(msg.model) || `?${msg.model ?? '(none)'}`;
      out.byModel[key] = (out.byModel[key] ?? 0) + usd;
      out.tokens.input += u.input_tokens || 0;
      out.tokens.output += u.output_tokens || 0;
      out.tokens.cacheRead += u.cache_read_input_tokens || 0;
      out.tokens.cacheCreate += u.cache_creation_input_tokens || 0;
      // Flag "unpriced" only when an unknown model actually billed tokens —
      // `<synthetic>` rows carry no usage and must not raise the flag.
      const billed = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0);
      if (usd === 0 && billed > 0 && msg.model && !normalizeModel(msg.model)) unpriced.add(msg.model);
    }
  }
  out.unpricedModels = [...unpriced].sort();
  return out;
}

export interface CodexReprice {
  totalUsd: number;
  byDay: Record<string, number>;
  byModel: Record<string, number>;
  files: number;
  calls: number;
  /** Rollout files (or dirs) the scan could not read, or that failed to parse. */
  errors: number;
  unpricedModels: string[];
  tokens: { input: number; cached: number; output: number };
}

/**
 * Reprice a CODEX_HOME with the RUNNER's shipped `scanCodexRollouts`.
 *
 * Calls the real function, not a copy: the cross-file `codexEventKey` dedup it
 * performs is load-bearing (a codex subagent thread spawns its own rollout that
 * replays the parent's already-billed turns; summing files independently
 * over-counted 13.7% and 19.2% on the two of thirty sampled prod sessions that
 * had forks) and is exactly the behaviour parity must measure.
 */
export function repriceCodexHome(home: string, since?: string): CodexReprice {
  // The scan memoizes by (path, size, mtime) in module state. Reset first so a
  // repeated call in one process — the test suite, or two CLI legs — cannot
  // serve a stale parse.
  __resetCodexCostMemo();
  const scan = scanCodexRollouts(home);
  const out: CodexReprice = {
    totalUsd: 0,
    byDay: {},
    byModel: {},
    files: scan.files.length,
    calls: 0,
    errors: scan.errors,
    unpricedModels: [...scan.unpricedModels].sort(),
    tokens: { input: 0, cached: 0, output: 0 },
  };
  for (const f of scan.files) {
    for (const [day, usd] of Object.entries(f.byDay)) {
      if (!withinSince(day, since)) continue;
      out.byDay[day] = (out.byDay[day] ?? 0) + usd;
      out.totalUsd += usd;
    }
    // Per-model and token attribution come from the deduped events. `byDay`
    // above stays the authority for dollars — it is the shipped code path that
    // the ledger and the cap both read.
    for (const e of f.dedupedEvents) {
      if (!withinSince(e.day === MISSING_DAY_KEY ? MISSING_TS_KEY : e.day, since)) continue;
      out.calls++;
      const key = normalizeCodexModel(e.rawModel) || `?${e.rawModel || '(none)'}`;
      out.byModel[key] = (out.byModel[key] ?? 0) + priceCodexEvent(e);
      // `input` is INCLUSIVE of `cached` on the wire; report the non-cached
      // remainder so the columns line up with ccusage's.
      out.tokens.input += Math.max(0, e.input - e.cached);
      out.tokens.cached += e.cached;
      out.tokens.output += e.output;
    }
  }
  return out;
}

/** UTC day key ('YYYY-MM-DD') of an ISO timestamp; null when unparseable. */
export function isoDayKey(ts: unknown): string | null {
  if (typeof ts !== 'string' || ts.length < 10) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * `--since` is YYYYMMDD and inclusive, matching ccusage's own flag and the
 * dashboard's `within`. An undatable row is EXCLUDED once a window is given: it
 * cannot be attributed, and ccusage will not have counted it in the window
 * either, so including it would manufacture drift.
 */
export function withinSince(day: string, since?: string): boolean {
  if (!since) return true;
  if (day === MISSING_TS_KEY || day === MISSING_DAY_KEY) return false;
  return day.replace(/-/g, '') >= since;
}

// ─────────────────────────────── the oracle ─────────────────────────────────

export interface OracleResult {
  totalUsd: number;
  byDay: Record<string, number>;
  byModel: Record<string, number>;
  /** Model ids ccusage reported tokens for but priced at $0 — it cannot see them. */
  zeroPriced: string[];
  days: number;
}

const ccusageRequire = createRequire(import.meta.url);

/**
 * Resolve `ccusage/src/cli.js` out of THIS project's node_modules. Returns null
 * when the dependency is not installed — never installs anything, never reaches
 * for the network. See the header for why npx/bunx is not an option.
 */
export function resolveCcusageCli(): string | null {
  try {
    return ccusageRequire.resolve('ccusage/src/cli.js');
  } catch {
    return null;
  }
}

function runCli(cli: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [cli, ...args],
      { timeout: 120_000, maxBuffer: 32 * 1024 * 1024, env },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`ccusage ${args.join(' ')} failed: ${err.message}\n${String(stderr).slice(0, 500)}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * ccusage prints resolver/progress noise to stdout in some environments (and
 * bunx prints "Resolving dependencies"). Take only the JSON: the first line that
 * starts an object through the end. Throwing on unparseable output is
 * deliberate — a silent `[]` here renders as $0 and is indistinguishable from a
 * genuinely idle install, which is the whole failure class this file exists for.
 */
export function parseCcusageJson(stdout: string): Record<string, unknown> {
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error(`ccusage produced no JSON object:\n${stdout.slice(0, 500)}`);
  return JSON.parse(stdout.slice(start)) as Record<string, unknown>;
}

/**
 * ccusage 19+ auto-aggregates ALL detected coding agents (Claude, Codex, Gemini)
 * regardless of CLAUDE_CONFIG_DIR, so the Claude leg must filter by model id or
 * it silently absorbs host-wide codex spend. Same predicate as
 * dashboard/server.ts's `isClaudeModel`.
 */
export function isClaudeModel(name: string): boolean {
  return /^(claude-|aws\/anthropic\/|anthropic\/)/.test(name);
}

interface CcusageBreakdown {
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  cost?: number;
}

/** Fold `ccusage daily --json` rows (Claude side) into an OracleResult. */
export function foldClaudeDaily(parsed: Record<string, unknown>): OracleResult {
  const daily = Array.isArray(parsed.daily) ? (parsed.daily as Record<string, unknown>[]) : [];
  const out: OracleResult = { totalUsd: 0, byDay: {}, byModel: {}, zeroPriced: [], days: 0 };
  const zero = new Set<string>();
  for (const raw of daily) {
    const date = ((raw.date as string) || (raw.period as string) || '').slice(0, 10);
    const breakdowns = (Array.isArray(raw.modelBreakdowns) ? raw.modelBreakdowns : []) as CcusageBreakdown[];
    if (breakdowns.length === 0) {
      // ccusage 19 dropped modelBreakdowns on some paths. Without a per-model
      // split there is no way to separate Claude from co-detected codex spend,
      // so refuse rather than compare a contaminated total.
      throw new Error(
        `ccusage daily row for ${date || '(no date)'} has no modelBreakdowns — cannot isolate the Claude slice`,
      );
    }
    let dayUsd = 0;
    for (const mb of breakdowns) {
      const name = mb.modelName || '';
      if (!isClaudeModel(name)) continue;
      const cost = mb.cost || 0;
      const tokens =
        (mb.inputTokens || 0) + (mb.outputTokens || 0) + (mb.cacheCreationTokens || 0) + (mb.cacheReadTokens || 0);
      if (cost === 0 && tokens > 0) zero.add(name);
      dayUsd += cost;
      out.byModel[name] = (out.byModel[name] ?? 0) + cost;
    }
    if (!date) continue;
    out.byDay[date] = (out.byDay[date] ?? 0) + dayUsd;
    out.totalUsd += dayUsd;
    out.days++;
  }
  out.zeroPriced = [...zero].sort();
  return out;
}

/**
 * ISO day key for a `ccusage codex` date field.
 *
 * Codex dates arrive as "Aug 01, 2026" — a CALENDAR day, with no time and no
 * zone. `new Date(str).toISOString()` (what dashboard/server.ts's
 * `normalizeCodexEntry` does) interprets that as LOCAL midnight and then shifts
 * it to UTC, so on any host east of UTC the day slides back one: in
 * Asia/Calcutta "Aug 01, 2026" becomes 2026-07-31. That is silent, and at a
 * `--since` boundary it moves a whole day of spend from one side of the window
 * to the other — manufacturing drift, or hiding it. Anchor the parse at UTC so
 * the key is the day ccusage meant, wherever the host sits.
 */
export function codexDayKey(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return '';
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  if (iso) return iso[1];
  const d = new Date(`${raw} UTC`);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Fold `ccusage codex daily --json --offline` rows into an OracleResult. */
export function foldCodexDaily(parsed: Record<string, unknown>): OracleResult {
  const daily = Array.isArray(parsed.daily) ? (parsed.daily as Record<string, unknown>[]) : [];
  const out: OracleResult = { totalUsd: 0, byDay: {}, byModel: {}, zeroPriced: [], days: 0 };
  const zero = new Set<string>();
  for (const raw of daily) {
    const date = codexDayKey(raw.date);
    const cost = (raw.costUSD as number) || 0;
    const totalTokens = (raw.totalTokens as number) || 0;
    // NOTE: `models`, not `modelsUsed` — the codex subcommand keys its per-model
    // split by an OBJECT under `models`. Reading `modelsUsed` here yields
    // undefined and silently drops the whole breakdown.
    const models = (raw.models || {}) as Record<string, Record<string, unknown>>;
    const names = Object.keys(models);
    if (cost === 0 && totalTokens > 0) for (const n of names) zero.add(n);
    for (const n of names) {
      const mTokens = (models[n].totalTokens as number) || 0;
      // ccusage codex reports one cost per DAY, not per model; allocate by
      // tokens (exact when a day used one model, which is the common case).
      out.byModel[n] = (out.byModel[n] ?? 0) + (totalTokens > 0 ? (mTokens / totalTokens) * cost : 0);
    }
    if (!date) continue;
    out.byDay[date] = (out.byDay[date] ?? 0) + cost;
    out.totalUsd += cost;
    out.days++;
  }
  out.zeroPriced = [...zero].sort();
  return out;
}

export async function ccusageClaude(configDir: string, since?: string): Promise<OracleResult> {
  const cli = resolveCcusageCli();
  if (!cli) throw new Error('ccusage is not installed in this checkout — run `pnpm install --frozen-lockfile`');
  const args = ['daily', '--json'];
  if (since) args.push('--since', since);
  // NO --offline. See the header: offline prices claude-opus-5 / claude-sonnet-5
  // at $0 with the tokens intact, which would make every comparison here a lie.
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  return foldClaudeDaily(parseCcusageJson(await runCli(cli, args, env)));
}

export async function ccusageCodex(codexHome: string, since?: string): Promise<OracleResult> {
  const cli = resolveCcusageCli();
  if (!cli) throw new Error('ccusage is not installed in this checkout — run `pnpm install --frozen-lockfile`');
  // --offline is CORRECT here: the bundled snapshot knows gpt-5.6-sol, and a
  // network-free codex oracle is the reproducible one.
  const args = ['codex', 'daily', '--json', '--offline'];
  if (since) args.push('--since', since);
  const env: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: codexHome };
  return foldCodexDaily(parseCcusageJson(await runCli(cli, args, env)));
}

// ───────────────────────────────── comparison ───────────────────────────────

export interface LegComparison {
  leg: 'claude' | 'codex';
  ours: number;
  oracle: number;
  deltaUsd: number;
  /** null when the oracle is $0 and so a ratio is undefined. */
  deltaPct: number | null;
  thresholdPct: number;
  verdict: 'ok' | 'DRIFT';
  /** Model ids the oracle reported tokens for but priced at $0. */
  oracleBlind: string[];
  notes: string[];
}

export function compareLeg(
  leg: 'claude' | 'codex',
  ours: number,
  oracle: OracleResult,
  thresholdPct: number,
): LegComparison {
  const deltaUsd = ours - oracle.totalUsd;
  const deltaPct = oracle.totalUsd !== 0 ? (deltaUsd / oracle.totalUsd) * 100 : null;
  const notes: string[] = [];
  let verdict: 'ok' | 'DRIFT' = 'ok';
  if (deltaPct === null) {
    // Oracle says $0. Only a non-trivial figure on our side is a signal; both
    // zero is a genuinely idle window.
    if (Math.abs(ours) > 0.01) {
      verdict = 'DRIFT';
      notes.push(`oracle reported $0 while we priced $${ours.toFixed(6)} — the oracle cannot see this spend at all`);
    }
  } else if (Math.abs(deltaPct) > thresholdPct) {
    verdict = 'DRIFT';
  }
  if (oracle.zeroPriced.length > 0) {
    notes.push(
      `ccusage priced these at $0 with tokens present — it cannot see them, so this leg is NOT evidence for them: ` +
        oracle.zeroPriced.join(', '),
    );
  }
  if (leg === 'codex' && verdict === 'ok' && deltaPct !== null && Math.abs(deltaPct) > 1) {
    notes.push(
      'within the codex band: ccusage applies DATE-EFFECTIVE pricing that a flat CODEX_MODEL_PRICING cannot express ' +
        '(~2% aggregate, ~12% worst single session observed). Not a regression.',
    );
  }
  return {
    leg,
    ours,
    oracle: oracle.totalUsd,
    deltaUsd,
    deltaPct,
    thresholdPct,
    verdict,
    oracleBlind: oracle.zeroPriced,
    notes,
  };
}

// ──────────────────────────────────── CLI ───────────────────────────────────

/**
 * ccusage wants the PARENT of `projects/` in CLAUDE_CONFIG_DIR (the dashboard
 * passes `<agent-group>/.claude-shared`). Accept either that or the `projects/`
 * dir itself, because both are natural things to have on the clipboard when
 * poking at a prod box, and getting it wrong yields a silent $0 from the oracle.
 */
export function resolveClaudeConfigDir(dir: string): string {
  if (path.basename(dir) === 'projects') return path.dirname(dir);
  return dir;
}

function usd(n: number): string {
  return `$${n.toFixed(6)}`;
}

function printLeg(c: LegComparison): void {
  const pct = c.deltaPct === null ? 'n/a' : `${c.deltaPct >= 0 ? '+' : ''}${c.deltaPct.toFixed(3)}%`;
  const mark = c.verdict === 'ok' ? 'ok  ' : 'DRIFT';
  console.log(
    `  [${mark}] ${c.leg.padEnd(6)} ours ${usd(c.ours).padStart(14)}   ccusage ${usd(c.oracle).padStart(14)}   ` +
      `Δ ${usd(c.deltaUsd).padStart(14)}  ${pct.padStart(9)}  (band ±${c.thresholdPct}%)`,
  );
  for (const n of c.notes) console.log(`         ↳ ${n}`);
}

interface Args {
  cmd: string;
  codexHome?: string;
  claudeDir?: string;
  since?: string;
  json: boolean;
  claudeThreshold: number;
  codexThreshold: number;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = {
    cmd: argv[0] || '',
    json: false,
    claudeThreshold: DEFAULT_THRESHOLDS.claude,
    codexThreshold: DEFAULT_THRESHOLDS.codex,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--codex-home') out.codexHome = next();
    else if (a === '--claude-dir') out.claudeDir = next();
    else if (a === '--since') out.since = next().replace(/-/g, '');
    else if (a === '--json') out.json = true;
    else if (a === '--claude-threshold') out.claudeThreshold = Number(next());
    else if (a === '--codex-threshold') out.codexThreshold = Number(next());
    else if (a === '--claude-online') {
      /* accepted and ignored: the Claude oracle is ALWAYS online — see header. */
    } else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const USAGE = `cost-parity — runner ↔ dashboard ↔ ccusage anti-drift harness (#1375)

  tsx scripts/cost-parity.ts tables
      Hermetic. Runner rate tables + normalizers vs the dashboard's copies.
      SKIPs (exit 0) when dashboard/ is not in this tree.

  tsx scripts/cost-parity.ts session [--claude-dir <dir>] [--codex-home <dir>]
                                     [--since YYYYMMDD] [--json]
                                     [--claude-threshold ${DEFAULT_THRESHOLDS.claude}] [--codex-threshold ${DEFAULT_THRESHOLDS.codex}]
      Reprice real transcripts with the runner's shipped pricing and compare to
      ccusage. --claude-dir is an agent group's .claude-shared/ (or its
      projects/); --codex-home is a session's codex/ dir.

Exit 1 on drift, or when the oracle was requested and could not be reached.`;

async function main(argv: string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    console.error(`\n${USAGE}`);
    return 2;
  }

  if (args.cmd === 'tables') {
    const r = await checkTableParity();
    if (args.json) {
      console.log(JSON.stringify(r, null, 2));
    } else if (r.status === 'skipped') {
      console.log(`SKIP table parity: ${r.reason}`);
    } else {
      console.log(`table parity: ${r.checks} checks across ${r.modules.length} dashboard module(s)`);
      for (const m of r.modules) console.log(`  · ${path.relative(REPO_ROOT, m)}`);
      for (const n of r.notes) console.log(`  note: ${n}`);
      for (const f of r.findings) console.log(`  DRIFT: ${f}`);
      console.log(
        r.status === 'ok' ? '  [ok] runner and dashboard agree' : `  [DRIFT] ${r.findings.length} finding(s)`,
      );
    }
    return r.status === 'drift' ? 1 : 0;
  }

  if (args.cmd === 'session') {
    if (!args.claudeDir && !args.codexHome) {
      console.error('session needs at least one of --claude-dir / --codex-home\n');
      console.error(USAGE);
      return 2;
    }
    const comparisons: LegComparison[] = [];
    const details: Record<string, unknown> = {};
    let failed = false;

    if (args.claudeDir) {
      const walkRoot = args.claudeDir;
      const configDir = resolveClaudeConfigDir(args.claudeDir);
      const ours = repriceClaudeTranscripts(walkRoot, args.since);
      details.claude = { ...ours, configDir };
      try {
        const oracle = await ccusageClaude(configDir, args.since);
        details.claudeOracle = oracle;
        const c = compareLeg('claude', ours.totalUsd, oracle, args.claudeThreshold);
        if (ours.missingId > 0) {
          c.notes.push(
            `${ours.missingId} usage row(s) had no message.id and were NOT charged (undedupable) — our figure is a floor`,
          );
        }
        if (ours.unpricedModels.length > 0) {
          c.notes.push(`the RUNNER cannot price: ${ours.unpricedModels.join(', ')} — cost cap blind to these`);
        }
        comparisons.push(c);
      } catch (err) {
        failed = true;
        console.error(`claude oracle unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (args.codexHome) {
      const ours = repriceCodexHome(args.codexHome, args.since);
      details.codex = ours;
      try {
        const oracle = await ccusageCodex(args.codexHome, args.since);
        details.codexOracle = oracle;
        const c = compareLeg('codex', ours.totalUsd, oracle, args.codexThreshold);
        if (ours.errors > 0) {
          c.notes.push(`${ours.errors} unreadable/corrupt rollout file(s) — this scan is NOT authoritative`);
        }
        if (ours.unpricedModels.length > 0) {
          c.notes.push(
            `priced at DEFAULT_CODEX_RATE (unknown to the table): ${ours.unpricedModels.join(', ')} — ` +
              'a cheap model billed at the $5/$30 default is overcharged up to 25x',
          );
        }
        comparisons.push(c);
      } catch (err) {
        failed = true;
        console.error(`codex oracle unavailable: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (args.json) {
      console.log(JSON.stringify({ comparisons, details }, null, 2));
    } else {
      console.log(`cost parity vs ccusage${args.since ? ` (since ${args.since})` : ''}:`);
      for (const c of comparisons) printLeg(c);
      if (comparisons.length === 0) console.log('  (nothing compared)');
    }
    return failed || comparisons.some((c) => c.verdict === 'DRIFT') ? 1 : 0;
  }

  console.error(USAGE);
  return 2;
}

// Only run when invoked directly — the vitest suite imports this module.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      console.error(err instanceof Error ? err.stack : String(err));
      process.exitCode = 1;
    },
  );
}
