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
 * setting for that provider. A group with `weights=open` must resolve every
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
  'INTENT_ROUTER_OPENAI_MODEL',
  'NANOCLAW_DEFAULT_MODEL',
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

/** Return `weights` as stored, defaulting to "any"; reject anything else. */
export function parseModelWeights(value: string | null | undefined): ModelWeights {
  if (value === null || value === undefined || value === '' || value === 'any') return 'any';
  if (value === 'open') return 'open';
  throw new Error(`weights must be "any" or "open", not "${value}"`);
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

/** True when `id` (an endpoint model id) belongs to an open-weights family. */
export function isOpenWeightsModel(id: string, env: Env = process.env): boolean {
  const configured = (env.NANOCLAW_OPEN_WEIGHTS_PREFIXES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const prefixes = configured.length > 0 ? configured : OPEN_WEIGHTS_PREFIXES;
  return prefixes.some((p) => id.startsWith(p));
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
  const weights = parseModelWeights(row.weights);
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

/** The env one container needs so each role uses its resolved model. */
export function modelPolicyEnv(resolved: ResolvedModels): Record<string, string> {
  const env: Record<string, string> = { NANOCLAW_MODEL_WEIGHTS: resolved.weights };
  const { provider, main, small, router, critic } = resolved;
  if (critic) env.NANOCLAW_CRITIC_MODEL = critic;
  if (provider === 'claude') {
    // One Claude setting serves the small model and the router.
    if (small) env.ANTHROPIC_DEFAULT_HAIKU_MODEL = small;
    return env;
  }
  if (router) env.INTENT_ROUTER_OPENAI_MODEL = router;
  if (provider === 'opencode') {
    if (main) env.OPENCODE_MODEL = main;
    if (small) env.OPENCODE_SMALL_MODEL = small;
  } else if (provider === 'codex') {
    if (main) env.CODEX_MODEL = main;
  } else if (provider === 'pi') {
    if (main) env.PI_MODEL = main;
  }
  return env;
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
