/**
 * Per-group model policy (fork-owned): which model each role of a coworker
 * uses, and whether the group must run on open-weights models only.
 *
 * A coworker uses up to four models:
 *
 *   role    what it does                                   provider's own setting
 *   main    the doer (the agent itself)                    ANTHROPIC_MODEL / CODEX_MODEL / OPENCODE_MODEL / PI_MODEL
 *   small   titles, subagents, light work                  ANTHROPIC_DEFAULT_HAIKU_MODEL / OPENCODE_SMALL_MODEL
 *   router  the intent router hook, per user message       ANTHROPIC_DEFAULT_HAIKU_MODEL (Claude) / INTENT_ROUTER_OPENAI_MODEL
 *   critic  the codex reviewer (/codex-critique, the gate) CODEX_MODEL
 *
 * Before this module the router and the critic were install-wide, the Codex
 * doer ignored a group's `--model`, and `NANOCLAW_DEFAULT_MODEL` (a Claude id)
 * also became the OpenCode model of every group. This module resolves all four
 * roles for one group in one place; spawn writes the result into the
 * container's env (modelPolicyEnv), and `ncl groups config get/update` report
 * the same result, so what an operator sees is what the container runs.
 *
 * Resolution, per role: the group's own value (container_configs), else the
 * open-weights default when the group is `weights=open`, else the install's
 * setting for that provider. A group whose `weights` column is empty follows
 * the install default (installDefaultWeights), which is `open` unless the
 * install sets NANOCLAW_DEFAULT_WEIGHTS=any. A group with `weights=open` must resolve every
 * role to an open-weights model; modelPolicyViolations names any role that
 * does not, and spawn refuses the group rather than run it on a closed model.
 *
 * Consider an OpenCode group switched with
 * `ncl groups config update --id <g> --weights open`: main resolves to
 * `openai/nvidia/zai-org/glm-5.3` (OpenCode needs its provider prefix), small and
 * router to `nvidia/zai-org/glm-5.3-flash`, and critic to
 * `nvidia/moonshotai/kimi-k3`, unless the group or the install's
 * NANOCLAW_OPEN_*_MODEL settings name other open models.
 */

export type ModelWeights = 'any' | 'open';
export type ModelRole = 'main' | 'small' | 'router' | 'critic';
export const MODEL_ROLES: readonly ModelRole[] = ['main', 'small', 'router', 'critic'];

/** The container_configs columns the policy reads. */
export interface ModelPolicyRow {
  model?: string | null;
  small_model?: string | null;
  router_model?: string | null;
  critic_model?: string | null;
  weights?: string | null;
}

export interface ResolvedModels {
  provider: string;
  weights: ModelWeights;
  /** Model ids as each consumer receives them (OpenCode main/small carry the OpenCode provider prefix). */
  main?: string;
  small?: string;
  router?: string;
  critic?: string;
}

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The install settings the policy reads. The host receives the whole .env
 * through systemd, so spawn sees them all; a tool that resolves models outside
 * the host (scripts/open-weights-plan.ts) reads these keys from .env so that it
 * resolves what spawn would. A test keeps the list equal to the keys read here.
 */
export const MODEL_POLICY_ENV_KEYS = [
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_MODEL',
  'CODEX_MODEL',
  'DEFAULT_AGENT_PROVIDER',
  'INTENT_ROUTER_OPENAI_MODEL',
  'NANOCLAW_DEFAULT_MODEL',
  'NANOCLAW_DEFAULT_WEIGHTS',
  'NANOCLAW_OPEN_CRITIC_MODEL',
  'NANOCLAW_OPEN_MODEL',
  'NANOCLAW_OPEN_ROUTER_MODEL',
  'NANOCLAW_OPEN_SMALL_MODEL',
  'NANOCLAW_OPEN_WEIGHTS_PREFIXES',
  'OPENCODE_MODEL',
  'OPENCODE_PROVIDER',
  'OPENCODE_SMALL_MODEL',
  'PI_MODEL',
] as const;

// The fork's open-weights defaults on NVIDIA inference (operator decision,
// 2026-11-12): GLM for the doer, GLM flash for the small model and the router,
// Kimi for the critic.
const OPEN_DEFAULTS: Record<ModelRole, { env: string; id: string }> = {
  main: { env: 'NANOCLAW_OPEN_MODEL', id: 'nvidia/zai-org/glm-5.3' },
  small: { env: 'NANOCLAW_OPEN_SMALL_MODEL', id: 'nvidia/zai-org/glm-5.3-flash' },
  router: { env: 'NANOCLAW_OPEN_ROUTER_MODEL', id: 'nvidia/zai-org/glm-5.3-flash' },
  critic: { env: 'NANOCLAW_OPEN_CRITIC_MODEL', id: 'nvidia/moonshotai/kimi-k3' },
};

// Model id prefixes of open-weights families on NVIDIA inference. A model that
// matches none counts as closed: an unknown model must not pass an open-only rule.
const OPEN_WEIGHTS_PREFIXES = [
  'nvidia/zai-org/',
  'nvidia/moonshotai/',
  'nvidia/deepseek-ai/',
  'nvidia/qwen/',
  'nvidia/meta/',
  'nvidia/mistralai/',
  'nvidia/nvidia/',
];

const ROUTER_DEFAULT = 'openai/openai/gpt-6-luna'; // the intent-router hook's own default
const CRITIC_DEFAULT = 'openai/openai/gpt-6.1-sol'; // the codex config.toml template default

/**
 * Return a group's weights: its stored value, or the install default when the
 * column is empty; reject anything but "any" and "open".
 */
export function parseModelWeights(value: string | null | undefined, env: Env = process.env): ModelWeights {
  if (value === null || value === undefined || value === '') return installDefaultWeights(env);
  if (value === 'any' || value === 'open') return value;
  throw new Error(`weights must be "any" or "open", not "${value}"`);
}

/**
 * The weights of every group whose `weights` column is empty:
 * NANOCLAW_DEFAULT_WEIGHTS when set, else `open`. An install whose operator
 * chose Claude as the default provider (DEFAULT_AGENT_PROVIDER=claude, which
 * setup writes) gets `any` instead, because the Claude provider runs Claude
 * models only and an open default would stop every default group from starting.
 */
export function installDefaultWeights(env: Env = process.env): ModelWeights {
  const set = (env.NANOCLAW_DEFAULT_WEIGHTS ?? '').trim().toLowerCase();
  if (set === 'any' || set === 'open') return set;
  if (set) throw new Error(`NANOCLAW_DEFAULT_WEIGHTS must be "any" or "open", not "${set}"`);
  return (env.DEFAULT_AGENT_PROVIDER ?? '').trim().toLowerCase() === 'claude' ? 'any' : 'open';
}

/**
 * The provider of every group with no provider of its own (no session pin, no
 * `agent_groups.agent_provider`, no `container_configs.provider`):
 * DEFAULT_AGENT_PROVIDER when set, else OpenCode when the default weights are
 * open and Claude when they are any. With nothing set, a default group runs on
 * OpenCode with open-weights models.
 */
export function installDefaultProvider(env: Env = process.env): string {
  const set = (env.DEFAULT_AGENT_PROVIDER ?? '').trim().toLowerCase();
  if (set) return set;
  return installDefaultWeights(env) === 'open' ? 'opencode' : 'claude';
}

/**
 * The weights a new group records when its creator names its provider but no
 * weights: `any` for Claude, which runs Claude models only, and nothing (the
 * install default) for every other provider. Without it, a group created on
 * Claude would inherit an open default and fail the policy at its first spawn.
 */
export function creationWeights(provider: string | null | undefined): ModelWeights | null {
  return provider?.toLowerCase() === 'claude' ? 'any' : null;
}

/** The OpenCode provider prefix of model ids (the runner's default is "anthropic"). */
function openCodePrefix(env: Env): string {
  return env.OPENCODE_PROVIDER || 'anthropic';
}

/**
 * Return `id` as OpenCode expects it: `<OPENCODE_PROVIDER>/<model>`. OpenCode
 * reads the first path segment as its provider and sends the rest to the
 * endpoint, so a bare NVIDIA id such as `nvidia/zai-org/glm-5.3` would name a
 * provider "nvidia" that is not enabled, and every turn would fail.
 */
export function openCodeModelId(id: string, env: Env): string {
  const prefix = `${openCodePrefix(env)}/`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

/** Return the endpoint's model id, without OpenCode's provider prefix. */
function endpointModelId(provider: string, role: ModelRole, id: string, env: Env): string {
  if (provider === 'opencode' && (role === 'main' || role === 'small')) {
    const prefix = `${openCodePrefix(env)}/`;
    if (id.startsWith(prefix)) return id.slice(prefix.length);
  }
  return id;
}

/** The model id prefixes of open-weights families: the install's own list, else the built-in one. */
function openWeightsPrefixes(env: Env): readonly string[] {
  const configured = (env.NANOCLAW_OPEN_WEIGHTS_PREFIXES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : OPEN_WEIGHTS_PREFIXES;
}

/** True when `id` (an endpoint model id) belongs to an open-weights family. */
export function isOpenWeightsModel(id: string, env: Env = process.env): boolean {
  return openWeightsPrefixes(env).some((p) => id.startsWith(p));
}

/**
 * The open-weights model ids as globs (`*` matches any run of characters), for a gateway rule
 * that refuses every other model. Each prefix appears twice: as the endpoint knows the model,
 * and behind the `openai/` provider alias that some clients put in front of it.
 */
export function openWeightsModelGlobs(env: Env = process.env): string[] {
  const prefixes = openWeightsPrefixes(env);
  // isOpenWeightsModel reads a prefix literally, so a `*` in it must not become a wildcard here.
  const bad = prefixes.find((p) => p.includes('*'));
  if (bad) throw new Error(`NANOCLAW_OPEN_WEIGHTS_PREFIXES entry "${bad}" must not contain "*"`);
  return prefixes.flatMap((p) => [`${p}*`, `openai/${p}*`]);
}

/** The install's own setting for one role of one provider. */
function installDefault(provider: string, role: ModelRole, env: Env): string | undefined {
  switch (role) {
    case 'main':
      // Each provider keeps the order it had before this policy: the Claude and
      // OpenCode runners took NANOCLAW_DEFAULT_MODEL (container.json) over their
      // own setting, Codex never read it, and Pi read PI_MODEL first.
      if (provider === 'claude') return env.NANOCLAW_DEFAULT_MODEL || env.ANTHROPIC_MODEL || undefined;
      if (provider === 'codex') return env.CODEX_MODEL || undefined;
      if (provider === 'opencode') return env.NANOCLAW_DEFAULT_MODEL || env.OPENCODE_MODEL || undefined;
      if (provider === 'pi') return env.PI_MODEL || env.NANOCLAW_DEFAULT_MODEL || undefined;
      return env.NANOCLAW_DEFAULT_MODEL || undefined;
    case 'small':
      if (provider === 'claude') return env.ANTHROPIC_DEFAULT_HAIKU_MODEL || undefined;
      if (provider === 'opencode') return env.OPENCODE_SMALL_MODEL || undefined;
      return undefined;
    case 'router':
      // The Claude path of the hook calls /v1/messages with the Haiku setting.
      if (provider === 'claude') return env.ANTHROPIC_DEFAULT_HAIKU_MODEL || undefined;
      return env.INTENT_ROUTER_OPENAI_MODEL || ROUTER_DEFAULT;
    case 'critic':
      return env.CODEX_MODEL || CRITIC_DEFAULT;
  }
}

/** The container_configs column that holds each role's own model. */
export const MODEL_ROLE_COLUMNS: Record<ModelRole, 'model' | 'small_model' | 'router_model' | 'critic_model'> = {
  main: 'model',
  small: 'small_model',
  router: 'router_model',
  critic: 'critic_model',
};

/** True or false for a role's resolved model; null when the role has no model. */
export function isOpenWeightsRole(resolved: ResolvedModels, role: ModelRole, env: Env = process.env): boolean | null {
  const id = resolved[role];
  return id ? isOpenWeightsModel(endpointModelId(resolved.provider, role, id, env), env) : null;
}

/** Resolve all four roles for one group. */
export function resolveGroupModels(provider: string, row: ModelPolicyRow, env: Env = process.env): ResolvedModels {
  const weights = parseModelWeights(row.weights, env);
  const resolved: ResolvedModels = { provider, weights };
  for (const role of MODEL_ROLES) {
    const own = row[MODEL_ROLE_COLUMNS[role]];
    let id = typeof own === 'string' && own ? own : undefined;
    if (!id && weights === 'open') id = env[OPEN_DEFAULTS[role].env] || OPEN_DEFAULTS[role].id;
    if (!id) id = installDefault(provider, role, env);
    if (id && provider === 'opencode' && (role === 'main' || role === 'small')) id = openCodeModelId(id, env);
    if (id) resolved[role] = id;
  }
  // The Claude path of the router reads the same setting as the small model.
  if (provider === 'claude') resolved.router = resolved.small;
  return resolved;
}

/**
 * Return why a `weights=open` group may not run, one line per problem; empty
 * when the group may run. A Claude group cannot be open-weights: its SDK and
 * its router both call Claude models.
 */
export function modelPolicyViolations(resolved: ResolvedModels, env: Env = process.env): string[] {
  if (resolved.weights !== 'open') return [];
  if (resolved.provider === 'claude') {
    return [
      'the Claude provider runs Claude models only; switch the group with `ncl groups update --agent-provider opencode`',
    ];
  }
  const problems: string[] = [];
  for (const role of MODEL_ROLES) {
    if (isOpenWeightsRole(resolved, role, env) === false) {
      problems.push(`${role} model ${resolved[role]} is not an open-weights model`);
    }
  }
  return problems;
}

/**
 * Return the Claude Code settings of an open-weights container: every model
 * variable Claude Code reads names one of the group's open models, and Claude
 * Code's non-essential traffic is off.
 *
 * The host forwards the install's Claude settings (ANTHROPIC_MODEL, the
 * Opus/Sonnet/Haiku defaults, ANTHROPIC_FALLBACK_MODEL) from its .env into
 * every container (forkContainerEnv in container-runner.ts), because a Claude
 * group needs them. An OpenCode, Codex or Pi group with weights=open does not
 * run Claude Code itself, but a skill may start the `claude` CLI inside it, and
 * that CLI would then ask for the install's Claude model first. Consider an
 * OpenCode group with main model `openai/nvidia/zai-org/glm-5.3`: the main,
 * Opus, Sonnet and subagent variables become `nvidia/zai-org/glm-5.3` (the
 * endpoint's id, without OpenCode's provider prefix), and the Haiku,
 * small-fast and fallback variables become the small model
 * `nvidia/zai-org/glm-5.3-flash`, so the fallback differs from the main model
 * as the Claude SDK requires. CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC turns
 * off telemetry, error reporting and update checks, which go to closed-vendor
 * hosts.
 */
function openWeightsClaudeCodeEnv(resolved: ResolvedModels, env: Env): Record<string, string> {
  const { provider, main, small } = resolved;
  // resolveGroupModels gives every role of a weights=open group a model.
  if (!main || !small) throw new Error('an open-weights group resolves a main and a small model');
  const mainId = endpointModelId(provider, 'main', main, env);
  const smallId = endpointModelId(provider, 'small', small, env);
  return {
    ANTHROPIC_MODEL: mainId,
    ANTHROPIC_DEFAULT_OPUS_MODEL: mainId,
    ANTHROPIC_DEFAULT_SONNET_MODEL: mainId,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: smallId,
    ANTHROPIC_SMALL_FAST_MODEL: smallId,
    CLAUDE_CODE_SUBAGENT_MODEL: mainId,
    ANTHROPIC_FALLBACK_MODEL: smallId,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  };
}

/**
 * The env one container needs so each role uses its resolved model. `env` is
 * the install's settings, read for OpenCode's provider prefix.
 */
export function modelPolicyEnv(resolved: ResolvedModels, env: Env = process.env): Record<string, string> {
  const out: Record<string, string> = { NANOCLAW_MODEL_WEIGHTS: resolved.weights };
  const { provider, weights, main, small, router, critic } = resolved;
  if (critic) out.NANOCLAW_CRITIC_MODEL = critic;
  // The Codex tool inside a container starts every turn on CODEX_MODEL unless the caller names a
  // model, and an install keeps a closed model there for its closed groups. An open-weights group
  // therefore gets its critic model as CODEX_MODEL, so a plain `codex` call stays on open weights.
  // A Codex group already sets CODEX_MODEL from its own main model below.
  if (weights === 'open' && critic && provider !== 'codex') out.CODEX_MODEL = critic;
  // modelPolicyViolations refuses a Claude group with weights=open, so an
  // open-weights container never runs the Claude provider.
  if (weights === 'open' && provider !== 'claude') Object.assign(out, openWeightsClaudeCodeEnv(resolved, env));
  if (provider === 'claude') {
    // One Claude setting serves the small model and the router.
    if (small) out.ANTHROPIC_DEFAULT_HAIKU_MODEL = small;
    return out;
  }
  if (router) out.INTENT_ROUTER_OPENAI_MODEL = router;
  if (provider === 'opencode') {
    if (main) out.OPENCODE_MODEL = main;
    if (small) out.OPENCODE_SMALL_MODEL = small;
  } else if (provider === 'codex') {
    if (main) out.CODEX_MODEL = main;
  } else if (provider === 'pi') {
    if (main) out.PI_MODEL = main;
  }
  return out;
}

/**
 * The `model` that container.json carries for a group. The runners read it
 * before their own env setting, so for a non-Claude group it must be the
 * policy's main model; otherwise an install-wide NANOCLAW_DEFAULT_MODEL would
 * override a weights=open group's open default. A Claude group keeps the value
 * it had before this policy.
 */
export function containerJsonModel(
  provider: string,
  row: ModelPolicyRow,
  defaultModel: string,
  env: Env = process.env,
): string | undefined {
  if (provider === 'claude') return row.model || defaultModel || undefined;
  return resolveGroupModels(provider, row, env).main;
}
