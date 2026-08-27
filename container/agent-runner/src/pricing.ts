/**
 * Per-turn cost pricing core for the runner's live cost cap.
 *
 * This is a VERBATIM COPY of the pricing core in `dashboard/session-costs.ts`
 * (host, Node) — copied not imported, because the host and the container share
 * no modules by rule (the container runs on Bun; the host on Node). The two
 * tables MUST stay in sync so the runner's per-session `spentUsd` reconciles
 * with the dashboard's transcript-derived cost column to the cent. The bun:test
 * in `pricing.test.ts` asserts a few representative rates so the copy can't
 * silently drift; if you change a rate here, change it there too (and vice
 * versa).
 *
 * Rates are LiteLLM's `model_prices_and_context_window.json` — the same source
 * ccusage prices against and the same rates the dashboard's FALLBACK_PRICING
 * carries.
 */

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  // Per-TTL cache-write split, when present. A 5-minute write costs 1.25x input;
  // a 1-hour write (ENABLE_PROMPT_CACHING_1H, which this fleet runs) costs 2x
  // input. Pricing the flat `cache_creation_input_tokens` at the 5m rate
  // understates the whole figure by a consistent ~16% vs ccusage; splitting by
  // TTL matches ccusage to the cent.
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
