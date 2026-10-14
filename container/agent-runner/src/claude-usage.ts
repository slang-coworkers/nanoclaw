/**
 * Exact Claude usage accounting for the live cost counter — the token math.
 *
 * Pure functions and plain state. `poll-loop.ts` owns the module singletons,
 * the charging (`applyCostDelta`) and the ledger writes; this module only
 * decides HOW MANY tokens each event is worth. Kept separate so every rule
 * below has a direct unit test (`claude-usage.test.ts`).
 *
 * WHAT THE SDK ACTUALLY REPORTS (captured from real runs, Agent SDK 0.3.289 /
 * Claude Code 2.1.296; fixtures in `__fixtures__/claude-usage/`):
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
 *    `modelUsage`, which is cumulative per SDK session: across turns of one
 *    query, and restored from the transcript on resume.
 *
 * Measured on prod before this fix (session sess-1785902924001-jylfb4): the
 * ledger recorded 8 output tokens for a call the transcript and the gateway
 * both record as 8,178; fleet-wide since #1329 the ledger kept ~1% of output
 * tokens.
 *
 * THE MODEL. Two sources per SDK session, per model, in TOKENS:
 *  - P: the per-message tokens charged so far (snapshot, then topped up to the
 *    final usage when it arrives). Real-time and attributable to a message id.
 *  - S: the SDK's own cumulative `modelUsage`, rebased to this session's
 *    tracking start. Complete (includes compaction / helper calls) but only
 *    known at a turn's `result`.
 * At each result the BACKSTOP charges `max(0, S - P - credit)` per field and
 * remembers it as `credit`: residual tokens no message has claimed yet. A later
 * top-up for a message the SDK had already counted (a background subagent
 * whose transcript arrives after the result) consumes that credit instead of
 * being charged again. Charged = P + credit at all times, so nothing is
 * charged twice and nothing the SDK counted is left uncharged.
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

export const ZERO_VEC: Readonly<TokenVec> = Object.freeze({
  input: 0,
  output: 0,
  cacheRead: 0,
  cw5: 0,
  cw1h: 0,
  cwFlat: 0,
});

const FIELDS: Array<keyof TokenVec> = ['input', 'output', 'cacheRead', 'cw5', 'cw1h', 'cwFlat'];

export function zeroVec(): TokenVec {
  return { ...ZERO_VEC };
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
  const split = u.ephemeral1hInputTokens > 0 || u.ephemeral5mInputTokens > 0;
  return {
    input: u.inputTokens || 0,
    output: u.outputTokens || 0,
    cacheRead: u.cacheReadInputTokens || 0,
    cw5: split ? u.ephemeral5mInputTokens || 0 : 0,
    cw1h: split ? u.ephemeral1hInputTokens || 0 : 0,
    cwFlat: split ? 0 : u.cacheCreationInputTokens || 0,
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

/**
 * Combine what was already charged for a message with a newer report of the
 * same message. Usage only ever grows (snapshot → final), so each plain field
 * takes the max. The three cache-write fields are ONE quantity reported in two
 * shapes (with or without a TTL split); taking a field-wise max across shapes
 * would count it twice, so the triple with the larger total wins as a unit
 * (the earlier one on a tie).
 */
export function mergeUsage(prev: TokenVec, next: TokenVec): TokenVec {
  const cwFromNext = cwTotal(next) > cwTotal(prev);
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
 * Accepts negative fields (a cache-write shape change in `mergeUsage`); the
 * caller only ever charges a non-negative total. Unknown model → 0.
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

const CUM_FIELDS: Array<keyof CumVec> = ['input', 'output', 'cacheRead', 'cacheWrite', 'costUsd'];

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
 * Group a result's `modelUsage` by pricing key. `claude-sonnet-5-5[1m]` and a
 * dated alias of the same model land in one bucket, matching how the
 * per-message side keys its own tokens.
 */
export function cumFromModelUsage(modelUsage: Record<string, SdkModelUsage> | undefined): Record<string, CumVec> {
  const out: Record<string, CumVec> = {};
  for (const [raw, u] of Object.entries(modelUsage ?? {})) {
    const key = pricingKey(raw);
    const c = (out[key] ??= zeroCum());
    c.input += u.inputTokens ?? 0;
    c.output += u.outputTokens ?? 0;
    c.cacheRead += u.cacheReadInputTokens ?? 0;
    c.cacheWrite += u.cacheCreationInputTokens ?? 0;
    c.costUsd += u.costUSD ?? 0;
  }
  return out;
}

export function isZeroCum(cums: Record<string, CumVec>): boolean {
  return Object.values(cums).every((c) => CUM_FIELDS.every((f) => c[f] === 0));
}

function subCum(a: CumVec, b: CumVec): CumVec {
  const out = zeroCum();
  for (const f of CUM_FIELDS) out[f] = a[f] - b[f];
  return out;
}

function anyDecrease(now: CumVec, before: CumVec): boolean {
  return CUM_FIELDS.some((f) => now[f] < before[f]);
}

/** Per-model accounting for the current SDK session. */
export interface ModelBackstop {
  /** Per-message tokens charged (snapshots topped up to finals). */
  p: TokenVec;
  /** Residual tokens the backstop charged that no message has claimed yet. */
  credit: TokenVec;
  /** SDK cumulative at the last settled result, and the offset that makes S = cum - base. */
  lastCum?: CumVec;
  base?: CumVec;
  /** Dollars charged from `costUSD` for a model the rate table cannot price. */
  unpricedUsd: number;
}

export interface ClaudeBackstopState {
  v: 1;
  /** SDK session id (the Claude continuation) this state belongs to. */
  sessionId: string | null;
  /**
   * True unless the session is KNOWN to have started empty (a fresh query with
   * no resume). On the first settled result an absorbing session treats every
   * SDK-reported token it has not seen per message as history — never charged.
   */
  absorbOnFirstResult: boolean;
  /** At least one result has been settled for this session. */
  tracked: boolean;
  /** Results settled so far, monotonic across sessions — the old/new boundary for messages. */
  epoch: number;
  /** When the last result was settled (ISO). */
  lastResultAt: string | null;
  models: Record<string, ModelBackstop>;
}

export function newBackstopState(
  epoch: number,
  sessionId: string | null,
  absorbOnFirstResult: boolean,
): ClaudeBackstopState {
  return { v: 1, sessionId, absorbOnFirstResult, tracked: false, epoch, lastResultAt: null, models: {} };
}

export function modelState(state: ClaudeBackstopState, key: string): ModelBackstop {
  return (state.models[key] ??= { p: zeroVec(), credit: zeroVec(), unpricedUsd: 0 });
}

/**
 * Split a per-message increase into the part to charge and the part an earlier
 * backstop residual already paid for. Input, output and cache-read are
 * consumed field by field. Cache writes are ONE pool across TTLs: a residual
 * write was assigned a TTL by guess (the session's dominant one), so a call
 * that later claims it may carry the other TTL. Consumption uses the NET
 * cache-write increase, so a report that only changes shape (unsplit → split,
 * same total) consumes nothing. A field of `charge` can go negative when the
 * TTLs differ; the caller never charges a negative total.
 */
export function consumeCredit(m: ModelBackstop, delta: TokenVec): { charge: TokenVec; consumed: TokenVec } {
  const charge = { ...delta };
  const consumed = zeroVec();
  for (const f of ['input', 'output', 'cacheRead'] as const) {
    if (delta[f] <= 0 || m.credit[f] <= 0) continue;
    const c = Math.min(delta[f], m.credit[f]);
    m.credit[f] -= c;
    consumed[f] = c;
    charge[f] -= c;
  }
  let need = Math.max(0, cwTotal(delta));
  // The call's own TTL first, so a correct guess is consumed like-for-like.
  const order: Array<'cw5' | 'cw1h' | 'cwFlat'> = [...(['cw5', 'cw1h', 'cwFlat'] as const)].sort(
    (a, b) => delta[b] - delta[a],
  );
  for (const f of order) {
    if (need <= 0) break;
    const c = Math.min(need, m.credit[f]);
    if (c <= 0) continue;
    m.credit[f] -= c;
    consumed[f] += c;
    charge[f] -= c;
    need -= c;
  }
  return { charge, consumed };
}

export interface Residual {
  key: string;
  /** Token residual (priced models). Zero vector for an unpriced model. */
  tokens: TokenVec;
  usd: number;
  /** True when charged from the SDK's `costUSD` because the rate table has no entry. */
  unpriced: boolean;
}

/**
 * Settle one result against the SDK's cumulative `modelUsage`. Mutates `state`
 * (credit, baselines, epoch) and returns what to charge.
 *
 * Baseline rules — the restored portion of a resumed session is NEVER charged:
 *  - First result of a session we are not tracking yet: base 0 when the session
 *    is known to be fresh; otherwise ABSORB (base = cum - P), so only what this
 *    query charged per message counts.
 *  - A model seen for the first time in a session we already track: base 0
 *    (the SDK had no history for it).
 *  - Any field went BACKWARDS (a resume that restored less than we last saw, a
 *    reset): rebase so S stays where it was. No residual from this result for
 *    that model; later results count from here. Under-counts at most that one
 *    turn's off-stream calls — never double-counts.
 */
export function settleResult(state: ClaudeBackstopState, cums: Record<string, CumVec>, nowIso: string): Residual[] {
  const residuals: Residual[] = [];
  for (const [key, c] of Object.entries(cums)) {
    const m = modelState(state, key);
    let base: CumVec;
    if (!m.lastCum || !m.base) {
      if (!state.tracked && state.absorbOnFirstResult) {
        base = {
          input: Math.max(0, c.input - m.p.input),
          output: Math.max(0, c.output - m.p.output),
          cacheRead: Math.max(0, c.cacheRead - m.p.cacheRead),
          cacheWrite: Math.max(0, c.cacheWrite - cwTotal(m.p)),
          costUsd: c.costUsd,
        };
      } else {
        base = zeroCum();
      }
    } else if (anyDecrease(c, m.lastCum)) {
      base = subCum(c, subCum(m.lastCum, m.base));
    } else {
      base = m.base;
    }
    const s = subCum(c, base);
    m.lastCum = { ...c };
    m.base = base;

    if (isPricedKey(key)) {
      const r = zeroVec();
      r.input = Math.max(0, s.input - m.p.input - m.credit.input);
      r.output = Math.max(0, s.output - m.p.output - m.credit.output);
      r.cacheRead = Math.max(0, s.cacheRead - m.p.cacheRead - m.credit.cacheRead);
      const rcw = Math.max(0, s.cacheWrite - cwTotal(m.p) - cwTotal(m.credit));
      // Residual writes take the session's dominant TTL for this model.
      if (m.p.cw1h > m.p.cw5 + m.p.cwFlat) r.cw1h = rcw;
      else r.cw5 = rcw;
      const usd = priceVec(key, r);
      if (usd > 0) {
        m.credit = addVec(m.credit, r);
        residuals.push({ key, tokens: r, usd, unpriced: false });
      }
    } else {
      const usd = Math.max(0, s.costUsd - m.unpricedUsd);
      if (usd > 0) {
        m.unpricedUsd += usd;
        residuals.push({ key, tokens: zeroVec(), usd, unpriced: true });
      }
    }
  }
  state.tracked = true;
  state.epoch += 1;
  state.lastResultAt = nowIso;
  return residuals;
}
