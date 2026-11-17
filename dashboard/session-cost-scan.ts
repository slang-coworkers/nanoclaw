/**
 * Per-session cost scan for the Sessions tab: the transcript walk, the codex
 * rollout walk and the runner's cost ledger, folded into one cost map per day
 * window, plus the files that publish it (`cost-thresholds.json` and the
 * warm-start per-file cache).
 *
 * We keep this out of server.ts so that two callers share one implementation.
 * The cost worker (cost-worker.ts) runs `computeSessionCostSnapshot` every 60s
 * on its own thread, because the scan does synchronous file and SQLite reads
 * across every session directory, and on the dashboard's event loop those reads
 * stalled every request for seconds at a time (prod 2026-11-17: /api/health up
 * to 15s, `ncl cost-cap sessions` timing out at 10s). The main thread keeps
 * using the same scanners for on-demand reads, such as `computeCostHistoryByGroup`.
 * Pricing and folding stay in session-costs.ts, codex-costs.ts and
 * session-ledger-cost.ts.
 */
import { createHash } from 'crypto';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';

import { dayKeyInTimezone } from '../src/timezone.js';
import {
  codexUsageKey,
  codexUsageTokens,
  normalizeCodexModel,
  parseCodexRollout,
  priceCodexUsage,
} from './codex-costs.js';
import {
  MODEL_PRICING,
  normalizeModel,
  priceUsage,
  resolveSdkSessionId,
  type SessionCostEntry,
  type TokenUsage,
} from './session-costs.js';
import { getSessionLedgerCost, pruneLedgerCache, type SessionLedgerCost } from './session-ledger-cost.js';

/** Wall time of each part of one `computeSessionCostSnapshot` pass, and the work it covered. */
export interface SessionCostPhases {
  /** Ledger pre-pass: list every session dir and read each changed outbound.db ledger. */
  ledgerMs: number;
  /** Transcript and codex rollout walks, and folding every source into the period maps. */
  scanMs: number;
  /** Pruning the per-file caches of paths that no longer exist. */
  pruneMs: number;
  /** Writing cost-thresholds.json and the per-file cache; 0 until the caller writes them. */
  writeMs: number;
  /** ledgerMs + scanMs + pruneMs (the compute pass, without the writes). */
  totalMs: number;
  /** Session outbound.db files seen. */
  sessions: number;
  /** Sessions priced from an exact ledger. */
  ledgerSessions: number;
  /** Claude transcripts touched within the widest window. */
  transcriptFiles: number;
}

/** An empty cost map for every period. */
export function emptySessionCostByPeriod(): SessionCostByPeriod {
  return { '1d': new Map(), '7d': new Map(), '30d': new Map(), all: new Map() };
}

// Period windows for the Context column — the SAME day-based windows the cost
// columns use (see the ccusage refresh + `within` at the cost path). 'all' = no
// filter. Keeping the cutoffs identical (via ccusageSinceDate) means the two
// columns agree on window boundaries by construction.
export type ContextPeriod = '1d' | '7d' | '30d' | 'all';
export const CONTEXT_PERIODS: ContextPeriod[] = ['1d', '7d', '30d', 'all'];
// Signal with no/invalid timestamp buckets here — never passes `>=` a real
// YYYYMMDD cutoff, so it lands only in 'all'.
export const MISSING_TS_KEY = '00000000';

// "2026-07-10T19:20:34.405Z" -> "20260710". Matches the cost columns' YYYYMMDD
// format; ISO YYYY-MM-DD is fixed-width big-endian, so lexical `>=` == numeric.
// No Date parsing.
export function isoDayKey(ts: unknown): string | null {
  if (typeof ts !== 'string' || ts.length < 10) return null;
  return ts.slice(0, 10).replace(/-/g, '');
}

export function ccusageSinceDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// ---------- JSONL discovery (projects + skill transcripts) ----------
export function collectClaudeJsonlFiles(claudeSharedDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl')) files.push(full);
      }
    } catch {
      /* skip */
    }
  };
  const projectsDir = join(claudeSharedDir, 'projects');
  if (existsSync(projectsDir)) walk(projectsDir);
  const skillsDir = join(claudeSharedDir, 'skills');
  try {
    for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      const txDir = join(skillsDir, skill.name, 'transcripts');
      if (existsSync(txDir)) walk(txDir);
    }
  } catch {
    /* skills dir may not exist */
  }
  return files;
}

// ---------- Per-session cost (Sessions tab cost column) ----------
//
// ccusage is per-group-per-day, so a per-SESSION figure is summed from the raw
// per-message `usage` in each transcript, priced by session-costs.ts (LiteLLM
// rates, via fallbackPricing). One transcript file under
// `.claude-shared/projects/` is one SDK session (its basename is the SDK uuid),
// mapped to the nanoclaw session id via sdk_session_routes so a row can link.
//
// Mirrors the context refresh: mtime-keyed per-file cache, 60s cycle, file cap.

export interface PerFileCost {
  mtimeMs: number;
  // YYYYMMDD -> { cost, tokens } for that day; summed per period at refresh.
  days: Map<string, { cost: number; tokens: number }>;
  unpriced: boolean; // saw usage from a model MODEL_PRICING doesn't know
  hadSignal: boolean;
  // Read + parse finished without throwing. A transient read failure leaves this
  // false; persistPerFileCostCache skips such entries so a one-off error never
  // freezes a file at $0 across restarts (in-memory only — not persisted).
  ok: boolean;
}
export const perFileCostCache = new Map<string, PerFileCost>();
// Historical non-UTC queries need their own day assignment without changing the
// persisted UTC cache that backs the dashboard's regular cost views.
const zonedPerFileCostCache = new Map<string, PerFileCost>();

export function scanFileCost(path: string, mtimeMs: number, timezone = 'UTC'): PerFileCost {
  const cache = timezone === 'UTC' ? perFileCostCache : zonedPerFileCostCache;
  const cacheKey = timezone === 'UTC' ? path : `${timezone}\0${path}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.mtimeMs === mtimeMs) return cached;
  const out: PerFileCost = { mtimeMs, days: new Map(), unpriced: false, hadSignal: false, ok: false };
  // Dedupe by message id. A transcript replays the SAME assistant message on
  // multiple rows when a session is resumed/rewound — each carries an identical
  // `message.id` but a distinct top-level `uuid`. Counting every row double- to
  // triple-counts cost (measured 1.7–2.2x on prod); ccusage dedupes by message
  // id, so we do too, keeping this column reconciled with the group totals the
  // Overview reads. requestId is null on Bedrock, so message.id alone is the key.
  const seenMsgIds = new Set<string>();
  try {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      if (line.indexOf('"usage"') < 0) continue;
      let r: {
        type?: string;
        timestamp?: string;
        message?: { id?: string; usage?: TokenUsage; model?: string };
      };
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const msg = r.message;
      if (r.type !== 'assistant' || !msg?.usage) continue;
      if (msg.id) {
        if (seenMsgIds.has(msg.id)) continue;
        seenMsgIds.add(msg.id);
      }
      const cost = priceUsage(msg.model, msg.usage);
      const u = msg.usage;
      const tokens =
        (u.input_tokens || 0) +
        (u.output_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0);
      out.hadSignal = true;
      // Flag "unpriced" only when an unknown model actually billed tokens. Zero-usage
      // synthetic rows (model "<synthetic>") carry no cost and must not raise the `*`.
      if (cost === 0 && tokens > 0 && msg.model && !normalizeModel(msg.model)) out.unpriced = true;
      const key =
        (timezone === 'UTC' ? isoDayKey(r.timestamp) : dayKeyInTimezone(r.timestamp || '', timezone)) ?? MISSING_TS_KEY;
      const d = out.days.get(key) || { cost: 0, tokens: 0 };
      d.cost += cost;
      d.tokens += tokens;
      out.days.set(key, d);
    }
    // Full read + parse completed without throwing — this entry is durable and
    // safe to persist. A read that throws (catch below) leaves ok=false so
    // persistPerFileCostCache skips it, rather than freezing a transient failure
    // as a $0 file across restarts.
    out.ok = true;
  } catch {
    /* unreadable — treat as no signal (ok stays false: transient, don't persist) */
  }
  cache.set(cacheKey, out);
  return out;
}

// ---------- Per-session CODEX cost (the other half of the cost column) ----------
//
// `codex-critique` calls `mcp__codex__codex` as a plain MCP tool, so its spend
// never lands in a Claude transcript and the walk above cannot see it (issue
// #1327). Codex writes its own rollouts under the SESSION's own directory —
// `<sessionDir>/codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (src/providers/codex.ts
// mounts `<sessionDir>/codex` as the container's CODEX_HOME) — so unlike the
// Claude side there is no `sdk_session_routes` hop: the path IS the attribution.
//
// TWO cache layers, because the two costs are different:
//
//   - PER FILE (`codexFileEventCache`): the expensive part is reading + parsing.
//     Rollouts are big (1.5GB fleet-wide on prod, 20MB in the worst single
//     session) and a live session appends to ONE of its files while the rest are
//     immutable. Keyed by path+mtime+size so an append re-parses only that file.
//   - PER SESSION (`codexSessionCostCache`): the dedupe that keeps this
//     reconciled with ccusage is inherently cross-file (a codex subagent thread
//     spawn replays its parent's already-billed turns into its own rollout — see
//     codex-costs.ts), so the day buckets can only be finalized once per session.
//     Keyed by a signature over the whole rollout set.
//
// Without the per-file layer, one append to a 20MB session would re-read and
// re-parse all 20MB synchronously, on the event loop, every 60s tick.
//
// Deliberately NOT persisted across restarts (unlike perFileCostCache). A cold
// start re-reads the rollouts once; there is no equivalent of the Claude side's
// warm-start snapshot here yet. Revisit if cold-start latency becomes visible.

/**
 * One rollout file's billable readings, in a compact parallel-array form.
 *
 * Compact on purpose: ~5400 files x ~50 readings fleet-wide is ~270k events, and
 * an array of objects per event would cost several hundred MB in a process that
 * runs for weeks. `dayKeys`/`models` hold few distinct values each, so V8 shares
 * the strings; `usage` is a flat triple stream.
 */
interface CodexFileEvents {
  mtimeMs: number;
  size: number;
  /** `YYYYMMDD` per event (from the event's own timestamp), '' when absent. */
  dayKeys: string[];
  /** Full ISO timestamp per event, '' when absent, for non-UTC historical bucketing. */
  timestamps: string[];
  /** Wire model id per event, '' when the rollout never declared one. */
  models: string[];
  /** 3 numbers per event: input_tokens, cached_input_tokens, output_tokens. */
  usage: number[];
  /** Read + parse completed. A false here is never cached — see scanSessionCodexCost. */
  ok: boolean;
}
const codexFileEventCache = new Map<string, CodexFileEvents>();

export interface CodexSessionCost {
  /** Signature of the session's rollout set: recompute only when this changes. */
  sig: string;
  /** YYYYMMDD -> { cost, tokens }, from each event's OWN timestamp (ccusage's day attribution). */
  days: Map<string, { cost: number; tokens: number }>;
  unpriced: boolean;
  hadSignal: boolean;
  lastActiveMs: number;
  /** Every file read+parsed cleanly. A partial scan is never cached. */
  ok: boolean;
  /** The rollout paths this entry covers — the caller's prune list for codexFileEventCache. */
  files: string[];
}
const codexSessionCostCache = new Map<string, CodexSessionCost>();

/**
 * `rollout-*.jsonl` under a CODEX_HOME, with mtime + size.
 *
 * Covers BOTH `sessions/` and `archived_sessions/` — ccusage reads both, so
 * skipping the archive would silently drop a thread from this column while it
 * still counted toward the Overview total. (No install in the current fleet has
 * archived anything yet; this is here so that stays true when one does.)
 */
function listCodexRollouts(codexHome: string): { f: string; m: number; s: number }[] {
  const out: { f: string; m: number; s: number }[] = [];
  for (const bucket of ['sessions', 'archived_sessions']) {
    const root = join(codexHome, bucket);
    // Depth-bounded walk: <bucket>/<year>/<month>/<day>/rollout-*.jsonl. A plain
    // recursive walk would also descend into anything else codex parks in there.
    let years: string[];
    try {
      years = readdirSync(root);
    } catch {
      continue; // no such bucket for this session — by far the common case
    }
    for (const y of years) {
      let months: string[];
      try {
        months = readdirSync(join(root, y));
      } catch {
        continue;
      }
      for (const mo of months) {
        let days: string[];
        try {
          days = readdirSync(join(root, y, mo));
        } catch {
          continue;
        }
        for (const d of days) {
          const dir = join(root, y, mo, d);
          let names: string[];
          try {
            names = readdirSync(dir);
          } catch {
            continue;
          }
          for (const n of names) {
            if (!n.startsWith('rollout-') || !n.endsWith('.jsonl')) continue;
            const f = join(dir, n);
            let m = 0;
            let s = 0;
            try {
              const st = statSync(f);
              m = st.mtimeMs;
              s = st.size;
            } catch {
              /* unreadable — treat as oldest/empty */
            }
            out.push({ f, m, s });
          }
        }
      }
    }
  }
  // Path order is chronological (the timestamp is in the filename), which is the
  // order the cross-file dedupe below depends on: a fork is always created after
  // the parent it replays, so the surviving copy of a duplicated call is the
  // parent's. `sessions` before `archived_sessions` for the same reason.
  out.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  return out;
}

/** Parsed readings for one rollout file, from cache when path+mtime+size are unchanged. */
function readCodexFileEvents(f: string, m: number, s: number): CodexFileEvents {
  const cached = codexFileEventCache.get(f);
  if (cached && cached.mtimeMs === m && cached.size === s) return cached;
  const out: CodexFileEvents = { mtimeMs: m, size: s, dayKeys: [], timestamps: [], models: [], usage: [], ok: false };
  try {
    for (const ev of parseCodexRollout(readFileSync(f, 'utf-8'))) {
      out.dayKeys.push(ev.dayKey ?? '');
      out.timestamps.push(ev.timestamp ?? '');
      out.models.push(ev.model);
      out.usage.push(ev.usage.input_tokens || 0, ev.usage.cached_input_tokens || 0, ev.usage.output_tokens || 0);
    }
    out.ok = true;
  } catch {
    /* unreadable — leave ok=false so the caller refuses to cache a partial session */
  }
  // A failed read is still cached, but only against THIS mtime+size; the session
  // above it is what refuses to cache, so the next tick retries the whole thing.
  if (out.ok) codexFileEventCache.set(f, out);
  return out;
}

/**
 * Priced codex spend for one session, bucketed by day.
 *
 * Dedupes calls across the session's rollout files by their usage tuple — the
 * key ccusage uses, and the reason a forked subagent rollout's replayed prefix
 * is not billed twice. See codex-costs.ts for the measurement behind that choice
 * and its known limitation.
 */
export function scanSessionCodexCost(codexHome: string, timezone = 'UTC'): CodexSessionCost {
  const files = listCodexRollouts(codexHome);
  const cacheKey = timezone === 'UTC' ? codexHome : `${timezone}\0${codexHome}`;
  const empty: CodexSessionCost = {
    sig: '',
    days: new Map(),
    unpriced: false,
    hadSignal: false,
    lastActiveMs: 0,
    ok: true,
    files: [],
  };
  // No rollouts: the overwhelmingly common case (most sessions never call codex).
  // Return without touching the cache so we don't hold an entry per session.
  if (files.length === 0) {
    codexSessionCostCache.delete(cacheKey);
    return empty;
  }
  const sig = createHash('sha1')
    .update(files.map((x) => `${x.f}:${x.m}:${x.s}`).join('\n'))
    .digest('hex')
    .slice(0, 16);
  const cached = codexSessionCostCache.get(cacheKey);
  if (cached && cached.sig === sig) return cached;

  const out: CodexSessionCost = {
    sig,
    days: new Map(),
    unpriced: false,
    hadSignal: false,
    lastActiveMs: 0,
    ok: true,
    files: files.map((x) => x.f),
  };
  const seen = new Set<string>();
  for (const { f, m, s } of files) {
    const fe = readCodexFileEvents(f, m, s);
    if (!fe.ok) {
      out.ok = false;
      continue;
    }
    if (m > out.lastActiveMs) out.lastActiveMs = m;
    for (let i = 0; i < fe.dayKeys.length; i++) {
      const model = fe.models[i];
      const usage = {
        input_tokens: fe.usage[i * 3],
        cached_input_tokens: fe.usage[i * 3 + 1],
        output_tokens: fe.usage[i * 3 + 2],
      };
      const key = codexUsageKey(model, usage);
      if (seen.has(key)) continue;
      seen.add(key);
      const cost = priceCodexUsage(model, usage);
      const tokens = codexUsageTokens(usage);
      out.hadSignal = true;
      // Raise the `*` whenever tokens were billed but we could not price them —
      // including when the rollout never declared a model at all. (The Claude
      // side can require a model here because a `<synthetic>` row genuinely
      // carries no cost; a model-less codex reading is real spend we can't name.)
      if (cost === 0 && tokens > 0 && !normalizeCodexModel(model)) out.unpriced = true;
      const dayKey =
        (timezone === 'UTC' ? fe.dayKeys[i] : dayKeyInTimezone(fe.timestamps[i], timezone)) || MISSING_TS_KEY;
      const d = out.days.get(dayKey) || { cost: 0, tokens: 0 };
      d.cost += cost;
      d.tokens += tokens;
      out.days.set(dayKey, d);
    }
  }
  // A session with an unreadable file is NOT cached: caching it would freeze a
  // transient EMFILE/EACCES as a permanently-undercounted session until some
  // file's mtime happened to change.
  if (out.ok) codexSessionCostCache.set(cacheKey, out);
  else codexSessionCostCache.delete(cacheKey);
  return out;
}

// nanoclaw session id -> cost row, per period. Endpoint joins this onto the
// /api/sessions rows; the ranked arrays back an optional sort=cost.
export type SessionCostByPeriod = Record<ContextPeriod, Map<string, SessionCostEntry>>;

/**
 * Compute every period's per-session cost map from scratch, reusing the
 * module's mtime-gated per-file caches, and return it with per-phase timings.
 *
 * The cost worker (cost-worker.ts) runs this every 60s off the dashboard's event
 * loop; `refreshSessionCostsForTests` runs it in-process for tests. It writes no
 * file: the caller publishes `cost-thresholds.json` and the warm-start cache.
 * `prev` is the snapshot the caller currently serves; a session whose ledger
 * could not be read this pass keeps its entries from `prev` (see carrySessions).
 * A database error propagates, so the caller can report it and keep serving the
 * last good snapshot.
 */
export function computeSessionCostSnapshot(
  db: Database.Database,
  dataDir: string,
  prev: SessionCostByPeriod,
): { byPeriod: SessionCostByPeriod; phases: SessionCostPhases } {
  const t0 = Date.now();
  {
    const groups = db.prepare('SELECT id, folder, name FROM agent_groups').all() as {
      id: string;
      folder: string;
      name: string;
    }[];
    // SDK uuid -> nanoclaw session id (for the link). Newest route wins.
    const sdkToNano = new Map<string, string>();
    try {
      for (const r of db.prepare('SELECT sdk_session_id, nanoclaw_session_id FROM sdk_session_routes').all() as {
        sdk_session_id: string;
        nanoclaw_session_id: string;
      }[]) {
        if (r.sdk_session_id && r.nanoclaw_session_id) sdkToNano.set(r.sdk_session_id, r.nanoclaw_session_id);
      }
    } catch {
      /* table may not exist on older installs — links just fall back to '' */
    }

    const cutoffs: Record<ContextPeriod, string> = {
      '1d': ccusageSinceDate(0),
      '7d': ccusageSinceDate(7),
      '30d': ccusageSinceDate(30),
      all: '',
    };
    const next: SessionCostByPeriod = { '1d': new Map(), '7d': new Map(), '30d': new Map(), all: new Map() };
    const sessionsDir = join(dataDir, 'v2-sessions');
    // Widest period this cache serves is 30d; only scan files touched within it
    // (+1d slack). A file older than that has no rows in any served window.
    const cutoffMs = Date.now() - 31 * 86400 * 1000;
    const livePaths = new Set<string>();
    const liveCodexHomes = new Set<string>();
    const liveCodexFiles = new Set<string>();
    const liveLedgerPaths = new Set<string>();

    // Ledger pre-pass. A session whose outbound.db `cost_events` is EXACT —
    // every row written by the exact-accounting runner (#2013; see
    // session-ledger-cost.ts isExactRow) — is priced ONLY from that ledger:
    // transcript rotation deletes large/old transcripts, so the walk below
    // under-reports long sessions. The source is chosen per SESSION (not per
    // period) and its transcripts + codex rollouts are then skipped entirely, so
    // a session's cost is never ledger + transcript. Sessions with no ledger rows
    // or with ANY pre-#2013 row (which kept ~1% of output tokens) keep the
    // transcript/rollout pricing below, exactly as before.
    const ledgerBySession = new Map<string, SessionLedgerCost & { mtimeMs: number }>();
    // Sessions whose outbound.db could not be read this tick (e.g. the runner
    // held the write lock) and that already have a published figure: the
    // source is unknown, so keep last tick's entries rather than silently
    // falling back to the (possibly rotated) transcript. With no previous
    // figure, the transcript fallback below applies as for any non-ledger session.
    const carrySessions = new Set<string>();
    const sessDirsByGroup = new Map<string, string[] | null>();
    for (const group of groups) {
      let dirs: string[] | null;
      try {
        dirs = readdirSync(join(sessionsDir, group.id)).filter((d) => d.startsWith('sess-'));
      } catch {
        dirs = null; // group has no session dir yet
      }
      sessDirsByGroup.set(group.id, dirs);
      for (const sessId of dirs ?? []) {
        const outPath = join(sessionsDir, group.id, sessId, 'outbound.db');
        liveLedgerPaths.add(outPath);
        const lc = getSessionLedgerCost(outPath);
        if (lc.hasRows && lc.exact) ledgerBySession.set(sessId, lc);
        else if (!lc.ok && prev.all.has(sessId)) carrySessions.add(sessId);
      }
    }

    const tLedger = Date.now();
    for (const group of groups) {
      const claudeShared = join(sessionsDir, group.id, '.claude-shared');
      // Sessions only — `projects/<sdk-uuid>.jsonl`. collectClaudeJsonlFiles
      // also returns `skills/…` transcripts, whose basename is not an SDK
      // session id (so they'd never map to a nanoclaw session) and which are
      // skill runs, not sessions. Excluding them keeps the tab to real sessions
      // and matches the reconciliation (projects-only) against ccusage.
      const files = collectClaudeJsonlFiles(claudeShared).filter((f) => f.includes('/projects/'));
      // NOTE: no `continue` when this is empty. A group whose provider is codex
      // (or whose only spend is codex-critique tool calls) has no Claude
      // transcripts at all, and skipping it here would skip the codex walk below
      // too — which is exactly the hole issue #1327 is closing.
      //
      // Accurate over the whole 30d window: scan EVERY file touched in the last
      // ~31d, no count cap. The old 400-file cap truncated the busiest groups
      // (main/fixer/triager each have ~1000 files/30d), undercounting the 30d
      // total ~2x. The per-file mtime cache keeps steady state cheap — only the
      // cold scan reads them all.
      const chosen = files
        .map((f) => {
          try {
            return { f, m: statSync(f).mtimeMs };
          } catch {
            return { f, m: 0 };
          }
        })
        .filter((x) => x.m >= cutoffMs);

      for (const { f, m } of chosen) {
        livePaths.add(f);
        const fc = scanFileCost(f, m);
        if (!fc.hadSignal) continue;
        const sdkId = resolveSdkSessionId(f);
        const nanoId = sdkToNano.get(sdkId) || '';
        // Ledger-priced session: its cost comes from cost_events below, never
        // from this transcript too (no double count).
        if (nanoId && (ledgerBySession.has(nanoId) || carrySessions.has(nanoId))) continue;
        for (const period of CONTEXT_PERIODS) {
          const since = cutoffs[period];
          let cost = 0;
          let tokens = 0;
          let inWindow = false;
          for (const [key, d] of fc.days) {
            if (period !== 'all' && !(key >= since)) continue;
            inWindow = true;
            cost += d.cost;
            tokens += d.tokens;
          }
          if (!inWindow) continue;
          // Merge onto the nanoclaw session (a session can span multiple SDK
          // sub-sessions/files); unmapped files bucket under their SDK id so
          // their cost is still counted, just without a working link.
          const mapKey = nanoId || sdkId;
          const bucket = next[period];
          const prev = bucket.get(mapKey);
          if (prev) {
            prev.cost += cost;
            prev.claudeUsd += cost;
            prev.tokens += tokens;
            prev.lastActiveMs = Math.max(prev.lastActiveMs, m);
            prev.unpriced = prev.unpriced || fc.unpriced;
          } else {
            bucket.set(mapKey, {
              sessionId: nanoId,
              sdkSessionId: sdkId,
              groupFolder: group.folder,
              groupName: group.name,
              cost,
              claudeUsd: cost,
              codexUsd: 0,
              openUsd: 0,
              tokens,
              lastActiveMs: m,
              unpriced: fc.unpriced,
              costSource: 'transcript',
            });
          }
        }
      }

      // Codex half. Keyed by the nanoclaw session id straight off the path, so
      // it merges onto the Claude row for the same session when there is one and
      // stands up its own row when there isn't — a session that ONLY ever called
      // `mcp__codex__codex` used to report a confident $0 (issue #1327).
      const sessDirs = sessDirsByGroup.get(group.id);
      if (!sessDirs) continue; // group has no session dir yet
      for (const sessId of sessDirs) {
        if (carrySessions.has(sessId)) {
          for (const period of CONTEXT_PERIODS) {
            const carried = prev[period].get(sessId);
            if (carried) next[period].set(sessId, { ...carried });
          }
          continue;
        }
        const ledger = ledgerBySession.get(sessId);
        if (ledger) {
          // Ledger session: both halves (Claude + codex) come from cost_events;
          // the rollout walk is skipped so codex is not counted twice. Same 31d
          // file-mtime bound as the transcript/rollout walks (outbound.db mtime).
          if (ledger.mtimeMs < cutoffMs) continue;
          for (const period of CONTEXT_PERIODS) {
            const since = cutoffs[period];
            let cost = 0;
            let claudeUsd = 0;
            let codexUsd = 0;
            let openUsd = 0;
            let tokens = 0;
            let inWindow = false;
            for (const [key, d] of ledger.days) {
              if (period !== 'all' && !(key >= since)) continue;
              inWindow = true;
              cost += d.cost;
              claudeUsd += d.claudeUsd;
              codexUsd += d.codexUsd;
              openUsd += d.openUsd ?? 0;
              tokens += d.tokens;
            }
            if (!inWindow) continue;
            // Fresh row: the transcript walk skipped this session, so nothing
            // else is keyed by sessId (unmapped transcripts key by SDK uuid).
            next[period].set(sessId, {
              sessionId: sessId,
              sdkSessionId: '',
              groupFolder: group.folder,
              groupName: group.name,
              cost,
              claudeUsd,
              codexUsd,
              openUsd,
              tokens,
              lastActiveMs: ledger.mtimeMs,
              unpriced: ledger.unpriced,
              costSource: 'ledger',
            });
          }
          continue;
        }
        const codexHome = join(sessionsDir, group.id, sessId, 'codex');
        liveCodexHomes.add(codexHome);
        const cc = scanSessionCodexCost(codexHome);
        for (const f of cc.files) liveCodexFiles.add(f);
        if (!cc.hadSignal) continue;
        // Same 31d file-mtime bound the Claude walk above applies to its
        // transcripts, deliberately: both halves of `cost` are then scoped
        // identically, so `all` means the same thing on either side of the sum.
        // (It means "everything in files touched in the last ~31d", not
        // "everything ever" — a pre-existing property of this cache, not a new
        // one, but worth naming since a codex session can be long-lived.)
        if (cc.lastActiveMs < cutoffMs) continue;
        for (const period of CONTEXT_PERIODS) {
          const since = cutoffs[period];
          let cost = 0;
          let tokens = 0;
          let inWindow = false;
          for (const [key, d] of cc.days) {
            if (period !== 'all' && !(key >= since)) continue;
            inWindow = true;
            cost += d.cost;
            tokens += d.tokens;
          }
          if (!inWindow) continue;
          const bucket = next[period];
          const prev = bucket.get(sessId);
          if (prev) {
            prev.cost += cost;
            prev.codexUsd += cost;
            prev.tokens += tokens;
            prev.lastActiveMs = Math.max(prev.lastActiveMs, cc.lastActiveMs);
            prev.unpriced = prev.unpriced || cc.unpriced;
          } else {
            bucket.set(sessId, {
              sessionId: sessId,
              sdkSessionId: '',
              groupFolder: group.folder,
              groupName: group.name,
              cost,
              claudeUsd: 0,
              codexUsd: cost,
              openUsd: 0,
              tokens,
              lastActiveMs: cc.lastActiveMs,
              unpriced: cc.unpriced,
              costSource: 'transcript',
            });
          }
        }
      }
    }
    const tScan = Date.now();
    if (perFileCostCache.size > livePaths.size * 2 + 1000) {
      for (const k of perFileCostCache.keys()) if (!livePaths.has(k)) perFileCostCache.delete(k);
    }
    // Same prune shape for both codex caches — sessions and rollout files that
    // no longer exist on disk (deleted sessions) must not pin memory.
    if (codexSessionCostCache.size > liveCodexHomes.size + 100) {
      for (const k of codexSessionCostCache.keys()) if (!liveCodexHomes.has(k)) codexSessionCostCache.delete(k);
    }
    if (codexFileEventCache.size > liveCodexFiles.size * 2 + 1000) {
      for (const k of codexFileEventCache.keys()) if (!liveCodexFiles.has(k)) codexFileEventCache.delete(k);
    }
    pruneLedgerCache(liveLedgerPaths);
    const tEnd = Date.now();
    return {
      byPeriod: next,
      phases: {
        ledgerMs: tLedger - t0,
        scanMs: tScan - tLedger,
        pruneMs: tEnd - tScan,
        writeMs: 0,
        totalMs: tEnd - t0,
        sessions: liveLedgerPaths.size,
        ledgerSessions: ledgerBySession.size,
        transcriptFiles: livePaths.size,
      },
    };
  }
}

/**
 * Publish `data/cost-thresholds.json` — the p90 of priced per-session cost over
 * a trailing window — so the runner can seed each new per-run cost cap from the
 * fleet's recent spend distribution. Shared contract (dashboard WRITES, host
 * READS): { p90Usd, period, sampleSize, computedAt }.
 *
 * Prefer the 7d window (responsive to recent spend); fall back to 30d when 7d
 * has no priced sessions yet. Percentile method matches the Sessions-tab pctl
 * (sort asc; index = floor(0.9*(n-1))). Written atomically (tmp + rename) and
 * fail-soft — the file is advisory, so any error just skips this cycle.
 */
export function writeCostThresholdFile(dataDir: string, byPeriod: SessionCostByPeriod): void {
  try {
    let period: ContextPeriod = '30d';
    let entries: SessionCostEntry[] = [];
    for (const p of ['7d', '30d'] as ContextPeriod[]) {
      const priced = [...byPeriod[p].values()].filter((e) => e.cost > 0);
      if (priced.length) {
        period = p;
        entries = priced;
        break;
      }
    }
    if (entries.length === 0) return;

    // p90 of a cost array — sort asc, index = floor(0.9*(n-1)). Matches the
    // Sessions-tab pctl and the host's resolveCostCapT2Usd read contract.
    const p90Of = (arr: number[]): number => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(0.9 * (s.length - 1)))];
    };

    // Per-group p90 over each group's OWN priced sessions — the Tier-1 cap the
    // host prefers over the fleet number. A fleet p90 is dragged down by the many
    // cheap orchestrator/reviewer sessions (so it under-serves fixer) and can't
    // over-cap a reviewer at once. Only groups with a real sample get an entry;
    // the host falls back to the fleet p90 for smaller/newer groups.
    const MIN_GROUP_SAMPLE = 10;
    const byGroup = new Map<string, number[]>();
    for (const e of entries) {
      if (!e.groupFolder) continue;
      (byGroup.get(e.groupFolder) ?? byGroup.set(e.groupFolder, []).get(e.groupFolder)!).push(e.cost);
    }
    const perGroupP90Usd: Record<string, number> = {};
    for (const [folder, arr] of byGroup) {
      if (arr.length >= MIN_GROUP_SAMPLE) perGroupP90Usd[folder] = p90Of(arr);
    }

    const payload =
      JSON.stringify({
        p90Usd: p90Of(entries.map((e) => e.cost)),
        perGroupP90Usd,
        period,
        sampleSize: entries.length,
        computedAt: new Date().toISOString(),
      }) + '\n';
    const outPath = join(dataDir, 'cost-thresholds.json');
    const tmpPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, payload);
    renameSync(tmpPath, outPath);
  } catch {
    /* fail-soft: threshold file is advisory */
  }
}

// ---------- Warm-start persistence for the per-file cost cache ----------
//
// A cold start otherwise re-parses EVERY per-session transcript (thousands of
// files on a large install) before the Sessions cost column populates. The
// in-memory `perFileCostCache` is lost on restart, so this snapshots it to disk
// after each refresh and reloads it on startup. Because entries are mtime-keyed,
// the next scan re-parses ONLY files whose mtime changed — a warm start.
//
// Fail-soft in every direction: a missing / corrupt / older-schema file falls
// back to a full cold scan and NEVER throws. This never changes computed output —
// a warm cache hit returns the same PerFileCost a fresh parse would (numbers
// round-trip through JSON exactly, and day-key insertion order is preserved), so
// percentile/threshold output is bit-identical to today; only cold-start latency
// drops.
//
// Two invalidation keys, both mandatory on load:
//   - COST_CACHE_VERSION    — bump on any PerFileCost SHAPE change.
//   - COST_MATH_FINGERPRINT — a hash of the cost MATH (the pricing table plus the
//     priceUsage / normalizeModel / scanFileCost bodies). An mtime keys a file's
//     RAW content; it cannot see a pricing or parser edit that changes the
//     COMPUTED cost of otherwise-unchanged files. Folding the math into the tag
//     means such an edit invalidates the whole persisted cache (and its derived
//     thresholds) instead of serving stale costs forever. Hashing MODEL_PRICING's
//     data is required — priceUsage closes over the table, so its .toString()
//     alone would miss a rate change.
const COST_CACHE_VERSION = 1;
const COST_MATH_FINGERPRINT = createHash('sha1')
  .update(JSON.stringify(MODEL_PRICING))
  .update('\0')
  .update(priceUsage.toString())
  .update('\0')
  .update(normalizeModel.toString())
  .update('\0')
  .update(scanFileCost.toString())
  .digest('hex')
  .slice(0, 16);
function costCachePath(dataDir: string): string {
  return join(dataDir, 'dashboard-cost-cache.json');
}

// PerFileCost.days is a Map, which JSON can't serialize directly. Carry it as an
// array of [dayKey, {cost, tokens}] pairs (preserving insertion order so summed
// floats stay bit-identical) and rebuild the Map on load. `ok` is intentionally
// NOT persisted: only ok entries are written, so a loaded entry is ok by
// construction.
interface PersistedPerFileCost {
  mtimeMs: number;
  days: Array<[string, { cost: number; tokens: number }]>;
  unpriced: boolean;
  hadSignal: boolean;
}

export function loadPerFileCostCache(dataDir: string): void {
  try {
    const p = costCachePath(dataDir);
    if (!existsSync(p)) return;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as {
      version?: number;
      fingerprint?: string;
      entries?: Array<[string, PersistedPerFileCost]>;
    };
    if (
      !parsed ||
      parsed.version !== COST_CACHE_VERSION ||
      parsed.fingerprint !== COST_MATH_FINGERPRINT ||
      !Array.isArray(parsed.entries)
    )
      return;
    for (const entry of parsed.entries) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [path, v] = entry;
      if (typeof path !== 'string' || !v || typeof v.mtimeMs !== 'number' || !Array.isArray(v.days)) continue;
      const days = new Map<string, { cost: number; tokens: number }>();
      let malformed = false;
      for (const dv of v.days) {
        if (!Array.isArray(dv) || dv.length !== 2) {
          malformed = true;
          break;
        }
        const [k, ct] = dv;
        if (typeof k !== 'string' || !ct || typeof ct.cost !== 'number' || typeof ct.tokens !== 'number') {
          malformed = true;
          break;
        }
        days.set(k, { cost: ct.cost, tokens: ct.tokens });
      }
      // A malformed day record means this entry can't be trusted as complete —
      // skip it entirely so the next scan sees a cache MISS and cold-re-parses
      // the file, rather than serving a silently-undercounted cost with a
      // still-trusted mtime.
      if (malformed) continue;
      perFileCostCache.set(path, {
        mtimeMs: v.mtimeMs,
        days,
        unpriced: v.unpriced === true,
        hadSignal: v.hadSignal === true,
        ok: true,
      });
    }
  } catch {
    /* fail-soft: a missing/corrupt/older cache just means a full cold scan */
  }
}

export function persistPerFileCostCache(dataDir: string): void {
  try {
    const entries: Array<[string, PersistedPerFileCost]> = [];
    for (const [path, v] of perFileCostCache) {
      // Skip transient/failed reads (ok=false): persisting an empty error entry
      // would suppress that file's cost across every restart until its mtime
      // changes. Only durable, successfully-parsed entries earn a warm slot.
      if (!v.ok) continue;
      entries.push([
        path,
        { mtimeMs: v.mtimeMs, days: [...v.days.entries()], unpriced: v.unpriced, hadSignal: v.hadSignal },
      ]);
    }
    const payload = JSON.stringify({ version: COST_CACHE_VERSION, fingerprint: COST_MATH_FINGERPRINT, entries });
    const outPath = costCachePath(dataDir);
    const tmpPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, payload);
    renameSync(tmpPath, outPath);
  } catch {
    /* fail-soft: the warm-start cache is advisory */
  }
}
