/**
 * Per-session cost — pricing + ranking core for the Sessions tab's cost column.
 *
 * ccusage only reports cost per group per day, so a session-level figure has to
 * be computed from the raw per-message `usage` in each session's transcript.
 * This module owns the pricing math (pure, testable); the file walking and
 * caching live in server.ts (`refreshSessionCostCache`), mirroring how
 * `unit-cost.ts` is the tested core behind the funnel's cost column.
 *
 * Rates are LiteLLM's `model_prices_and_context_window.json` — the SAME source
 * ccusage prices against and the same rates `server.ts`'s FALLBACK_PRICING
 * carries, so a session sum reconciles with the group total on the Overview.
 * A test (session-costs.test.ts) asserts this table agrees with FALLBACK_PRICING
 * on every shared model, so the two can't drift.
 *
 * This module owns the CLAUDE half only. A session's Codex spend (the
 * `codex-critique` skill's `mcp__codex__codex` tool calls, which never touch a
 * Claude transcript) is priced by the sibling `codex-costs.ts` and lands in the
 * same `SessionCostEntry` as `codexUsd`.
 */

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  // Per-TTL cache-write split, when present. A 5-minute write costs 1.25x input;
  // a 1-hour write (ENABLE_PROMPT_CACHING_1H, which this fleet runs) costs 2x
  // input. Pricing the flat `cache_creation_input_tokens` at the 5m rate
  // understated the whole column by a consistent ~16% vs ccusage; splitting by
  // TTL matches ccusage to the cent (verified on prod slang-fixer 7d).
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

export interface ModelRate {
  input: number;
  output: number;
  cacheCreate: number;
  cacheRead: number;
}

// Keyed by BASE model id (no provider prefix, no `[1m]`/`-v1`/date suffix).
// normalizeModel() maps every wire variant onto one of these.
export const MODEL_PRICING: Record<string, ModelRate> = {
  'claude-opus-5': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'claude-opus-4-8': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'claude-opus-4-7': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'claude-opus-4-6': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'claude-sonnet-5': { input: 2e-6, output: 10e-6, cacheCreate: 2.5e-6, cacheRead: 2e-7 },
  'claude-sonnet-4-6': { input: 3e-6, output: 15e-6, cacheCreate: 3.75e-6, cacheRead: 3e-7 },
  'claude-haiku-4-5': { input: 1e-6, output: 5e-6, cacheCreate: 1.25e-6, cacheRead: 1e-7 },
};

/**
 * Reduce a wire model id to its base pricing key. Handles the forms actually
 * seen in prod transcripts: `aws/anthropic/bedrock-claude-opus-5`,
 * `aws/anthropic/claude-haiku-4-5-v1`, `claude-opus-4-8[1m]`, and bare
 * `claude-opus-5`. Returns '' for `<synthetic>` and anything unrecognized so
 * the caller can treat it as unpriced rather than silently $0.
 */
export function normalizeModel(model: string | undefined): string {
  if (!model) return '';
  let m = model.trim().toLowerCase();
  m = m.replace(/\[1m\]$/, ''); // context-window flag, not a distinct model
  m = m
    .replace(/^aws\/anthropic\/bedrock-/, '')
    .replace(/^aws\/anthropic\//, '')
    .replace(/^anthropic\//, '');
  m = m.replace(/-v\d+$/, ''); // bedrock revision suffix (…-v1)
  if (MODEL_PRICING[m]) return m;
  // Drop a trailing date snapshot (…-20251001) and retry.
  const undated = m.replace(/-\d{8}$/, '');
  if (MODEL_PRICING[undated]) return undated;
  return '';
}

/**
 * Dollar cost of one message's usage. Unpriced (unknown) model → 0.
 *
 * Cache writes are priced by TTL: a 1-hour write costs 2x the input rate, a
 * 5-minute write 1.25x (== `rate.cacheCreate`). When the `cache_creation` TTL
 * split is present we use it (matches ccusage exactly); otherwise we fall back
 * to the flat `cache_creation_input_tokens` at the 5m rate.
 */
export function priceUsage(model: string | undefined, u: TokenUsage): number {
  const rate = MODEL_PRICING[normalizeModel(model)];
  if (!rate) return 0;
  let cost =
    (u.input_tokens || 0) * rate.input +
    (u.output_tokens || 0) * rate.output +
    (u.cache_read_input_tokens || 0) * rate.cacheRead;
  const split = u.cache_creation;
  if (split && (split.ephemeral_5m_input_tokens != null || split.ephemeral_1h_input_tokens != null)) {
    cost += (split.ephemeral_5m_input_tokens || 0) * rate.cacheCreate;
    cost += (split.ephemeral_1h_input_tokens || 0) * (rate.input * 2); // 1h write = 2x input
  } else {
    cost += (u.cache_creation_input_tokens || 0) * rate.cacheCreate;
  }
  return cost;
}

export interface SessionCostEntry {
  sessionId: string; // nanoclaw session id (for the link); '' if unmapped
  sdkSessionId: string; // source SDK uuid
  groupFolder: string;
  groupName: string;
  /**
   * TOTAL priced spend for the session in the window — `claudeUsd + codexUsd`.
   * Every existing consumer (ranking, p90/p99, the Sessions column) reads this
   * and keeps meaning "what this session cost", which is why the split was
   * added alongside it rather than replacing it.
   */
  cost: number;
  /** Claude-transcript half of `cost` (`.claude-shared/projects/**`). */
  claudeUsd: number;
  /**
   * Codex half of `cost` (`<session>/codex/sessions/**` rollouts) — the spend
   * `codex-critique` incurs by calling `mcp__codex__codex` as a plain MCP tool,
   * which never appears in a Claude transcript. See `codex-costs.ts`.
   */
  codexUsd: number;
  tokens: number;
  lastActiveMs: number;
  unpriced: boolean; // saw usage from a model MODEL_PRICING doesn't know
}

/** Sort by cost desc, then most-recent, and cap to `limit`. */
export function rankByCost(entries: SessionCostEntry[], limit = 500): SessionCostEntry[] {
  return [...entries].sort((a, b) => b.cost - a.cost || b.lastActiveMs - a.lastActiveMs).slice(0, limit);
}
