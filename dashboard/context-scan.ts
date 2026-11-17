/**
 * Context scans per coworker, over the Claude transcripts in each group's
 * `.claude-shared` directory:
 *   - the context window: token usage of the latest assistant turn, shown on the
 *     coworker card (coworker state `contextWindow`);
 *   - the context stats: compactions and the per-session peak-context histogram
 *     for each period, shown in the By-Coworker table (`/api/ccusage`).
 *
 * Both walk every transcript directory and stat every file. On the dashboard's
 * main thread they held the event loop for about 0.5 s every 10 s and every 60 s
 * (prod CPU profile, 2026-11-17), so they run in summary-worker.ts. The worker
 * keeps one ContextScanner, whose caches make a steady-state pass re-read only
 * transcripts that grew; tests run a ContextScanner in-process.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import {
  CONTEXT_PERIODS,
  MISSING_TS_KEY,
  ccusageSinceDate,
  collectClaudeJsonlFiles,
  isoDayKey,
  type ContextPeriod,
} from './session-cost-scan.js';

export interface ContextWindowInfo {
  contextTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  maxContext: number;
  usagePercent: number;
  cacheHitPercent: number;
  model: string;
}

export function modelMaxContext(model: string): number {
  // The 1M-context variants carry a [1m] marker in the model id
  // (e.g. bedrock-claude-opus-4-8[1m]); that suffix is the authoritative signal.
  if (model.includes('[1m]')) return 1000000;
  if (model.includes('opus-4-8')) return 1000000;
  if (model.includes('opus-4-7')) return 1000000;
  if (model.includes('opus-4-6')) return 200000;
  if (model.includes('sonnet-5')) return 200000;
  if (model.includes('sonnet-4')) return 200000;
  if (model.includes('haiku')) return 200000;
  return 200000;
}

// Distinct from the context window (which only snapshots the *latest* turn): the
// stats scan every session transcript for a group and answer "how hard is this
// coworker pushing context?" — how often it compacts, and the distribution of
// per-session peak context. Feeds the "Context" column in the By-Coworker table.
export interface ContextStats {
  sessions: number; // transcript files that had at least one usage/compaction signal
  compactions: number; // total compact_boundary events
  autoCompactions: number;
  manualCompactions: number;
  avgPreTokens: number; // mean context size (tokens) at the moment of compaction
  avgPeakContext: number; // mean per-session peak context tokens
  avgPeakPct: number; // avgPeakContext as % of model max context
  maxContext: number; // model context window used for the % scale
  histogram: number[]; // per-session peak-context% distribution, 5 buckets
  capped: boolean; // true if the transcript scan hit the per-group file cap
}

/** Per group id, one ContextStats per period; null when the group has no in-window signal for that period. */
export type ContextStatsByPeriod = Record<ContextPeriod, ContextStats | null>;

/** Work done by one context pass, published to /api/debug. */
export interface ContextPassPhases {
  groups: number;
  files: number;
  parsed: number;
  totalMs: number;
}

// Peak-context% buckets: <25, 25–50, 50–75, 75–90, 90%+. The last two are narrow
// on purpose — that's where compaction risk lives and where the signal matters.
const CONTEXT_HIST_BUCKETS = [0.25, 0.5, 0.75, 0.9, Infinity];
const MAX_CONTEXT_FILES_PER_GROUP = 400; // bound the scan on very long-lived groups
// One transcript day's worth of signal, keyed YYYYMMDD. Per-day granularity is
// exactly enough to reconstruct any of the day-based period windows without
// re-reading the (append-only, mtime-cached) file.
interface DayContextAgg {
  peak: number; // max (input + cache_read + cache_creation) across that day's assistant turns
  compactions: number;
  auto: number;
  manual: number;
  preTokensSum: number;
}
interface PerFileContext {
  mtimeMs: number;
  days: Map<string, DayContextAgg>; // YYYYMMDD -> that day's aggregate
  maxWindow: number; // max model context window seen in this file (0 if none)
  hadSignal: boolean;
}
function contextDayAgg(out: PerFileContext, key: string): DayContextAgg {
  let d = out.days.get(key);
  if (!d) {
    d = { peak: 0, compactions: 0, auto: 0, manual: 0, preTokensSum: 0 };
    out.days.set(key, d);
  }
  return d;
}

// Per-period accumulator over a group's sessions. One per ContextPeriod.
interface ContextAcc {
  peaks: number[];
  compactions: number;
  auto: number;
  manual: number;
  preTokensSum: number;
  preTokensCount: number;
  sessions: number;
}
function newContextAcc(): ContextAcc {
  return { peaks: [], compactions: 0, auto: 0, manual: 0, preTokensSum: 0, preTokensCount: 0, sessions: 0 };
}
// Fold one accumulator into a ContextStats. maxContext is passed in (fixed across
// periods) so the % scale/histogram bucketing stay comparable when toggling
// periods. Math mirrors the original single-period build. null when no sessions.
function buildContextStats(a: ContextAcc, maxContext: number, capped: boolean): ContextStats | null {
  if (a.sessions === 0) return null;
  const avgPeakContext = a.peaks.length ? a.peaks.reduce((x, y) => x + y, 0) / a.peaks.length : 0;
  const histogram = new Array(CONTEXT_HIST_BUCKETS.length).fill(0);
  for (const p of a.peaks) {
    const pct = maxContext > 0 ? p / maxContext : 0;
    const bi = CONTEXT_HIST_BUCKETS.findIndex((t) => pct < t);
    histogram[bi < 0 ? CONTEXT_HIST_BUCKETS.length - 1 : bi]++;
  }
  return {
    sessions: a.sessions,
    compactions: a.compactions,
    autoCompactions: a.auto,
    manualCompactions: a.manual,
    avgPreTokens: a.preTokensCount ? Math.round(a.preTokensSum / a.preTokensCount) : 0,
    avgPeakContext: Math.round(avgPeakContext),
    avgPeakPct: maxContext > 0 ? Math.round((avgPeakContext / maxContext) * 100) : 0,
    maxContext,
    histogram,
    capped,
  };
}

/**
 * Holds both context caches and the per-file state that keeps their passes
 * incremental. `window` is keyed by group folder and `stats` by group id, the
 * keys their readers in server.ts use.
 */
export class ContextScanner {
  /** Latest-turn context usage per group folder. A group whose transcripts disappear keeps its last reading. */
  readonly window = new Map<string, ContextWindowInfo>();
  /** Context stats per group id. */
  readonly stats = new Map<string, ContextStatsByPeriod>();
  // Which (newest-file path, mtime) produced each group's current `window`
  // entry, so an idle group whose newest transcript hasn't advanced is a single
  // stat rather than a full file re-read + reverse-scan every pass. Only the
  // group whose active transcript actually grew pays the read.
  private windowFiles = new Map<string, { path: string; mtimeMs: number }>();
  // Per-file cache keyed by path: transcripts are append-only, so a file whose
  // mtime is unchanged never needs re-parsing. Only the active session file
  // (which grows each turn) is re-read on a given cycle.
  private perFile = new Map<string, PerFileContext>();

  /** Refresh `window` from each group's newest transcript. */
  refreshWindow(central: Database.Database, dataDir: string): ContextPassPhases {
    const startedAt = Date.now();
    const groups = central.prepare('SELECT id, folder FROM agent_groups').all() as { id: string; folder: string }[];
    const phases: ContextPassPhases = { groups: groups.length, files: 0, parsed: 0, totalMs: 0 };
    const sessionsDir = join(dataDir, 'v2-sessions');
    for (const group of groups) {
      const claudeShared = join(sessionsDir, group.id, '.claude-shared');
      const jsonlFiles = collectClaudeJsonlFiles(claudeShared);
      phases.files += jsonlFiles.length;
      if (jsonlFiles.length === 0) continue;

      // Stat each candidate exactly once, then pick the single newest file.
      let newestPath = '';
      let newestMtime = -1;
      for (const f of jsonlFiles) {
        let m: number;
        try {
          m = statSync(f).mtimeMs;
        } catch {
          continue;
        }
        if (m > newestMtime) {
          newestMtime = m;
          newestPath = f;
        }
      }
      if (!newestPath) continue;

      // mtime-gate: skip the read+parse when the newest transcript is unchanged
      // since we last parsed it for this group.
      const gate = this.windowFiles.get(group.folder);
      if (gate && gate.path === newestPath && gate.mtimeMs === newestMtime) continue;

      // Read FIRST, commit the gate only on success. Committing up front made a
      // transient read failure permanent: the (path, mtime) would already be
      // recorded as processed, so every later pass short-circuits on the
      // unchanged file and the stale context reading sticks until the transcript
      // happens to grow again.
      let content: string;
      try {
        content = readFileSync(newestPath, 'utf-8');
      } catch {
        continue; // leave the previous gate in place → retried next pass
      }
      this.windowFiles.set(group.folder, { path: newestPath, mtimeMs: newestMtime });
      phases.parsed += 1;

      const lines = content.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const r = JSON.parse(lines[i]);
          if (r.type === 'assistant' && r.message?.usage) {
            const u = r.message.usage;
            const model = r.message.model || 'unknown';
            const inputTokens = u.input_tokens || 0;
            const cacheRead = u.cache_read_input_tokens || 0;
            const cacheCreation = u.cache_creation_input_tokens || 0;
            const ctx = inputTokens + cacheRead + cacheCreation;
            const maxCtx = modelMaxContext(model);
            this.window.set(group.folder, {
              contextTokens: ctx,
              outputTokens: u.output_tokens || 0,
              cacheReadTokens: cacheRead,
              cacheCreationTokens: cacheCreation,
              maxContext: maxCtx,
              usagePercent: maxCtx > 0 ? Math.round((ctx / maxCtx) * 100) : 0,
              cacheHitPercent: ctx > 0 ? Math.round((cacheRead / ctx) * 100) : 0,
              model,
            });
            break;
          }
        } catch {
          /* skip line */
        }
      }
    }
    phases.totalMs = Date.now() - startedAt;
    return phases;
  }

  /** Refresh `stats` from each group's most recent transcripts (at most MAX_CONTEXT_FILES_PER_GROUP). */
  refreshStats(central: Database.Database, dataDir: string): ContextPassPhases {
    const startedAt = Date.now();
    const groups = central.prepare('SELECT id, folder FROM agent_groups').all() as { id: string; folder: string }[];
    const phases: ContextPassPhases = { groups: groups.length, files: 0, parsed: 0, totalMs: 0 };
    const sessionsDir = join(dataDir, 'v2-sessions');
    const livePaths = new Set<string>();
    // Day cutoffs, computed once per refresh — identical to the cost columns
    // (see the ccusage refresh). '' = no filter for 'all'.
    const cutoffs: Record<ContextPeriod, string> = {
      '1d': ccusageSinceDate(0),
      '7d': ccusageSinceDate(7),
      '30d': ccusageSinceDate(30),
      all: '',
    };
    for (const group of groups) {
      const claudeShared = join(sessionsDir, group.id, '.claude-shared');
      const files = collectClaudeJsonlFiles(claudeShared);
      phases.files += files.length;
      if (files.length === 0) {
        this.stats.delete(group.id);
        continue;
      }
      // Most-recent files first, then cap — a group with thousands of archived
      // transcripts shouldn't stall the pass; we report the cap via `capped`.
      const withMtime = files
        .map((f) => {
          try {
            return { f, m: statSync(f).mtimeMs };
          } catch {
            return { f, m: 0 };
          }
        })
        .sort((a, b) => b.m - a.m);
      const capped = withMtime.length > MAX_CONTEXT_FILES_PER_GROUP;
      const chosen = withMtime.slice(0, MAX_CONTEXT_FILES_PER_GROUP);

      const acc: Record<ContextPeriod, ContextAcc> = {
        '1d': newContextAcc(),
        '7d': newContextAcc(),
        '30d': newContextAcc(),
        all: newContextAcc(),
      };
      // Widest window the coworker ever ran on, over ALL signal files — the fixed
      // % scale shared by every period (1M for Opus fleets).
      let groupMaxWindow = 0;
      for (const { f, m } of chosen) {
        livePaths.add(f);
        const fc = this.scanFileContext(f, m, phases);
        if (!fc.hadSignal) continue;
        if (fc.maxWindow > groupMaxWindow) groupMaxWindow = fc.maxWindow;
        for (const period of CONTEXT_PERIODS) {
          const since = cutoffs[period];
          let sessionPeak = 0,
            comp = 0,
            au = 0,
            man = 0,
            preSum = 0,
            inWindow = false;
          for (const [key, d] of fc.days) {
            // 'all' keeps every day (incl. MISSING_TS_KEY); dated periods require
            // key >= cutoff — MISSING_TS_KEY ('00000000') never qualifies.
            if (period !== 'all' && !(key >= since)) continue;
            inWindow = true;
            if (d.peak > sessionPeak) sessionPeak = d.peak;
            comp += d.compactions;
            au += d.auto;
            man += d.manual;
            preSum += d.preTokensSum;
          }
          if (!inWindow) continue; // session has no activity in this window — not counted
          const a = acc[period];
          a.sessions++;
          if (sessionPeak > 0) a.peaks.push(sessionPeak);
          a.compactions += comp;
          a.auto += au;
          a.manual += man;
          a.preTokensSum += preSum;
          a.preTokensCount += comp;
        }
      }
      // Fall back to the model default if no model was ever identified.
      const maxContext = groupMaxWindow || modelMaxContext('unknown');
      const rec: ContextStatsByPeriod = {
        '1d': buildContextStats(acc['1d'], maxContext, capped),
        '7d': buildContextStats(acc['7d'], maxContext, capped),
        '30d': buildContextStats(acc['30d'], maxContext, capped),
        all: buildContextStats(acc.all, maxContext, capped),
      };
      // rec.all is the superset — null there means no signal in any window.
      if (!rec.all) {
        this.stats.delete(group.id);
        continue;
      }
      this.stats.set(group.id, rec);
    }
    // Evict per-file cache entries for transcripts no longer in any group's window.
    if (this.perFile.size > livePaths.size * 2 + 1000) {
      for (const k of this.perFile.keys()) if (!livePaths.has(k)) this.perFile.delete(k);
    }
    phases.totalMs = Date.now() - startedAt;
    return phases;
  }

  private scanFileContext(path: string, mtimeMs: number, phases: ContextPassPhases): PerFileContext {
    const cached = this.perFile.get(path);
    if (cached && cached.mtimeMs === mtimeMs) return cached;
    phases.parsed += 1;
    const out: PerFileContext = {
      mtimeMs,
      days: new Map(),
      maxWindow: 0,
      hadSignal: false,
    };
    try {
      const lines = readFileSync(path, 'utf-8').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        // Cheap pre-filter before JSON.parse — most lines are neither.
        if (line.indexOf('"usage"') < 0 && line.indexOf('compact_boundary') < 0) continue;
        let r: Record<string, unknown>;
        try {
          r = JSON.parse(line);
        } catch {
          continue;
        }
        if (r.type === 'system' && r.subtype === 'compact_boundary') {
          const m = (r.compactMetadata || {}) as { trigger?: string; preTokens?: number };
          const d = contextDayAgg(out, isoDayKey(r.timestamp) ?? MISSING_TS_KEY);
          d.compactions++;
          if (m.trigger === 'manual') d.manual++;
          else d.auto++;
          d.preTokensSum += m.preTokens || 0;
          out.hadSignal = true;
          continue;
        }
        const msg = r.message as { usage?: Record<string, number>; model?: string } | undefined;
        if (r.type === 'assistant' && msg?.usage) {
          const u = msg.usage;
          const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
          const d = contextDayAgg(out, isoDayKey(r.timestamp) ?? MISSING_TS_KEY);
          if (ctx > d.peak) d.peak = ctx;
          // Track the LARGEST window across models used — a session's effective
          // context is the 1M Opus window whenever any turn runs on it, even if a
          // later turn hands off to a 200k model (sonnet/haiku/gpt). Scaling to the
          // last-seen model would understate the window and inflate the peak %.
          // File-level (period-independent): the % scale stays fixed across periods.
          if (msg.model) out.maxWindow = Math.max(out.maxWindow, modelMaxContext(msg.model));
          out.hadSignal = true;
        }
      }
    } catch {
      /* unreadable file — treat as no signal */
    }
    this.perFile.set(path, out);
    return out;
  }
}
