import type { TurnModelTokens, UsageAccounting } from './types.js';

/** One API call's billed tokens. `output` includes reasoning; `input` is net of cache. */
export interface CallTokens {
  input?: number;
  output?: number;
  reasoning?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Sum the calls of one turn by model, for a provider that reports each call's
 * usage (OpenCode, Pi). Consider an OpenCode turn whose main loop runs on
 * GLM 5.3 and whose subagent runs on GLM 5.3 flash: the tally holds one row
 * per model, so each is priced at its own rate.
 */
export class TurnTokenTally {
  private readonly byModel = new Map<string, TurnModelTokens>();

  add(model: string | undefined, call: CallTokens): void {
    const key = model?.trim() || 'unknown';
    const row = this.byModel.get(key) ?? {
      model: key,
      inputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    row.inputTokens += count(call.input);
    row.outputTokens += count(call.output);
    row.reasoningTokens += count(call.reasoning);
    row.cacheReadTokens += count(call.cacheRead);
    row.cacheWriteTokens += count(call.cacheWrite);
    this.byModel.set(key, row);
  }

  rows(): TurnModelTokens[] {
    return [...this.byModel.values()];
  }
}

/**
 * Return the `usage` payload of one turn from its per-model totals. The
 * aggregate fields serve the turn log line; the poll loop charges from
 * `turnTokens`. The payload goes out on every turn, empty or not, because the
 * cost hard stop runs when the `usage` event arrives.
 */
export function turnAccounting(
  rows: TurnModelTokens[],
  opts: { sessionId: string | null; durationMs: number; isError?: boolean },
): UsageAccounting {
  const sum = (field: keyof Omit<TurnModelTokens, 'model'>) => rows.reduce((total, r) => total + r[field], 0);
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    cacheReadInputTokens: sum('cacheReadTokens'),
    cacheCreationInputTokens: sum('cacheWriteTokens'),
    ephemeral1hInputTokens: 0,
    ephemeral5mInputTokens: 0,
    durationMs: opts.durationMs,
    totalCostUsd: 0,
    numTurns: 1,
    sessionId: opts.sessionId,
    turnTokens: rows,
    ...(opts.isError ? { isError: true } : {}),
  };
}
