/**
 * #65 durable cost ledger — PROTOTYPE of the per-session write path + pricing.
 *
 * The append-only `cost_events` table is the durable source of truth for cost:
 * one row per billable unit (a deduped Claude assistant message; a codex rollout
 * call — including native-codex, #1333). Rows store TOKENS, never dollars; the
 * dollar figure is a VIEW recomputed at read time from a versioned LiteLLM rate
 * snapshot. Enforcement, the dashboard, and the ccusage-parity harness all
 * derive from this one table.
 *
 * Design invariants demonstrated here:
 *   - Tokens, not dollars: a rate correction reprices history (no stranded
 *     dollar watermark). `priced_usd` is a convenience cache only.
 *   - Identity IS the PK + INSERT OR IGNORE: a re-scan can't double-write, and a
 *     codex fork's replayed call no-ops against the row the original already owns
 *     (this retires the fragile `codexEventOwners` machinery).
 *   - Raw `ts` stored; bucketing (defect A) applied at read, never at write.
 *   - Per-MODEL pricing from LiteLLM: look the model up, never assume a tier
 *     (this is what would have prevented the -codex 2.9x mispricing).
 */
import type { Database } from 'bun:sqlite';
// The ledger reuses the SHIPPED normalizers + codex default so its pricing keys
// EXACTLY match the live counter (priceUsage / priceCodexEvent) — a separate,
// weaker normalizer is what made findings 4/5 diverge.
import { DEFAULT_CODEX_RATE, normalizeCodexModel } from './codex-cost.js';
import { normalizeModel } from './pricing.js';

/** One billable unit's token breakdown + identity. Provider-agnostic. */
export interface CostEvent {
  /** Dedup identity → PK. Claude: `claude:<message.id>`. Codex: `codex:<relpath>#<call-id>`. */
  id: string;
  /** The event's OWN UTC timestamp (message/call time), ISO-8601 Z. Bucketed at READ time. */
  ts: string;
  provider: 'claude' | 'codex';
  /** Wire model that served THIS unit — priced per-model against LiteLLM. */
  model: string;
  /** Non-cached input (net of cache) — matches ccusage `inputTokens`. */
  inputTokens: number;
  cacheReadTokens: number;
  /** Flat cache-creation when no TTL split is reported. */
  cacheWriteTokens: number;
  /** TTL split (the fleet runs 1h Claude caching). */
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  /** Includes reasoning tokens. */
  outputTokens: number;
  /** Informational; already inside `outputTokens`. */
  reasoningTokens: number;
  /**
   * An explicit DOLLAR adjustment for a charge that is NOT token-derivable — the
   * counter's aggregate/residual fallback (`recordTurnCost`, from `totalCostUsd`)
   * and the one-time migration baseline. Stored as a stored dollar, NEVER
   * repriced (token fields are 0 on an adjustment row; token rows carry 0 here).
   * `sumWindow` adds it on top of the repriced tokens so the ledger captures
   * every dollar the live counter charged (#65 finding 2). Default 0.
   */
  adjustmentUsd?: number;
  threadId?: string | null;
  ghRef?: string | null;
}

/**
 * A single model's rates, in LiteLLM's `model_prices_and_context_window.json`
 * shape (per-TOKEN costs). We read the exact keys LiteLLM publishes so a
 * snapshot of that file drops straight in.
 */
export interface LiteLLMModelRate {
  input_cost_per_token: number;
  output_cost_per_token: number;
  /** Absent for models without prompt caching. */
  cache_read_input_token_cost?: number;
  /** LiteLLM's base (≈5-minute) cache-write rate. */
  cache_creation_input_token_cost?: number;
}

/** A versioned snapshot: `{ modelKey → rates }`. Vendored into the image, bumped on refresh. */
export type LiteLLMRateTable = Record<string, LiteLLMModelRate>;

// NB: model→rate-key normalization intentionally lives in `priceTokens`, which
// reuses the SHIPPED `normalizeModel` (Claude) / `normalizeCodexModel` (codex).
// A separate weaker normalizer here is what made the ledger diverge from the
// counter on `-vN`/dated/`-latest`/prefixed ids (finding 4).

/** Result of pricing one event: the dollar figure, or an UNPRICED flag (never a silent $0). */
export interface PricedEvent {
  usd: number;
  /** True when the model has no LiteLLM entry — the signal to refresh the snapshot, NOT $0. */
  unpriced: boolean;
}

/**
 * Price one event's TOKENS at a LiteLLM snapshot. Per-model lookup — never a
 * tier assumption. Unknown model → `unpriced:true` (caller surfaces it).
 *
 * 1h cache premium: LiteLLM's `cache_creation_input_token_cost` is the base/5m
 * rate; the fleet's 1h writes cost 2× the input rate, applied on top of the
 * LiteLLM base using the stored 1h split. Codex rows carry no cache-write split,
 * so those terms are simply zero.
 */
export function priceTokens(e: CostEvent, table: LiteLLMRateTable): PricedEvent {
  // Provider-aware, reusing the SHIPPED normalizers so a `-vN`/dated/`-latest`/
  // prefixed id keys into RATE_TABLE exactly as the live counter keys it
  // (finding 4). RATE_TABLE is keyed by MODEL_PRICING / CODEX_MODEL_PRICING ids —
  // precisely what these normalizers return.
  const key = e.provider === 'codex' ? normalizeCodexModel(e.model) : normalizeModel(e.model);
  let r = table[key];
  let unpriced = false;
  if (!r) {
    const billed = e.inputTokens + e.outputTokens + e.cacheReadTokens + e.cacheWriteTokens + e.cacheWrite5mTokens + e.cacheWrite1hTokens;
    if (billed === 0) return { usd: 0, unpriced: false }; // a zero-token event legitimately costs $0
    if (e.provider === 'codex') {
      // Match the counter: an unknown codex model prices at DEFAULT_CODEX_RATE
      // (priceCodexEvent does the same), still flagged so the snapshot refreshes
      // (finding 5). Claude unknown → $0, which is what priceUsage also returns.
      r = {
        input_cost_per_token: DEFAULT_CODEX_RATE.input,
        output_cost_per_token: DEFAULT_CODEX_RATE.output,
        cache_read_input_token_cost: DEFAULT_CODEX_RATE.cacheRead,
      };
      unpriced = true;
    } else {
      return { usd: 0, unpriced: true };
    }
  }
  const cacheRead = r.cache_read_input_token_cost ?? 0;
  const cacheWriteBase = r.cache_creation_input_token_cost ?? 0;
  const hasSplit = e.cacheWrite5mTokens > 0 || e.cacheWrite1hTokens > 0;
  const usd =
    e.inputTokens * r.input_cost_per_token +
    e.outputTokens * r.output_cost_per_token +
    e.cacheReadTokens * cacheRead +
    (hasSplit
      ? e.cacheWrite5mTokens * cacheWriteBase + e.cacheWrite1hTokens * (r.input_cost_per_token * 2)
      : e.cacheWriteTokens * cacheWriteBase);
  return { usd, unpriced };
}

/** Create the per-session `cost_events` table (outbound.db). Idempotent. */
export function createCostEventsTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_events (
      id                    TEXT PRIMARY KEY,
      ts                    TEXT NOT NULL,
      provider              TEXT NOT NULL,
      model                 TEXT NOT NULL,
      input_tokens          INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
      cache_write_tokens    INTEGER NOT NULL DEFAULT 0,
      cache_write_5m_tokens INTEGER NOT NULL DEFAULT 0,
      cache_write_1h_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens         INTEGER NOT NULL DEFAULT 0,
      reasoning_tokens      INTEGER NOT NULL DEFAULT 0,
      priced_usd            REAL NOT NULL,
      rate_version          INTEGER NOT NULL,
      adjustment_usd        REAL NOT NULL DEFAULT 0,
      window_gen            INTEGER NOT NULL DEFAULT 0,
      thread_id             TEXT,
      gh_ref                TEXT,
      created_at            TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cost_events_ts ON cost_events(ts);
    CREATE INDEX IF NOT EXISTS cost_events_gen_ts ON cost_events(window_gen, ts);
  `);
  // Defensive back-compat: #1359 is unshipped, but a dev/CI outbound.db from an
  // EARLIER #1359 checkout may hold a `cost_events` that predates these two
  // columns (`CREATE TABLE IF NOT EXISTS` above then no-ops and would leave it
  // stale). `ADD COLUMN` brings it forward; it throws "duplicate column name"
  // when the column already exists (the fresh-table case), which we swallow — so
  // this is idempotent either way. The index create above is already IF NOT EXISTS.
  for (const col of ['adjustment_usd REAL NOT NULL DEFAULT 0', 'window_gen INTEGER NOT NULL DEFAULT 0']) {
    try {
      db.exec(`ALTER TABLE cost_events ADD COLUMN ${col}`);
    } catch {
      /* column already present — no-op */
    }
  }
}

/**
 * Write ONE cost event. Append-only, first-write-wins via `INSERT OR IGNORE` on
 * the identity PK — a re-scan or a fork replay of the same call is a no-op.
 * Returns whether a row was actually inserted (false = deduped).
 *
 * `priced_usd` is stamped at write time from the current rate snapshot for
 * convenience/observability; it is NOT the source of truth — reads reprice from
 * tokens. `nowIso` is injected (the container stamps `new Date().toISOString()`;
 * kept a param so this stays pure/testable).
 */
export function recordCostEvent(
  db: Database,
  e: CostEvent,
  rateVersion: number,
  table: LiteLLMRateTable,
  nowIso: string,
  windowGen = 0,
): boolean {
  const priced = priceTokens(e, table);
  const adjustment = e.adjustmentUsd ?? 0;
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO cost_events
       (id, ts, provider, model, input_tokens, cache_read_tokens, cache_write_tokens,
        cache_write_5m_tokens, cache_write_1h_tokens, output_tokens, reasoning_tokens,
        priced_usd, rate_version, adjustment_usd, window_gen, thread_id, gh_ref, created_at)
       VALUES ($id, $ts, $provider, $model, $input, $cacheRead, $cacheWrite,
        $cw5, $cw1, $output, $reasoning, $priced, $rv, $adj, $gen, $thread, $gh, $now)`,
    )
    .run({
      $id: e.id,
      $ts: e.ts,
      $provider: e.provider,
      $model: e.model,
      $input: e.inputTokens,
      $cacheRead: e.cacheReadTokens,
      $cacheWrite: e.cacheWriteTokens,
      $cw5: e.cacheWrite5mTokens,
      $cw1: e.cacheWrite1hTokens,
      $output: e.outputTokens,
      $reasoning: e.reasoningTokens,
      // Convenience cache only (reads reprice from tokens): tokens + the stored
      // dollar adjustment, so an adjustment row's `priced_usd` is its amount.
      $priced: priced.usd + adjustment,
      $rv: rateVersion,
      $adj: adjustment,
      $gen: windowGen,
      $thread: e.threadId ?? null,
      $gh: e.ghRef ?? null,
      $now: nowIso,
    });
  return info.changes > 0;
}

/**
 * Sum the window's spend by RE-PRICING each row's stored tokens at the CURRENT
 * rate snapshot — this is what makes a rate correction reprice history for free.
 *
 * Membership is a half-open `ts` range [windowStart, windowEndExclusive) pushed
 * INTO SQL so the `cost_events_ts` index does the selection. This table is
 * append-only and deliberately never pruned, so the previous unbounded
 * `SELECT *` + JS filter grew O(session lifetime) on every turn. Bounds are
 * day-strings ("YYYY-MM-DD"); every stored `ts` is a full ISO whose day prefix
 * orders identically under SQLite's default BINARY collation, so `ts >= start`
 * and `ts < end` select exactly the intended UTC days (dateless codex calls are
 * stored at the fold time by codexCallToEvent, so they too carry a real date).
 * Enforcement's `costSpentUsd` is exactly this over the active window.
 */
export function sumWindow(
  db: Database,
  table: LiteLLMRateTable,
  windowStart: string,
  windowEndExclusive: string,
  windowGen?: number,
): { usd: number; unpricedModels: string[] } {
  // Filter to ONE window generation when given (the reconcile always passes the
  // live gen so only the ACTIVE budget epoch is summed — a lifetime `/clear`
  // rotates the gen, and codex baseline history is stamped out of it; #65
  // finding 1). Omitted → sum every generation (used by callers that don't scope
  // to an epoch); every row predates gens as `window_gen = 0`, so the default is
  // behavior-preserving for existing callers/tests.
  const rows = (
    windowGen === undefined
      ? db
          .prepare(`SELECT * FROM cost_events WHERE ts >= $start AND ts < $end`)
          .all({ $start: windowStart, $end: windowEndExclusive })
      : db
          .prepare(`SELECT * FROM cost_events WHERE ts >= $start AND ts < $end AND window_gen = $gen`)
          .all({ $start: windowStart, $end: windowEndExclusive, $gen: windowGen })
  ) as Array<Record<string, unknown>>;
  let usd = 0;
  const unpriced = new Set<string>();
  for (const row of rows) {
    const e = rowToEvent(row);
    const p = priceTokens(e, table);
    if (p.unpriced) unpriced.add(e.model);
    // Repriced tokens PLUS the stored dollar adjustment (a token row's adjustment
    // is 0; an adjustment row's tokens are 0, so exactly one term is non-zero).
    usd += p.usd + Number(row.adjustment_usd ?? 0);
  }
  return { usd, unpricedModels: [...unpriced] };
}

function rowToEvent(row: Record<string, unknown>): CostEvent {
  return {
    id: String(row.id),
    ts: String(row.ts),
    provider: row.provider as 'claude' | 'codex',
    model: String(row.model),
    inputTokens: Number(row.input_tokens),
    cacheReadTokens: Number(row.cache_read_tokens),
    cacheWriteTokens: Number(row.cache_write_tokens),
    cacheWrite5mTokens: Number(row.cache_write_5m_tokens),
    cacheWrite1hTokens: Number(row.cache_write_1h_tokens),
    outputTokens: Number(row.output_tokens),
    reasoningTokens: Number(row.reasoning_tokens),
    adjustmentUsd: Number(row.adjustment_usd ?? 0),
    threadId: (row.thread_id as string) ?? null,
    ghRef: (row.gh_ref as string) ?? null,
  };
}
