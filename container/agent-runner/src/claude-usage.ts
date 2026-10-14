/**
 * Exact Claude usage accounting for the live cost counter — the token math.
 *
 * Pure functions and plain state. `poll-loop.ts` owns the module singletons,
 * the charging (one outbound.db transaction per accounting event) and the
 * ledger writes; this module only decides HOW MANY tokens each event is worth.
 * Every rule below has a direct unit test (`claude-usage.test.ts`).
 *
 * WHAT THE SDK ACTUALLY REPORTS (captured from real runs, Agent SDK 0.3.289 /
 * Claude Code 2.1.296; fixtures in `providers/__fixtures__/claude-usage/`):
 *
 *  - Each content block of one API response arrives as its own `assistant`
 *    message, and every one of them carries the SAME usage: the `message_start`
 *    SNAPSHOT. Input and cache fields are already final there; `output_tokens`
 *    is not (1–30, the tokens generated before the first block closed).
 *  - The final usage of a main-thread call arrives only in the
 *    `stream_event` → `message_delta` (`includePartialMessages: true`).
 *  - A Task subagent's calls emit NO stream events. Their forwarded assistant
 *    messages carry the same snapshot; the final usage is in the subagent's own
 *    transcript, whose path the `SubagentStop` hook hands us.
 *  - Calls that never reach the stream at all — compaction, Claude Code's own
 *    helper calls (a Haiku call on most turns) — appear only in the result's
 *    `modelUsage`, which is cumulative per SDK session: across the turns of one
 *    query, and restored on resume from the `cost-state` entry Claude Code
 *    writes into the session transcript when its process ends.
 *
 * Measured on prod before this fix (session sess-1785902924001-jylfb4): the
 * ledger recorded 8 output tokens for a call the transcript and the gateway
 * both record as 8,178; fleet-wide since #1329 the ledger kept ~1% of output
 * tokens. Compaction calls were never charged (slang-triager: 112 calls, $293,
 * 15.7% of its spend since 2026-10-06).
 *
 * THE MODEL. Accounting runs in SEGMENTS, one per `query()` — one Claude Code
 * process, within which `modelUsage` only grows. A segment starts with the
 * cumulative totals the SDK is about to restore (read BEFORE the query from the
 * transcript's last `cost-state`, else from the checkpoint this runner saved at
 * the previous process's last result; only with neither is the first result
 * absorbed). Per model and token field:
 *  - P: the per-message tokens charged in this segment (snapshot, then topped
 *    up to the final usage). Real-time and attributable to a message id.
 *  - S: `modelUsage` minus the segment base. Complete (includes compaction and
 *    helper calls) but only known at a `result`.
 * At each result the BACKSTOP charges `max(0, S - P - credit)` and adds it to
 * `credit`: residual tokens no message has claimed yet. A later top-up for a
 * message the SDK had already counted (a background subagent whose transcript
 * arrives after the result) consumes that credit instead of being charged
 * again. Charged = P + credit at all times, so nothing is charged twice and
 * nothing the SDK counted is left uncharged.
 */
import { MODEL_PRICING, normalizeModel } from './pricing.js';

/** One usage, split the way it is priced. Cache writes keep their TTL. */
export interface TokenVec {
  input: number;
  output: number;
  cacheRead: number;
  /** 5-minute cache write (1.25x input). */
  cw5: number;
  /** 1-hour cache write (2x input). */
  cw1h: number;
  /** Cache write reported without a TTL split — priced at the 5m rate. */
  cwFlat: number;
}

const FIELDS: Array<keyof TokenVec> = ['input', 'output', 'cacheRead', 'cw5', 'cw1h', 'cwFlat'];
const CW_FIELDS = ['cw5', 'cw1h', 'cwFlat'] as const;

export function zeroVec(): TokenVec {
  return { input: 0, output: 0, cacheRead: 0, cw5: 0, cw1h: 0, cwFlat: 0 };
}

/** A usage figure the SDK or a transcript can hand us: finite, non-negative, integral. */
export function cleanCount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** The usage fields of a `message_usage` event, as a vector. */
export function vecFromUsage(u: {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  ephemeral1hInputTokens: number;
  ephemeral5mInputTokens: number;
}): TokenVec {
  const h1 = cleanCount(u.ephemeral1hInputTokens);
  const m5 = cleanCount(u.ephemeral5mInputTokens);
  const split = h1 > 0 || m5 > 0;
  return {
    input: cleanCount(u.inputTokens),
    output: cleanCount(u.outputTokens),
    cacheRead: cleanCount(u.cacheReadInputTokens),
    cw5: split ? m5 : 0,
    cw1h: split ? h1 : 0,
    cwFlat: split ? 0 : cleanCount(u.cacheCreationInputTokens),
  };
}

export function cwTotal(v: TokenVec): number {
  return v.cw5 + v.cw1h + v.cwFlat;
}

export function addVec(a: TokenVec, b: TokenVec): TokenVec {
  const out = zeroVec();
  for (const f of FIELDS) out[f] = a[f] + b[f];
  return out;
}

export function subVec(a: TokenVec, b: TokenVec): TokenVec {
  const out = zeroVec();
  for (const f of FIELDS) out[f] = a[f] - b[f];
  return out;
}

export function isZeroVec(v: TokenVec): boolean {
  return FIELDS.every((f) => v[f] === 0);
}

export function vecTokens(v: TokenVec): number {
  return FIELDS.reduce((s, f) => s + v[f], 0);
}

function hasSplit(v: TokenVec): boolean {
  return v.cw5 > 0 || v.cw1h > 0;
}

/**
 * Combine what was already charged for a message with a newer report of the
 * same message. Usage only ever grows (snapshot → final), so each plain field
 * takes the max. The three cache-write fields are ONE quantity reported in two
 * shapes (with or without a TTL split); a field-wise max across shapes would
 * count it twice, so the triple with the larger total wins as a unit. On equal
 * totals a TTL split wins over an unsplit figure — it is the authoritative
 * shape — otherwise the earlier triple is kept.
 */
export function mergeUsage(prev: TokenVec, next: TokenVec): TokenVec {
  const cwFromNext =
    cwTotal(next) > cwTotal(prev) || (cwTotal(next) === cwTotal(prev) && hasSplit(next) && !hasSplit(prev));
  return {
    input: Math.max(prev.input, next.input),
    output: Math.max(prev.output, next.output),
    cacheRead: Math.max(prev.cacheRead, next.cacheRead),
    cw5: cwFromNext ? next.cw5 : prev.cw5,
    cw1h: cwFromNext ? next.cw1h : prev.cw1h,
    cwFlat: cwFromNext ? next.cwFlat : prev.cwFlat,
  };
}

/** Pricing key: the base model id, or `raw:<id>` for a model the table cannot price. */
export function pricingKey(model: string | undefined): string {
  const k = normalizeModel(model);
  return (
    k ||
    `raw:${(model ?? '')
      .trim()
      .toLowerCase()
      .replace(/\[1m\]$/, '')}`
  );
}

export function isPricedKey(key: string): boolean {
  return !key.startsWith('raw:') && !!MODEL_PRICING[key];
}

/**
 * Dollar cost of a token vector. Same rates and TTL rule as `priceUsage`
 * (1h write = 2x input, 5m and unsplit writes = `cacheCreate`), but a vector
 * may carry split AND unsplit writes, which `priceUsage` cannot express.
 * SIGNED: a negative field prices negative (a correction). Unknown model → 0.
 */
export function priceVec(model: string | undefined, v: TokenVec): number {
  const rate = MODEL_PRICING[normalizeModel(model)] ?? MODEL_PRICING[model ?? ''];
  if (!rate) return 0;
  return (
    v.input * rate.input +
    v.output * rate.output +
    v.cacheRead * rate.cacheRead +
    (v.cw5 + v.cwFlat) * rate.cacheCreate +
    v.cw1h * rate.input * 2
  );
}

/** SDK cumulative usage for one pricing key (summed over raw ids that share it). */
export interface CumVec {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
}

const CUM_TOKEN_FIELDS: Array<keyof CumVec> = ['input', 'output', 'cacheRead', 'cacheWrite'];

export function zeroCum(): CumVec {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 };
}

export interface SdkModelUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  costUSD?: number;
}

/**
 * Group a `modelUsage` map by pricing key. `claude-sonnet-5-5[1m]` and a dated
 * alias of the same model land in one bucket, matching how the per-message
 * side keys its own tokens. Non-finite or negative figures read as 0.
 */
export function cumFromModelUsage(
  modelUsage: Record<string, SdkModelUsage> | undefined | null,
): Record<string, CumVec> {
  const out: Record<string, CumVec> = {};
  for (const [raw, u] of Object.entries(modelUsage ?? {})) {
    if (!u || typeof u !== 'object') continue;
    const key = pricingKey(raw);
    const c = (out[key] ??= zeroCum());
    c.input += cleanCount(u.inputTokens);
    c.output += cleanCount(u.outputTokens);
    c.cacheRead += cleanCount(u.cacheReadInputTokens);
    c.cacheWrite += cleanCount(u.cacheCreationInputTokens);
    c.costUsd += typeof u.costUSD === 'number' && Number.isFinite(u.costUSD) && u.costUSD > 0 ? u.costUSD : 0;
  }
  return out;
}

export function isZeroCum(cums: Record<string, CumVec>): boolean {
  return Object.values(cums).every((c) => CUM_TOKEN_FIELDS.every((f) => c[f] === 0) && c.costUsd === 0);
}

function subCum(a: CumVec, b: CumVec): CumVec {
  return {
    input: a.input - b.input,
    output: a.output - b.output,
    cacheRead: a.cacheRead - b.cacheRead,
    cacheWrite: a.cacheWrite - b.cacheWrite,
    costUsd: a.costUsd - b.costUsd,
  };
}

/**
 * Did the SDK's cumulative total go BACKWARDS? Per token field for a priced
 * model; a `costUSD` revision there is the SDK re-estimating, not a reset. For
 * an unpriced model the dollar figure is all we account by, so it decides.
 */
export function decreased(now: CumVec, before: CumVec, priced: boolean): boolean {
  return priced ? CUM_TOKEN_FIELDS.some((f) => now[f] < before[f]) : now.costUsd < before.costUsd;
}

/** Per-model accounting inside one segment. */
export interface SegmentModel {
  /** Per-message tokens charged in this segment. */
  p: TokenVec;
  /** Residual tokens the backstop charged that no message has claimed yet. */
  credit: TokenVec;
  /** SDK cumulative at the segment start; null until known (an absorbing segment's first result). */
  base: CumVec | null;
  /** SDK cumulative at the last settled result. */
  lastCum: CumVec | null;
  /** `p` at the last settled result — a reset restarts from here. */
  pAtLastResult: TokenVec;
  /** Main-thread cache writes seen per TTL (residual writes take the dominant one). */
  mainCw5: number;
  mainCw1h: number;
  /** Dollars charged from `costUSD` for a model the rate table cannot price. */
  unpricedUsd: number;
}

export type SegmentBaseSource = 'fresh' | 'transcript' | 'checkpoint' | 'absorb';

/** One `query()` — one Claude Code process. */
export interface Segment {
  id: number;
  /** SDK session id; null until the fresh query's `init`. */
  sessionId: string | null;
  baseSource: SegmentBaseSource;
  /** Results settled in this segment — the old/new boundary for messages. */
  epoch: number;
  lastResultAt: string | null;
  models: Record<string, SegmentModel>;
}

export interface ClaudeBackstopState {
  v: 2;
  /** Last segment id issued (monotonic). */
  segSeq: number;
  segment: Segment | null;
  /** SDK cumulative at each session's last settled result — the fallback restore baseline. */
  checkpoints: Record<string, { at: string; cum: Record<string, CumVec> }>;
  /**
   * Main-thread cache writes seen per TTL across segments. The TTL is a Claude
   * Code setting, so it outlives a segment: a resumed query's first residual
   * (a compaction before any streamed call) takes it.
   */
  mainCw5?: number;
  mainCw1h?: number;
  /**
   * Results settled by each recent CLOSED segment (by id). A call first seen in
   * a closed segment at an epoch below this was covered by a committed result
   * there; one at or above it died unsettled with its process.
   */
  settledEpochs?: Record<string, number>;
}

const MAX_CHECKPOINTS = 16;

export function newBackstopState(): ClaudeBackstopState {
  return { v: 2, segSeq: 0, segment: null, checkpoints: {}, mainCw5: 0, mainCw1h: 0, settledEpochs: {} };
}

/**
 * Open a segment. `restored` is the cumulative the SDK will restore (null for a
 * fresh session: base 0). `absorb` means the restore is unknown.
 */
export function startSegment(
  state: ClaudeBackstopState,
  sessionId: string | null,
  source: SegmentBaseSource,
  restored: Record<string, CumVec> | null,
): Segment {
  closeSegment(state);
  const seg: Segment = { id: ++state.segSeq, sessionId, baseSource: source, epoch: 0, lastResultAt: null, models: {} };
  for (const [key, c] of Object.entries(restored ?? {})) {
    const m = segmentModel(seg, key);
    m.base = { ...c };
    m.lastCum = { ...c };
  }
  state.segment = seg;
  return seg;
}

/** Close the open segment, remembering how many results it settled. */
export function closeSegment(state: ClaudeBackstopState): void {
  const closed = state.segment;
  if (!closed) return;
  const se = (state.settledEpochs ??= {});
  se[String(closed.id)] = closed.epoch;
  const ids = Object.keys(se).sort((a, b) => Number(a) - Number(b));
  for (const id of ids.slice(0, Math.max(0, ids.length - 64))) delete se[id];
  state.segment = null;
}

/**
 * Was a call first seen in segment `segId` at `epoch` covered by a result that
 * segment committed? Unknown segments (pruned, or rows from before segments
 * existed) count as covered — the safe direction.
 */
export function coveredByClosedSegment(state: ClaudeBackstopState, segId: number, epoch: number): boolean {
  const settled = state.settledEpochs?.[String(segId)];
  return settled === undefined || epoch < settled;
}

export function segmentModel(seg: Segment, key: string): SegmentModel {
  let m = seg.models[key];
  if (!m) {
    m = {
      p: zeroVec(),
      credit: zeroVec(),
      // A model not in the restored totals has no history in this session —
      // except in an absorbing segment before its first result, where nothing
      // is known yet.
      base: seg.baseSource === 'absorb' && seg.epoch === 0 ? null : zeroCum(),
      lastCum: null,
      pAtLastResult: zeroVec(),
      mainCw5: 0,
      mainCw1h: 0,
      unpricedUsd: 0,
    };
    seg.models[key] = m;
  }
  return m;
}

/**
 * Split a per-message increase into the part to charge and the part an earlier
 * backstop residual already paid for. Plain fields are consumed field by field.
 * Cache writes are one pool: a residual write was assigned a TTL by estimate,
 * so the same TTL bucket is consumed first, then the others, up to the NET
 * cache-write increase (a pure shape change consumes nothing). `charge` is
 * SIGNED — when the call's real TTL differs from the estimate, pricing it
 * corrects the earlier estimate in either direction.
 */
export function consumeCredit(m: SegmentModel, delta: TokenVec): { charge: TokenVec; consumed: TokenVec } {
  const consumed = zeroVec();
  for (const f of ['input', 'output', 'cacheRead'] as const) {
    if (delta[f] <= 0 || m.credit[f] <= 0) continue;
    consumed[f] = Math.min(delta[f], m.credit[f]);
  }
  let need = Math.max(0, cwTotal(delta));
  for (const f of CW_FIELDS) {
    if (need <= 0 || delta[f] <= 0) continue;
    const c = Math.min(need, delta[f], m.credit[f]);
    consumed[f] += c;
    need -= c;
  }
  for (const f of CW_FIELDS) {
    if (need <= 0) break;
    const c = Math.min(need, m.credit[f] - consumed[f]);
    if (c <= 0) continue;
    consumed[f] += c;
    need -= c;
  }
  m.credit = subVec(m.credit, consumed);
  // Tokens consumed from another TTL bucket are charged back at the call's
  // own TTL: charge = delta - consumed, field by field (signed).
  return { charge: subVec(delta, consumed), consumed };
}

export interface Residual {
  key: string;
  /** Token residual (priced models). Zero vector for an unpriced model. */
  tokens: TokenVec;
  usd: number;
  /** True when charged from the SDK's `costUSD` because the rate table has no entry. */
  unpriced: boolean;
}

export interface SettleOutcome {
  residuals: Residual[];
  /** Models whose first result was absorbed (no baseline known). */
  absorbed: string[];
  /** Models whose cumulative went backwards (restore smaller than the baseline). */
  rebased: string[];
}

/**
 * The TTL residual cache writes take: the model's main-thread TTL in this
 * segment, else the segment's, else `fallback` (the session's history), else 5m.
 */
function residualTtl(seg: Segment, m: SegmentModel, fallback?: 'cw5' | 'cw1h'): 'cw5' | 'cw1h' {
  if (m.mainCw1h + m.mainCw5 > 0) return m.mainCw1h > m.mainCw5 ? 'cw1h' : 'cw5';
  let h1 = 0;
  let m5 = 0;
  for (const x of Object.values(seg.models)) {
    h1 += x.mainCw1h;
    m5 += x.mainCw5;
  }
  if (h1 + m5 > 0) return h1 > m5 ? 'cw1h' : 'cw5';
  return fallback ?? 'cw5';
}

/** The TTL the state's cross-segment history points to, if any. */
export function historicalTtl(state: ClaudeBackstopState): 'cw5' | 'cw1h' | undefined {
  const h1 = state.mainCw1h ?? 0;
  const m5 = state.mainCw5 ?? 0;
  if (h1 + m5 === 0) return undefined;
  return h1 > m5 ? 'cw1h' : 'cw5';
}

/**
 * Settle one result against the SDK's cumulative `modelUsage`. Mutates the
 * segment (credit, baselines, epoch) and returns what to charge.
 *
 *  - Known base: S = cum - base, exact — including compaction and helper calls
 *    made in this turn.
 *  - Absorbing segment, first result: base = cum - P, so only what this query
 *    charged per message counts (reported in `absorbed`).
 *  - A field went BACKWARDS (the restore was smaller than the baseline, or a
 *    reset): restart the model's accounting from this result with only the
 *    per-message spend since the last result — p and credit re-zeroed, base =
 *    cum - p. That one result's off-stream calls are not chargeable (they are
 *    indistinguishable from the restore); every later result is exact again,
 *    and per-message spend from before the reset can never mask later spend.
 */
export function settleSegment(
  seg: Segment,
  cums: Record<string, CumVec>,
  nowIso: string,
  fallbackTtl?: 'cw5' | 'cw1h',
): SettleOutcome {
  const out: SettleOutcome = { residuals: [], absorbed: [], rebased: [] };
  for (const [key, c] of Object.entries(cums)) {
    const m = segmentModel(seg, key);
    const priced = isPricedKey(key);
    if (!m.base) {
      m.base = {
        input: Math.max(0, c.input - m.p.input),
        output: Math.max(0, c.output - m.p.output),
        cacheRead: Math.max(0, c.cacheRead - m.p.cacheRead),
        cacheWrite: Math.max(0, c.cacheWrite - cwTotal(m.p)),
        costUsd: c.costUsd,
      };
      out.absorbed.push(key);
    } else if (m.lastCum && decreased(c, m.lastCum, priced)) {
      m.p = subVec(m.p, m.pAtLastResult);
      m.credit = zeroVec();
      m.unpricedUsd = 0;
      m.base = {
        input: c.input - m.p.input,
        output: c.output - m.p.output,
        cacheRead: c.cacheRead - m.p.cacheRead,
        cacheWrite: c.cacheWrite - cwTotal(m.p),
        costUsd: c.costUsd,
      };
      out.rebased.push(key);
    }
    m.lastCum = { ...c };
    const r = residualFor(seg, key, m, fallbackTtl);
    if (r) out.residuals.push(r);
    m.pAtLastResult = { ...m.p };
  }
  seg.epoch += 1;
  seg.lastResultAt = nowIso;
  return out;
}

/**
 * Settle a segment that is being CLOSED against the cumulative its SDK session
 * ended at: the transcript's last `cost-state`, which Claude Code writes as its
 * process exits (equal to the last result's `modelUsage` when nothing ran after
 * it). It covers what the process spent after its last settled result, or all
 * of it when no result was ever settled: a main-thread call whose final the
 * runner never read, a background subagent, a helper call, an accounting event
 * that never committed before a restart. Differenced like a result
 * (`max(0, S - P - credit)`), so nothing already charged is charged again.
 *
 * A model with no baseline (an absorbing segment that never saw its first
 * result) or whose total is BELOW its last settled one (the cost-state predates
 * that result — the process was killed before it could write a newer one) is
 * left alone: nothing newer is known. A cost-state that is nowhere AHEAD of
 * what the segment last settled tells nothing new either — after a normal end
 * that is simply all of it, after a kill it is stale — so it settles nothing
 * and covers nothing. `settled` says whether any model was settled; only then
 * do the segment's calls count as covered by it.
 */
export function settleClosingSegment(
  seg: Segment,
  cums: Record<string, CumVec>,
  nowIso: string,
  fallbackTtl?: 'cw5' | 'cw1h',
): { residuals: Residual[]; settled: boolean; skipped: string[] } {
  const out = { residuals: [] as Residual[], settled: false, skipped: [] as string[] };
  const advanced = Object.entries(cums).some(([key, c]) => {
    const m = seg.models[key];
    const before = m ? (m.lastCum ?? m.base) : seg.baseSource === 'absorb' && seg.epoch === 0 ? null : zeroCum();
    if (!before || decreased(c, before, isPricedKey(key))) return false;
    return isPricedKey(key) ? CUM_TOKEN_FIELDS.some((f) => c[f] > before[f]) : c.costUsd > before.costUsd;
  });
  if (!advanced) return out;
  for (const [key, c] of Object.entries(cums)) {
    const m = segmentModel(seg, key);
    if (!m.base || (m.lastCum && decreased(c, m.lastCum, isPricedKey(key)))) {
      out.skipped.push(key);
      continue;
    }
    m.lastCum = { ...c };
    const r = residualFor(seg, key, m, fallbackTtl);
    if (r) out.residuals.push(r);
    m.pAtLastResult = { ...m.p };
    out.settled = true;
  }
  if (out.settled) {
    seg.epoch += 1;
    seg.lastResultAt = nowIso;
  }
  return out;
}

/**
 * What the backstop owes for one model right now, from its last settled
 * cumulative: `max(0, S - P - credit)` per token field (priced) or the SDK
 * cost not yet charged (unpriced). Adds what it returns to the model's credit
 * (or `unpricedUsd`). Null when nothing is owed or no result has been settled.
 */
function residualFor(seg: Segment, key: string, m: SegmentModel, fallbackTtl?: 'cw5' | 'cw1h'): Residual | null {
  if (!m.lastCum || !m.base) return null;
  const s = subCum(m.lastCum, m.base);
  if (isPricedKey(key)) {
    const r = zeroVec();
    r.input = Math.max(0, s.input - m.p.input - m.credit.input);
    r.output = Math.max(0, s.output - m.p.output - m.credit.output);
    r.cacheRead = Math.max(0, s.cacheRead - m.p.cacheRead - m.credit.cacheRead);
    r[residualTtl(seg, m, fallbackTtl)] = Math.max(0, s.cacheWrite - cwTotal(m.p) - cwTotal(m.credit));
    const usd = priceVec(key, r);
    if (!(usd > 0)) return null;
    m.credit = addVec(m.credit, r);
    return { key, tokens: r, usd, unpriced: false };
  }
  const usd = Math.max(0, s.costUsd - m.unpricedUsd);
  if (!(usd > 0)) return null;
  m.unpricedUsd += usd;
  return { key, tokens: zeroVec(), usd, unpriced: true };
}

/**
 * Re-settle one model against its LAST settled cumulative, between results.
 * Needed when a call is moved OUT of a model's per-message tokens after a
 * result already used them to offset that model's residual (a model-less
 * snapshot priced as the configured model, whose final names another): the
 * offset it provided is now owed.
 */
export function resettleModel(seg: Segment, key: string, fallbackTtl?: 'cw5' | 'cw1h'): Residual | null {
  const m = seg.models[key];
  return m ? residualFor(seg, key, m, fallbackTtl) : null;
}

/** Remember the SDK cumulative a session reached — the fallback baseline for its next resume. */
export function saveCheckpoint(
  state: ClaudeBackstopState,
  sessionId: string,
  cums: Record<string, CumVec>,
  nowIso: string,
): void {
  const prev = state.checkpoints[sessionId]?.cum ?? {};
  state.checkpoints[sessionId] = { at: nowIso, cum: { ...prev, ...cums } };
  const ids = Object.keys(state.checkpoints);
  if (ids.length > MAX_CHECKPOINTS) {
    ids
      .sort((a, b) => state.checkpoints[a].at.localeCompare(state.checkpoints[b].at))
      .slice(0, ids.length - MAX_CHECKPOINTS)
      .forEach((id) => delete state.checkpoints[id]);
  }
}
