/**
 * Per-session CODEX cost — pricing + rollout parsing for the Sessions tab.
 *
 * The sibling of `session-costs.ts`, for the other half of a session's spend.
 * `session-costs.ts` prices Claude transcripts under `.claude-shared/projects/`;
 * this module prices the Codex rollout files under a session's own
 * `codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. Both feed the SAME
 * `SessionCostEntry` (`claudeUsd` + `codexUsd` = `cost`).
 *
 * Why this exists: the `codex-critique` container skill calls
 * `mcp__codex__codex` / `mcp__codex__codex-reply` as a plain MCP tool — NOT as a
 * Claude subagent — so none of its token usage ever appears in the Claude
 * transcript. Before this module the Sessions cost column silently excluded
 * every dollar a codex-heavy session spent (github issue #1327).
 *
 * Unlike Claude transcripts (shared per GROUP under `.claude-shared/`, needing
 * `sdk_session_routes` to attribute a file to a session), Codex rollouts already
 * live under the session directory — `src/providers/codex.ts` mounts
 * `<sessionDir>/codex` as the container's `CODEX_HOME`. So the join is the path
 * itself; no route table is involved.
 *
 * ── Everything below was derived empirically against `ccusage codex daily
 *    --json --offline` on prod (slang-coworkers), not from documentation ──
 *
 * RATES. Keyed by BASE model id. Sourced from LiteLLM's
 * `model_prices_and_context_window.json` (the same table ccusage prices
 * against). The fleet's wire model ids carry a doubled gateway prefix
 * (`azure/openai/gpt-5.6-sol`, `openai/openai/gpt-5.5`); ccusage resolves those
 * to the AZURE LiteLLM entry, which for `gpt-5.6-sol` is materially more
 * expensive than the bare OpenAI entry (5e-6 vs 4e-6 input). Verified: a real
 * prod session-day priced with the azure rates reproduces ccusage's `costUSD` to
 * the 1e-9 (173343*5e-6 + 3040319*5e-7 + 29760*3e-5 = 3.2796745, ccusage:
 * 3.2796745000000005) — the bare-OpenAI rates give 2.50, which is wrong.
 *
 * CACHE WRITES ARE NOT BILLED SEPARATELY. Rollouts carry
 * `cache_write_input_tokens`, and ccusage reports `cacheCreationTokens: 0` for
 * every codex day even when that field is large (169003 on one verified
 * session). The azure LiteLLM entries carry no `cache_creation_input_token_cost`
 * at all. So a cache write is priced as ordinary input, exactly once, and there
 * is no separate cache-creation term here (contrast `session-costs.ts`, where
 * Anthropic's TTL-split cache writes are a real and large line item).
 *
 * INPUT IS INCLUSIVE OF CACHED. `input_tokens` in a rollout mirrors the raw
 * OpenAI field and already contains `cached_input_tokens` (same invariant
 * `normalizeCodexEntry` in server.ts documents for the Overview feed). Uncached
 * input is therefore `input_tokens - cached_input_tokens`.
 *
 * REASONING TOKENS ARE INSIDE OUTPUT. `reasoning_output_tokens` is a subset of
 * `output_tokens`; adding it would double-bill.
 *
 * DEDUPE IS REQUIRED, AND IT IS CROSS-FILE. A codex subagent spawn
 * (`payload.source.subagent.thread_spawn`, with `forked_from_id`) writes its own
 * rollout file that REPLAYS the parent thread's already-billed turns. Summing
 * each file's final cumulative `total_token_usage` therefore double-counts the
 * forked prefix — measured +13.7% on one verified prod session-day (3.73 vs
 * ccusage's 3.28). ccusage dedupes by the usage tuple; so do we, across the
 * whole session.
 *
 * The key is the usage tuple and nothing else, because a `token_count` event
 * carries no request/turn/thread id to key on. That means two GENUINELY distinct
 * calls with byte-identical token counts collapse into one. That is a real
 * (conservative — it can only UNDER-report) limitation, and it was measured
 * rather than assumed: over 40 random prod sessions / 54 session-days, against
 * `ccusage codex daily --json --offline`,
 *
 *     rule                                  session-days matching ccusage's tokens
 *     no dedupe                                            35 / 54
 *     dedupe within a fork LINEAGE only                     36 / 54
 *     dedupe by usage tuple, session-wide (this one)        54 / 54
 *
 * The narrower fork-lineage rule is the one you would design from first
 * principles, and it is worse: ccusage collapses repeats regardless of lineage,
 * so scoping the dedupe diverges from the Overview's number on 18 of 54
 * session-days. Reconciling with ccusage is this module's whole point, so the
 * session-wide tuple rule wins.
 *
 * KNOWN RESIDUAL. With that rule our TOKEN attribution matches ccusage on 54/54
 * session-days and our COST matches on 50/54. The 4 outliers (all one session)
 * are 3–24% BELOW ccusage's `costUSD` — but our cost is a pure function of the
 * very token totals ccusage itself reports, priced at the rates ccusage itself
 * resolves, so on those days ccusage's own cost exceeds what its own published
 * token totals imply. Ruled out as causes: the LiteLLM >272k tier (on per-call
 * input, on input+output, and on the cumulative), cache writes at any flat rate,
 * and reasoning tokens billed on top of output. Treat the column as a tight
 * lower bound on codex spend.
 *
 * DRIFT. The agent-runner needs this same table for LIVE cost-cap enforcement
 * (issue #1327's runner half), and cannot import it: the container image only
 * ever contains `container/agent-runner/`, so nothing under `dashboard/` (or a
 * hypothetical `src/shared/`) is resolvable inside it. The table is therefore
 * duplicated there, guarded the same way `MODEL_PRICING` is guarded against
 * `FALLBACK_PRICING` — by a test that fails if the two copies disagree
 * (`codex-costs.test.ts`, "agrees with the agent-runner's copy").
 */

export interface CodexModelRate {
  /** Per-token cost of UNCACHED input (`input_tokens - cached_input_tokens`). */
  input: number;
  /** Per-token cost of output (reasoning tokens included — they are a subset). */
  output: number;
  /** Per-token cost of a cache read (`cached_input_tokens`). */
  cacheRead: number;
}

/**
 * Keyed by BASE model id (no provider prefix). `normalizeCodexModel()` maps
 * every wire variant onto one of these; anything unrecognized resolves to '' so
 * the caller can flag it unpriced rather than silently report $0.
 *
 * Values are the LiteLLM `azure/<model>` entries — see the module doc comment
 * for why azure and not the bare OpenAI entry. For every model here EXCEPT
 * `gpt-5.6-sol` the two LiteLLM variants happen to carry identical rates, so the
 * choice only actually moves a number for the family the fleet runs today.
 */
export const CODEX_MODEL_PRICING: Record<string, CodexModelRate> = {
  // gpt-5.6 family (azure entries) — the fleet's current codex-critique models.
  'gpt-5.6-sol': { input: 5e-6, output: 3e-5, cacheRead: 5e-7 },
  'gpt-5.6': { input: 5e-6, output: 3e-5, cacheRead: 5e-7 },
  'gpt-5.6-terra': { input: 2e-6, output: 1.2e-5, cacheRead: 2e-7 },
  'gpt-5.6-luna': { input: 2e-7, output: 1.2e-6, cacheRead: 2e-8 },
  // gpt-5.5 — seen in prod rollouts as `openai/openai/gpt-5.5`.
  'gpt-5.5': { input: 5e-6, output: 3e-5, cacheRead: 5e-7 },
  // codex-tuned models, also observed in prod rollouts.
  'gpt-5.2-codex': { input: 1.75e-6, output: 1.4e-5, cacheRead: 1.75e-7 },
  'gpt-5.1-codex': { input: 1.25e-6, output: 1e-5, cacheRead: 1.25e-7 },
  'gpt-5-codex': { input: 1.25e-6, output: 1e-5, cacheRead: 1.25e-7 },
};

/**
 * Reduce a rollout's wire model id to its base pricing key.
 *
 * Handles the doubled-prefix forms the OneCLI gateway actually emits
 * (`azure/openai/gpt-5.6-sol`, `openai/openai/gpt-5.5`) plus bare ids
 * (`gpt-5.2-codex`) and dated snapshots (`gpt-5.6-sol-20260101`). Returns '' for
 * anything unpriced so the caller raises the `*` marker instead of reporting a
 * confident $0.
 */
export function normalizeCodexModel(model: string | undefined): string {
  if (!model) return '';
  // Only the last path segment names the model; everything before it is
  // provider routing (`azure/`, `openai/`, `azure/openai/`, `nvinference/`, …).
  let m = model.trim().toLowerCase().split('/').pop() || '';
  if (CODEX_MODEL_PRICING[m]) return m;
  const undated = m.replace(/-\d{8}$/, '');
  if (CODEX_MODEL_PRICING[undated]) return undated;
  m = m.replace(/-latest$/, '');
  if (CODEX_MODEL_PRICING[m]) return m;
  return '';
}

/** One `token_count` reading — the shape both `total_token_usage` and `last_token_usage` use. */
export interface CodexTokenUsage {
  /** TOTAL input, INCLUSIVE of `cached_input_tokens`. */
  input_tokens?: number;
  cached_input_tokens?: number;
  /** Present in rollouts, but never billed separately — see the module doc comment. */
  cache_write_input_tokens?: number;
  output_tokens?: number;
  /** A SUBSET of `output_tokens`; never added on top. */
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

/** Dollar cost of one codex call's usage. Unpriced (unknown) model → 0. */
export function priceCodexUsage(model: string | undefined, u: CodexTokenUsage): number {
  const rate = CODEX_MODEL_PRICING[normalizeCodexModel(model)];
  if (!rate) return 0;
  const cached = u.cached_input_tokens || 0;
  // `input_tokens` includes the cached subset; bill the remainder at input rate.
  const uncached = Math.max(0, (u.input_tokens || 0) - cached);
  return uncached * rate.input + cached * rate.cacheRead + (u.output_tokens || 0) * rate.output;
}

/**
 * Billable token count for one codex call — `input_tokens + output_tokens`,
 * which is exactly the rollout's own `total_tokens` and ccusage's `totalTokens`.
 * Cache writes and reasoning tokens are already inside those two.
 */
export function codexUsageTokens(u: CodexTokenUsage): number {
  return (u.input_tokens || 0) + (u.output_tokens || 0);
}

/**
 * The cross-file dedupe key. A subagent thread-spawn rollout replays its
 * parent's turns verbatim, so the same billed call shows up in more than one
 * file with an identical usage tuple; ccusage collapses those and so do we.
 * Model is part of the key so two different models that happen to land on the
 * same token counts stay distinct.
 */
export function codexUsageKey(model: string | undefined, u: CodexTokenUsage): string {
  return [
    normalizeCodexModel(model) || (model || '').trim().toLowerCase(),
    u.input_tokens || 0,
    u.cached_input_tokens || 0,
    u.output_tokens || 0,
  ].join('|');
}

/** One priced call extracted from a rollout file. */
export interface CodexRolloutEvent {
  /** ISO day key `YYYYMMDD` from the event's own timestamp (matches ccusage's day attribution). */
  dayKey: string | null;
  model: string;
  usage: CodexTokenUsage;
}

/**
 * Extract every billable `token_count` reading from one rollout file's contents.
 *
 * Rollout lines are `{timestamp, type, payload}`. The model comes from the
 * `turn_context` (and `session_meta`) payloads that precede the readings; the
 * readings themselves are `payload.type === 'token_count'` with
 * `payload.info.last_token_usage` holding THIS call's delta (and
 * `total_token_usage` the running cumulative). We use the per-call delta so the
 * cross-file dedupe can drop an individual replayed call — the deltas of a file
 * sum to its final cumulative, so nothing is lost for un-forked files.
 *
 * Pure and synchronous: the caller owns the file walking, caching and the
 * session-wide dedupe.
 */
export function parseCodexRollout(content: string): CodexRolloutEvent[] {
  const out: CodexRolloutEvent[] = [];
  let model = '';
  for (const line of content.split('\n')) {
    // Cheap pre-filter: only lines that could carry a model or a reading.
    if (line.indexOf('"model"') < 0 && line.indexOf('"token_count"') < 0) continue;
    let r: {
      timestamp?: string;
      payload?: { type?: string; model?: string; info?: { last_token_usage?: CodexTokenUsage } };
    };
    try {
      r = JSON.parse(line);
    } catch {
      continue;
    }
    const p = r.payload;
    if (!p || typeof p !== 'object') continue;
    if (typeof p.model === 'string' && p.model) model = p.model;
    if (p.type !== 'token_count') continue;
    const usage = p.info?.last_token_usage;
    if (!usage || typeof usage !== 'object') continue;
    if (!usage.input_tokens && !usage.cached_input_tokens && !usage.output_tokens) continue;
    out.push({
      dayKey: typeof r.timestamp === 'string' && r.timestamp.length >= 10 ? r.timestamp.slice(0, 10).replace(/-/g, '') : null,
      model,
      usage,
    });
  }
  return out;
}
