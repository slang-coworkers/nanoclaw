import type { MemorySessionHookRegistration } from '../memory/session-hook.js';

export interface AgentProvider {
  /**
   * True if the provider's underlying SDK handles slash commands natively and
   * wants them passed through as raw text. When false, the poll-loop formats
   * slash commands like any other chat message.
   */
  readonly supportsNativeSlashCommands: boolean;

  /** Register shared memory through the provider's native session-start mechanism. */
  registerMemorySessionHook(hook: MemorySessionHookRegistration): void;

  /**
   * Optional. Called by the poll-loop after each completed exchange (a
   * result, a wrapping retry, or an error). Providers whose harness keeps no
   * on-disk transcript implement this to persist exchanges themselves (e.g.
   * markdown into the agent's `conversations/` dir); providers that persist
   * and archive their own transcript (e.g. the Claude Agent SDK's `.jsonl`)
   * omit it. Best-effort: the loop catches and logs anything it throws. The
   * implementation lives with the provider, never in the runner.
   */
  onExchangeComplete?(exchange: ProviderExchange): void;

  /** Start a new query. Returns a handle for streaming input and output. */
  query(input: QueryInput): AgentQuery;

  /**
   * True if the given error indicates the stored continuation is invalid
   * (missing transcript, unknown session, etc.) and should be cleared.
   */
  isSessionInvalid(err: unknown): boolean;

  /**
   * Optional pre-resume maintenance. Given the stored continuation token,
   * decide whether its backing transcript has grown too large or too old to
   * resume cheaply. Return a non-null reason string to tell the caller to drop
   * the continuation and start a fresh session (the provider archives any
   * recoverable summary first); return null to keep resuming.
   *
   * Guards the cold-resume failure mode: a long-lived hub session accumulates
   * days of history — including base64 image blocks the agent Read — and the
   * SDK reloads the whole .jsonl on every resume. Past a threshold the first
   * turn alone can exceed the host's idle ceiling, so the container is killed
   * before it ever replies. Providers without an on-disk transcript omit this.
   */
  maybeRotateContinuation?(continuation: string, cwd: string): string | null;
}

/** One prompt/result round-trip, as reported to `onExchangeComplete`. */
export interface ProviderExchange {
  /** The user prompt this exchange answers (never an internal retry nudge). */
  prompt: string;
  result: string | null;
  /** Continuation/thread id in effect for the exchange, if any. */
  continuation?: string;
  status: 'completed' | 'undelivered' | 'error';
}

/**
 * Options passed to provider constructors. Fields are common to most
 * providers; individual providers may ignore any they don't need.
 */
export interface ProviderOptions {
  assistantName?: string;
  mcpServers?: Record<string, McpServerConfig>;
  env?: Record<string, string | undefined>;
  additionalDirectories?: string[];
  /**
   * Model alias (`sonnet`, `opus`, `haiku`) or full model ID. Passed through
   * to the underlying SDK. If omitted, the SDK default is used.
   */
  model?: string;
  /**
   * Reasoning effort (`'low' | 'medium' | 'high' | 'xhigh' | 'max'`). Passed
   * through to the underlying SDK. If omitted, the SDK default is used.
   */
  effort?: string;
  /**
   * Fallback model to use when the primary model is unavailable (429/503).
   * Passed through to the underlying SDK.
   */
  fallbackModel?: string;
}

export interface QueryInput {
  /** Initial prompt (already formatted by agent-runner). */
  prompt: string;

  /**
   * Opaque continuation token from a previous query. The provider decides
   * what this means (session ID, thread ID, nothing at all).
   */
  continuation?: string;

  /** Working directory inside the container. */
  cwd: string;

  /**
   * System context to inject. Providers translate this into whatever their
   * SDK expects (preset append, full system prompt, per-turn injection…).
   */
  systemContext?: {
    instructions?: string;
  };
}

/**
 * MCP server config — stdio OR streamable HTTP.
 *
 * The shape accepts Claude Agent SDK native fields (`type`, `headers`) AND
 * codex-friendly fields (`bearerTokenEnvVar`, `envHttpHeaders`) so the same
 * record can be passed to either provider. Each provider picks the fields
 * it understands; codex's serializer prefers env-var indirection over
 * plaintext headers when both are present.
 *
 * `args`/`env` are optional to match what the host actually emits — its own
 * McpServerConfig (src/container-config.ts) declares both optional, so
 * container.json may legitimately omit them.
 */
export type McpServerConfig =
  | {
      /** stdio transport */
      type?: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      /**
       * Env-var names to forward by NAME (not value) to the subprocess.
       * Codex's TOML writer emits `env_vars = [...]`; codex-cli resolves
       * each name from its own process env at spawn time — so secrets
       * (OneCLI proxy bearer in HTTPS_PROXY, API keys) never land in
       * `~/.codex/config.toml`. Providers without TOML-style name
       * indirection (Claude SDK, OpenCode) resolve names to values from
       * `process.env` before handing the child's env map to the SDK;
       * those providers keep secrets in-process only, never on disk.
       */
      envInherit?: string[];
    }
  | {
      /** http (streamable) transport */
      type: 'http'; // Claude SDK requires literal; codex ignores
      url: string;
      /** Claude-SDK-native static headers (e.g. {Authorization: 'Bearer XYZ'}) */
      headers?: Record<string, string>;
      /** Codex-only: env-var name to read a Bearer token from at request time. */
      bearerTokenEnvVar?: string;
      /** Codex-only: header-name → env-var-name indirection. */
      envHttpHeaders?: Record<string, string>;
      /** Codex-only: static headers. If absent, `headers` is used as a fallback. */
      httpHeaders?: Record<string, string>;
    };

export interface AgentQuery {
  /** Push a follow-up message into the active query. */
  push(message: string): void;

  /** Signal that no more input will be sent. */
  end(): void;

  /** Output event stream. */
  events: AsyncIterable<ProviderEvent>;

  /** Force-stop the query. */
  abort(): void;
}

export type ProviderEvent =
  | { type: 'init'; continuation: string }
  /**
   * A completed turn. `isError` is set when the underlying SDK flagged the
   * turn as an error (e.g. a non-retryable Anthropic 403 billing_error). The
   * poll-loop uses it to surface the result text to the user instead of
   * dropping it as un-wrapped scratchpad, and to skip the re-wrap nudge.
   */
  | { type: 'result'; text: string | null; isError?: boolean }
  | { type: 'error'; message: string; retryable: boolean; classification?: string }
  | { type: 'progress'; message: string }
  /**
   * Per-turn usage accounting. Emitted once after a turn completes when the
   * underlying provider surfaces token/cost numbers. Lets the poll-loop log
   * a structured line per turn (grep/aggregate for perf investigations).
   * Fields mirror the Anthropic usage shape; providers that don't know a
   * value (e.g. Codex doesn't separate cache tiers) pass 0 rather than omit.
   */
  | {
      type: 'usage';
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
      ephemeral1hInputTokens: number;
      ephemeral5mInputTokens: number;
      durationMs: number;
      totalCostUsd: number;
      numTurns: number;
      sessionId: string | null;
    }
  /**
   * Liveness signal. Providers MUST yield this on every underlying SDK
   * event (tool call, thinking, partial message, anything) so the
   * poll-loop's idle timer stays honest during long tool runs.
   */
  | { type: 'activity' };
