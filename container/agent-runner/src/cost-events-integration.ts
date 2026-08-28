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
import { type CodexUsageEvent, MISSING_DAY_KEY, codexEventKey } from './codex-cost.js';
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
): CostEvent | null {
  if (!e.messageId) return null;
  const hasSplit = e.ephemeral1hInputTokens > 0 || e.ephemeral5mInputTokens > 0;
  return {
    id: `claude:${e.messageId}`,
    ts,
    provider: 'claude',
    model: e.model ?? '',
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
export function codexCallToEvent(e: CodexUsageEvent): CostEvent {
  const ts = /^\d{4}-\d{2}-\d{2}$/.test(e.day) ? `${e.day}T00:00:00.000Z` : MISSING_DAY_KEY;
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
