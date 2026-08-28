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

/**
 * Reduce a wire model id to its LiteLLM key. LiteLLM keys are the bare model
 * ids (`gpt-5.2-codex`, `claude-opus-4-1`); wire ids can carry provider
 * prefixes (`azure/openai/…`, `aws/anthropic/bedrock-…`) and suffixes
 * (`[1m]`, `-vN`). Strip the provider path; a real implementation also strips
 * the documented suffixes. Returns '' if unmappable (caller flags it).
 */
export function liteLLMKey(model: string | undefined, table: LiteLLMRateTable): string {
  if (!model) return '';
  let m = model.trim().toLowerCase();
  const slash = m.lastIndexOf('/');
  if (slash >= 0) m = m.slice(slash + 1);
  m = m.replace(/-bedrock-|^bedrock-/, '').replace(/\[1m\]$/, '');
  return table[m] ? m : (table[model] ? model : '');
}

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
  const key = liteLLMKey(e.model, table);
  const r = table[key];
  if (!r) {
    const billed = e.inputTokens + e.outputTokens + e.cacheReadTokens + e.cacheWriteTokens + e.cacheWrite5mTokens + e.cacheWrite1hTokens;
    // A zero-token event legitimately costs $0 and is NOT "unpriced".
    return { usd: 0, unpriced: billed > 0 };
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
  return { usd, unpriced: false };
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
      thread_id             TEXT,
      gh_ref                TEXT,
      created_at            TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cost_events_ts ON cost_events(ts);
  `);
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
): boolean {
  const priced = priceTokens(e, table);
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO cost_events
       (id, ts, provider, model, input_tokens, cache_read_tokens, cache_write_tokens,
        cache_write_5m_tokens, cache_write_1h_tokens, output_tokens, reasoning_tokens,
        priced_usd, rate_version, thread_id, gh_ref, created_at)
       VALUES ($id, $ts, $provider, $model, $input, $cacheRead, $cacheWrite,
        $cw5, $cw1, $output, $reasoning, $priced, $rv, $thread, $gh, $now)`,
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
      $priced: priced.usd,
      $rv: rateVersion,
      $thread: e.threadId ?? null,
      $gh: e.ghRef ?? null,
      $now: nowIso,
    });
  return info.changes > 0;
}

/**
 * Sum the window's spend by RE-PRICING each row's stored tokens at the CURRENT
 * rate snapshot — this is what makes a rate correction reprice history for free.
 * `bucket(ts)` (defect-A convention) selects window membership at read time.
 * Enforcement's `costSpentUsd` is exactly this over the active window.
 */
export function sumWindow(
  db: Database,
  table: LiteLLMRateTable,
  bucket: (ts: string) => string,
  windowStart: string,
  windowEndExclusive: string,
): { usd: number; unpricedModels: string[] } {
  const rows = db.prepare(`SELECT * FROM cost_events`).all() as Array<Record<string, unknown>>;
  let usd = 0;
  const unpriced = new Set<string>();
  for (const row of rows) {
    const day = bucket(String(row.ts));
    if (day < windowStart || day >= windowEndExclusive) continue;
    const e = rowToEvent(row);
    const p = priceTokens(e, table);
    if (p.unpriced) unpriced.add(e.model);
    usd += p.usd;
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
    threadId: (row.thread_id as string) ?? null,
    ghRef: (row.gh_ref as string) ?? null,
  };
}
