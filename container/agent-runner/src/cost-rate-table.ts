/**
 * Versioned rate snapshot for the durable ledger (#65).
 *
 * PHASE 1 (`rate_version = 1`) is built from the CURRENT enforcement pricing
 * tables (`pricing.ts` MODEL_PRICING for Claude, `codex-cost.ts`
 * CODEX_MODEL_PRICING for codex), reshaped into the LiteLLM per-token shape.
 * Using the same rates the live counter uses makes the dual-run ledger's dollars
 * reconcile with `costSpentUsd` to the cent, which is how we validate TOKEN
 * capture first (tokens are the durable part; dollars are a view).
 *
 * PHASE 2 (`rate_version = 2`) will be a real snapshot of LiteLLM's
 * `model_prices_and_context_window.json` — a VISIBLE reprice, applied only after
 * token capture is validated, and repricing history from the stored tokens (no
 * dollar watermark to strand). Per-model, never a tier assumption.
 */
import { CODEX_MODEL_PRICING } from './codex-cost.js';
import type { LiteLLMRateTable } from './cost-events.js';
import { MODEL_PRICING } from './pricing.js';

export const RATE_VERSION = 1;

export const RATE_TABLE: LiteLLMRateTable = buildRateTable();

function buildRateTable(): LiteLLMRateTable {
  const t: LiteLLMRateTable = {};
  // Claude — the fleet's 1h cache premium (input×2) is applied by priceTokens on
  // the 1h split; `cache_creation_input_token_cost` is the base/5m rate.
  for (const [m, r] of Object.entries(MODEL_PRICING)) {
    t[m] = {
      input_cost_per_token: r.input,
      output_cost_per_token: r.output,
      cache_read_input_token_cost: r.cacheRead,
      cache_creation_input_token_cost: r.cacheCreate,
    };
  }
  // Codex — no cache-write tier.
  for (const [m, r] of Object.entries(CODEX_MODEL_PRICING)) {
    t[m] = {
      input_cost_per_token: r.input,
      output_cost_per_token: r.output,
      cache_read_input_token_cost: r.cacheRead,
    };
  }
  return t;
}
