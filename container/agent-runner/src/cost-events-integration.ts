/**
 * #65 write-path integration — the two accrual-source → CostEvent mappers.
 *
 * Wired into poll-loop.ts at the existing accrual sites (all ADDITIVE, DUAL-RUN
 * — they write ledger rows alongside the live counter and change no
 * enforcement):
 *   - recordMessageCost → claudeMessageToEvent   (per Claude assistant message)
 *   - foldCodexCost     → codexCallToEvent        (per deduped codex call; native
 *                                                  codex #1333 reuses this exact
 *                                                  call site)
 */
import { type CodexUsageEvent, codexEventKey } from './codex-cost.js';
import type { CostEvent } from './cost-events.js';
import type { ProviderEvent } from './providers/types.js';

/**
 * Map a Claude `message_usage` event to a CostEvent. Returns null for a null-id
 * (undedupable) message — exactly what `recordMessageCost` also refuses to
 * charge, so the ledger and the counter skip the same events.
 */
export function claudeMessageToEvent(
  e: Extract<ProviderEvent, { type: 'message_usage' }>,
  ts: string,
  effectiveModel: string,
  windowGen: number,
): CostEvent | null {
  if (!e.messageId) return null;
  const hasSplit = e.ephemeral1hInputTokens > 0 || e.ephemeral5mInputTokens > 0;
  return {
    // GEN-SCOPED identity. A wire `message.id` is deduped within a budget window
    // by the counter's `seenMessageIds`, which is CLEARED on `/clear`/new_session —
    // so a replayed/reused id after a reset is charged AGAIN. A global `claude:<id>`
    // would `INSERT OR IGNORE`-dedup against the prior window's row and leave the
    // ledger BELOW the counter. Scoping the id to the generation re-admits it in the
    // fresh window while still deduping repeated blocks WITHIN a window (same gen +
    // same id). Codex keeps its cross-generation tuple identity on purpose (a fork
    // replay must dedup across gens); only the Claude id is gen-scoped.
    id: `claude:${windowGen}:${e.messageId}`,
    ts,
    provider: 'claude',
    // The model the COUNTER priced (= e.model || configuredModel), not `e.model
    // ?? ''` — an absent model must reprice at the configured model, or the
    // ledger reads $0 while the counter charged the configured rate (finding 3).
    model: effectiveModel,
    inputTokens: e.inputTokens,
    cacheReadTokens: e.cacheReadInputTokens,
    cacheWriteTokens: hasSplit ? 0 : e.cacheCreationInputTokens,
    cacheWrite5mTokens: hasSplit ? e.ephemeral5mInputTokens : 0,
    cacheWrite1hTokens: hasSplit ? e.ephemeral1hInputTokens : 0,
    outputTokens: e.outputTokens,
    reasoningTokens: 0,
  };
}

/**
 * Map one deduped codex call to a CostEvent, keyed by `codexEventKey` — the
 * VERIFIED identity (on prod, this tuple reproduces ccusage's tokens to the
 * token; a ts-key does not). `INSERT OR IGNORE` on this id re-does the shipped
 * session-wide dedup across files for free. Net input, to match ccusage.
 */
export function codexCallToEvent(e: CodexUsageEvent, nowIso: string): CostEvent {
  // A dateless codex call (no parseable day) buckets to "today" — the fold time
  // (`nowIso`) — EXACTLY as the live counter charges MISSING_DAY_KEY to
  // costDayKey (see foldCodexCost). If the ledger instead stored the literal
  // 'unknown-day' as ts, that row would sort ABOVE every real date and fall out
  // of BOTH the daily and lifetime windows while the counter still charged it —
  // manufacturing a phantom ledger<counter delta the dual-run bake would chase
  // as a pricing bug. The dedup id is the token tuple (ts-independent), so this
  // changes windowing only, never identity.
  const ts = /^\d{4}-\d{2}-\d{2}$/.test(e.day) ? `${e.day}T00:00:00.000Z` : nowIso;
  return {
    id: `codex:${codexEventKey(e)}`,
    ts,
    provider: 'codex',
    model: e.rawModel,
    inputTokens: Math.max(0, e.input - e.cached),
    cacheReadTokens: e.cached,
    cacheWriteTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    outputTokens: e.output,
    reasoningTokens: 0,
  };
}
