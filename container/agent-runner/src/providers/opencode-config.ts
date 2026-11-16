import fs from 'fs';
import path from 'path';

import type { ProviderOptions } from './types.js';
import type { ResolvedRuntimeConfiguration, RuntimeInferenceInput } from '../provider-contracts/registry.js';
import { isPrimaryClone } from '../refresh-clones.js';
import { mcpServersToOpenCodeConfig } from './mcp-to-opencode.js';
import { openCodeInstructionsPath } from './opencode-memory.js';
import { OPENCODE_CREDENTIAL_PLACEHOLDER } from './opencode-auth.js';
const MODEL_INPUT_MODALITIES = ['text', 'audio', 'image', 'video', 'pdf'] as const;
const AGENT_DIR = '/workspace/agent';

export function buildOpenCodeServerEnv(
  config: Record<string, unknown>,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    // With models.opencode.ai unreachable (egress lockdown) a cold OpenCode
    // never ran a turn; with the fetch off it uses its bundled model snapshot.
    OPENCODE_DISABLE_MODELS_FETCH: 'true',
    ...environment,
    OPENCODE_DISABLE_PROJECT_CONFIG: 'true',
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
  };
}
function log(message: string): void {
  console.error(`[opencode-provider] ${message}`);
}

// A limit env var must be a bare positive integer (a token count) — units
// ("64k"), blank strings, zero, and negatives are rejected rather than
// coerced: Number() would turn blank into 0 (silently disables compaction,
// see below) and "64k" into NaN (the emitted config becomes unparseable
// JSON, and OpenCode fails to start). Invalid input is treated as unset.
function parseLimitEnv(varName: string, raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(Number(trimmed)) || Number(trimmed) <= 0) {
    log(`Ignoring invalid ${varName}: "${raw}"`);
    return undefined;
  }
  return Number(trimmed);
}

// The most tokens OpenCode 1.18 asks for in one response (OUTPUT_TOKEN_MAX in
// its provider transform); OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX replaces it.
const OPENCODE_OUTPUT_TOKEN_MAX = 32_000;

/**
 * Return the response budget OpenCode itself requests for a model, so the
 * Chat Completions endpoint can be told the same number as
 * `max_completion_tokens`. OpenCode computes it as the model's declared output
 * limit capped at its own maximum, or that maximum when the model declares
 * none: `Math.min(limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX`.
 *
 * Why the endpoint needs it: OpenCode sends the number only as `max_tokens`,
 * and the NVIDIA inference endpoint ignores that field and ends every response
 * at 4096 tokens, reasoning included. A GLM 5.3 step that reasons at length
 * then stops with finish reason "length" and no text. With
 * `max_completion_tokens` in the request, the same prompt ran to 14,272
 * output tokens and a normal stop (measured on prod, 2026-11-16).
 */
function openCodeResponseTokens(declaredOutput: number | undefined, environment: NodeJS.ProcessEnv): number {
  const cap =
    parseLimitEnv('OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX', environment.OPENCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX) ??
    OPENCODE_OUTPUT_TOKEN_MAX;
  return Math.min(declaredOutput ?? 0, cap) || cap;
}

export function resolveOpenCodeInference(
  input: RuntimeInferenceInput,
  environment: NodeJS.ProcessEnv,
): Record<string, unknown> {
  const provider = environment.OPENCODE_PROVIDER || 'anthropic';
  const model = input.model ?? environment.OPENCODE_MODEL;
  const smallModel = environment.OPENCODE_SMALL_MODEL;
  // Reasoning effort from the group's container config (ncl groups config
  // update --effort). OpenCode forwards a free-form per-model `options` object
  // to the ai-sdk provider, which maps reasoningEffort onto reasoning_effort in
  // the request body.
  const effort = input.effort;
  // New installs own their endpoint setting. The explicit native value
  // suppresses the historical shared-variable fallback without editing it.
  const endpoint = environment.OPENCODE_BASE_URL ?? environment.ANTHROPIC_BASE_URL;
  const proxyUrl = endpoint === 'native' ? undefined : endpoint;

  const stripProviderPrefix = (value: string | undefined) =>
    value?.startsWith(`${provider}/`) ? value.slice(provider.length + 1) : value;
  const providerModelId = stripProviderPrefix(model);
  const providerSmallModelId = stripProviderPrefix(smallModel);
  const modelsToRegister = [providerModelId, providerSmallModelId]
    .filter(Boolean)
    .filter((mid, i, a) => a.indexOf(mid as string) === i);

  // OpenCode auto-compacts a session once tokens >= limit.context - maxOutputTokens.
  // Undeclared custom models resolve limit.context to 0, which silently disables
  // compaction and kills long sessions against a fixed-window backend (e.g. vLLM).
  // Absent these env vars, behavior is unchanged (no `limit` key emitted).
  const contextLimitEnv = environment.OPENCODE_MODEL_CONTEXT_LIMIT;
  const outputLimitEnv = environment.OPENCODE_MODEL_OUTPUT_LIMIT;
  const contextLimit = parseLimitEnv('OPENCODE_MODEL_CONTEXT_LIMIT', contextLimitEnv);
  const outputLimit = parseLimitEnv('OPENCODE_MODEL_OUTPUT_LIMIT', outputLimitEnv);
  if (outputLimitEnv !== undefined && contextLimit === undefined) {
    log('Ignoring OPENCODE_MODEL_OUTPUT_LIMIT: no valid OPENCODE_MODEL_CONTEXT_LIMIT to pair it with');
  }
  const modelLimit =
    contextLimit !== undefined
      ? { context: contextLimit, ...(outputLimit !== undefined ? { output: outputLimit } : {}) }
      : undefined;

  // OpenCode drops every non-text file part whose modality the model does not
  // declare: the provider transform keeps a part only when the model advertises
  // that input modality, and otherwise substitutes
  // `ERROR: Cannot read … (this model does not support <modality> input)`.
  // A registry-unknown custom model resolves each of those flags to false
  // (provider/provider.ts:1154-1158), so an image reaches the session store but
  // never the model — live-confirmed on a vLLM-hosted model, which answered
  // that it does not support image input while the prompt carried zero image
  // tokens. Declaring the modalities is the only thing that opens that gate;
  // `attachment` is a registry/UI flag rather than a pipeline gate, but it is
  // set alongside so the entry stays internally consistent.
  // Absent this env var, behavior is unchanged (no capability keys emitted).
  const modalityEnv = environment.OPENCODE_MODEL_INPUT_MODALITIES;
  const requestedModalities = (modalityEnv ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry, i, a) => a.indexOf(entry) === i)
    .filter((entry) => {
      if ((MODEL_INPUT_MODALITIES as readonly string[]).includes(entry)) return true;
      log(`Ignoring unknown OPENCODE_MODEL_INPUT_MODALITIES entry: ${entry}`);
      return false;
    })
    .filter((entry) => entry !== 'text');
  const modelModalities =
    requestedModalities.length > 0 ? { input: ['text', ...requestedModalities], output: ['text'] } : undefined;

  // A custom base URL on the `openai` provider selects the Chat Completions
  // transport (see `npm` below). On that transport each registered model also
  // tells the endpoint its response budget as `max_completion_tokens`
  // (openCodeResponseTokens); OpenCode passes unknown model options into the
  // request body. The main model's budget follows its declared output limit;
  // a distinct small model declares none.
  const chatCompletions = provider === 'openai' && Boolean(proxyUrl);
  const modelOptions = (isMainModel: boolean): Record<string, unknown> | undefined => {
    const options: Record<string, unknown> = {
      ...(isMainModel && effort ? { reasoningEffort: effort } : {}),
      ...(chatCompletions
        ? { max_completion_tokens: openCodeResponseTokens(isMainModel ? modelLimit?.output : undefined, environment) }
        : {}),
    };
    return Object.keys(options).length > 0 ? options : undefined;
  };

  // Native API providers also need a placeholder to become connected before
  // any HTTP request reaches the selected gateway. Model options do not depend on baseURL.
  const providerOptions: Record<string, unknown> = {
    [provider]: {
      // A custom base URL on the `openai` provider means a self-hosted
      // OpenAI-compatible endpoint (vLLM, llama.cpp, …). The stock openai
      // SDK package speaks the Responses API, whose multi-turn history
      // vLLM rejects (assistant items lack id/status) — pin the Chat
      // Completions transport. Scoped to `openai` only: other providers
      // (e.g. `openrouter`, set alongside ANTHROPIC_BASE_URL per the
      // documented OpenRouter config) ship their own native ai-sdk
      // package and must keep OpenCode's default transport resolution.
      ...(chatCompletions ? { npm: '@ai-sdk/openai-compatible' } : {}),
      options: { apiKey: OPENCODE_CREDENTIAL_PLACEHOLDER, ...(proxyUrl ? { baseURL: proxyUrl } : {}) },
      ...(modelsToRegister.length > 0
        ? {
            models: Object.fromEntries(
              modelsToRegister.map((mid) => {
                // limit/modalities describe the MAIN model only — the env
                // vars name no small-model equivalent. Spreading them onto
                // a distinct OPENCODE_SMALL_MODEL entry would falsely
                // declare its context window and media support as the
                // main model's own. A small model that differs from the
                // main one gets a bare entry instead, which resolves
                // through OpenCode's own undeclared-model default.
                const isMainModel = mid === providerModelId;
                const options = modelOptions(isMainModel);
                return [
                  mid,
                  {
                    id: mid,
                    name: mid,
                    tool_call: true,
                    ...(options ? { options } : {}),
                    ...(isMainModel && modelLimit ? { limit: modelLimit } : {}),
                    ...(isMainModel && modelModalities ? { attachment: true, modalities: modelModalities } : {}),
                  },
                ];
              }),
            ),
          }
        : {}),
    },
  };

  return {
    ...(model ? { model } : {}),
    ...(smallModel ? { small_model: smallModel } : {}),
    enabled_providers: [provider],
    provider: providerOptions,
  };
}

/**
 * The configured `provider/model` as the prompt API names it. OpenCode stores
 * the model a session was created with and reuses it on resume, so a group
 * whose backend or model changed would keep prompting the old one and fail
 * with "Model not found"; naming the model on every prompt makes the current
 * configuration apply to the next turn. Undefined leaves OpenCode's default.
 */
export function resolveOpenCodePromptModel(
  inference: Record<string, unknown>,
): { providerID: string; modelID: string } | undefined {
  const model = inference.model;
  if (typeof model !== 'string') return undefined;
  const slash = model.indexOf('/');
  if (slash <= 0 || slash === model.length - 1) return undefined;
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}

// OpenCode's interactive question tool cannot wait for an answer in a headless runner.
export function resolveOpenCodeExecutionPolicy(): Record<string, unknown> {
  return {
    read: 'allow',
    edit: 'allow',
    glob: 'allow',
    grep: 'allow',
    list: 'allow',
    bash: 'allow',
    task: 'allow',
    external_directory: 'allow',
    todowrite: 'allow',
    question: 'deny',
    webfetch: 'allow',
    websearch: 'allow',
    codesearch: 'allow',
    lsp: 'allow',
    doom_loop: 'allow',
    skill: 'allow',
  };
}

// Core's human-question tool waits up to five minutes. This request budget
// leaves room for delivery/polling.
const MCP_REQUEST_TIMEOUT_MS = 330_000;

// OpenCode 1.18 reads one per-server `timeout` for both connecting and each
// request. Without it, connecting gets 30 s, which a slow server misses
// (slang-mcp answers initialize in ~33 s), so every server gets the request
// budget for both.
function withMcpTimeout(servers: Record<string, unknown>): Record<string, unknown> {
  const timeout =
    parseLimitEnv('OPENCODE_MCP_TIMEOUT_MS', process.env.OPENCODE_MCP_TIMEOUT_MS) ?? MCP_REQUEST_TIMEOUT_MS;
  return Object.fromEntries(
    Object.entries(servers).map(([name, server]) => [name, { timeout, ...(server as Record<string, unknown>) }]),
  );
}

export function buildOpenCodeConfig(
  options: ProviderOptions,
  configuration?: ResolvedRuntimeConfiguration,
): Record<string, unknown> {
  const inference = (configuration?.inference ?? resolveOpenCodeInference(options, process.env)) as Record<
    string,
    unknown
  >;
  return {
    ...inference,
    permission: configuration ? configuration.executionPolicy : resolveOpenCodeExecutionPolicy(),
    mcp: withMcpTimeout(
      (configuration ? configuration.mcpServers : mcpServersToOpenCodeConfig(options.mcpServers)) as Record<
        string,
        unknown
      >,
    ),
    autoupdate: false,
    snapshot: false,
    experimental: { mcp_timeout: MCP_REQUEST_TIMEOUT_MS },
    // The runner renders this file once per turn. Native steps, compaction
    // continuation and Task children reread it through the instructions pipeline.
    // withCloneClaudeMdInstructions adds the guides of cloned repositories
    // when the server spawns.
    instructions: [`${AGENT_DIR}/CLAUDE.md`, `${AGENT_DIR}/CLAUDE.local.md`, openCodeInstructionsPath()],
  };
}

/**
 * Return `config` with the CLAUDE.md files from `cloneClaudeMdPaths` added
 * after its existing instructions. OpenCode reads each instructions file on
 * every model call, so a later pull of a clone reaches the next call; the
 * list of files is fixed when the server spawns.
 */
export function withCloneClaudeMdInstructions(
  config: Record<string, unknown>,
  agentDir: string = AGENT_DIR,
): Record<string, unknown> {
  const guides = cloneClaudeMdPaths(agentDir);
  if (guides.length === 0) return config;
  return { ...config, instructions: [...(config.instructions as string[]), ...guides] };
}

/**
 * Return the CLAUDE.md of each repository cloned directly under `agentDir`
 * that OpenCode would otherwise skip. OpenCode reads one instructions file
 * per folder and takes AGENTS.md before CLAUDE.md, so it skips CLAUDE.md when
 * AGENTS.md is in the same folder. Claude Code read CLAUDE.md, and a
 * repository that has both files often keeps its full guide in CLAUDE.md.
 *
 * A folder qualifies when all of these hold:
 *   - Its `.git` is a directory. A linked worktree (`.git` is a file) is
 *     another checkout of a clone, and its copy of the guide would load the
 *     same text once per worktree.
 *   - It has both files, and they are different files. With CLAUDE.md alone,
 *     OpenCode finds it without help; when one name links to the other,
 *     OpenCode already reads that text as AGENTS.md.
 *   - Its `origin` is a remote URL, and no folder earlier in name order
 *     clones a repository of the same name. Agents make per-task copies of a
 *     repository, cloned from a local path or from the same remote, and a
 *     group can hold many of them; the guide loads once.
 *
 * We add the file as is and do not expand its `@path` import lines, because
 * an import of the sibling AGENTS.md would load that file a second time.
 *
 * For example, `tool/` (origin https://github.com/acme/tool.git) qualifies;
 * `tool-bisect/` with the same origin, `wt-123/` cloned from
 * `/workspace/agent/tool`, and the linked worktree `wt-tool-456/` do not.
 */
export function cloneClaudeMdPaths(agentDir: string = AGENT_DIR): string[] {
  if (!fs.existsSync(agentDir)) return [];
  const guideByRepository = new Map<string, string>();
  for (const entry of fs.readdirSync(agentDir).sort()) {
    const clone = path.join(agentDir, entry);
    if (!isPrimaryClone(clone)) continue;
    const claudeMd = path.join(clone, 'CLAUDE.md');
    const agentsMd = path.join(clone, 'AGENTS.md');
    if (!fs.existsSync(claudeMd) || !fs.existsSync(agentsMd)) continue;
    if (fs.realpathSync(claudeMd) === fs.realpathSync(agentsMd)) continue;
    const repository = remoteRepositoryName(originUrl(clone));
    if (repository === undefined || guideByRepository.has(repository)) continue;
    guideByRepository.set(repository, claudeMd);
  }
  return [...guideByRepository.values()];
}

/**
 * Return the `remote.origin.url` of a clone, read from its `.git/config`, or
 * undefined when it has none. We read the file rather than run `git config`
 * because a group can hold hundreds of clones, and under Bun a synchronous
 * child process can miss its exit and hang (see runHookCommand).
 */
function originUrl(clone: string): string | undefined {
  let config: string;
  try {
    config = fs.readFileSync(path.join(clone, '.git', 'config'), 'utf-8');
  } catch {
    return undefined;
  }
  let section = '';
  for (const raw of config.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('[')) {
      section = line;
      continue;
    }
    const url = /^url\s*=\s*(.+)$/.exec(line);
    if (section === '[remote "origin"]' && url) return url[1];
  }
  return undefined;
}

/**
 * Return the repository name of a remote URL, such as `tool` for both
 * `https://token@github.com/acme/tool.git` and `git@github.com:acme/tool`,
 * or undefined for a local path. Git
 * treats a URL with neither a `scheme:` nor a scp-style `host:` prefix, and
 * any `file:` URL, as a path on this machine.
 */
function remoteRepositoryName(url: string | undefined): string | undefined {
  if (url === undefined || url.startsWith('file:') || !/^[^/]+:/.test(url)) return undefined;
  return url
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .pop();
}
