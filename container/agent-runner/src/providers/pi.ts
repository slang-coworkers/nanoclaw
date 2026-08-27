/**
 * pi provider — drives `pi --mode rpc` (the pi.dev terminal coding harness)
 * over JSONL stdio.
 *
 * Mirrors the Codex provider's shape: one RPC subprocess per query invocation,
 * server-side session state (a JSONL transcript pi persists under --session-dir,
 * whose file path is the resume token), and follow-up `push()` messages drained
 * between turns.
 *
 * pi differences handled here:
 *  - No native MCP: NanoClaw's MCP servers are written to `<agent-dir>/mcp.json`
 *    and surfaced through the `pi-mcp-adapter` extension (loaded by absolute
 *    path via settings `extensions`, PI_MCP_ADAPTER_ENTRY). See mcp-to-pi.ts.
 *  - No CLAUDE.md loading and no per-turn system-prompt param: the composed
 *    instructions are written to a file and injected by the bundled
 *    `pi-extensions/nanoclaw-context.ts` extension's `before_agent_start` hook.
 *  - Auth rides the OneCLI HTTPS_PROXY (inherited from the container env) exactly
 *    like the claude provider — a stub API key selects the provider, the proxy
 *    injects the real credential. pi does not honor ANTHROPIC_BASE_URL, so we do
 *    not set one.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { registerProvider } from './provider-registry.js';
import { resolveClaudeImports } from './codex.js';
import { mcpServersToPiConfig } from './mcp-to-pi.js';
import type {
  AgentProvider,
  AgentQuery,
  McpServerConfig,
  ProviderEvent,
  ProviderOptions,
  QueryInput,
} from './types.js';
import {
  type PiEvent,
  type PiRpcServer,
  STALE_SESSION_RE,
  applyPiModel,
  killPiRpc,
  sendPiCommand,
  spawnPiRpc,
  startOrResumePiSession,
} from './pi-rpc.js';

/** Hard ceiling for a single turn. Guards against a wedged rpc process. */
const TURN_TIMEOUT_MS = 5 * 60 * 1000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_EXTENSION_PATH = path.join(__dirname, 'pi-extensions', 'nanoclaw-context.ts');

// ── System-prompt assembly (shared shape with codex.ts) ──────────────────────
// pi doesn't expand `@-import` directives or auto-load CLAUDE.md / CLAUDE.local.md,
// so we resolve them here into the text the context extension injects.

function readAgentClaudeMd(): string | undefined {
  const groupDir = '/workspace/agent';
  const parts: string[] = [];
  for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
    const p = path.join(groupDir, name);
    if (fs.existsSync(p)) parts.push(resolveClaudeImports(fs.readFileSync(p, 'utf-8'), groupDir));
  }
  return parts.length > 0 ? parts.join('\n\n---\n\n') : undefined;
}

function composeBaseInstructions(promptAddendum: string | undefined): string {
  const pieces = [readAgentClaudeMd(), promptAddendum].filter((s): s is string => Boolean(s));
  return pieces.join('\n\n---\n\n');
}

// ── Config materialization ───────────────────────────────────────────────────

interface PiRuntimePaths {
  configDir: string;
  sessionDir: string;
  promptFile: string;
}

function resolvePaths(): PiRuntimePaths {
  const home = process.env.HOME || '/home/node';
  const configDir = process.env.PI_CODING_AGENT_DIR || path.join(home, '.pi', 'agent');
  return {
    configDir,
    sessionDir: path.join(configDir, 'sessions'),
    promptFile: path.join(configDir, 'nanoclaw-system-prompt.txt'),
  };
}

export class PiProvider implements AgentProvider {
  readonly supportsNativeSlashCommands = false;

  private readonly mcpServers: Record<string, McpServerConfig>;
  private readonly provider: string;
  private readonly model?: string;
  private readonly thinkingLevel?: string;

  constructor(options: ProviderOptions = {}) {
    this.mcpServers = options.mcpServers ?? {};
    // Provider is pi-specific (PI_PROVIDER env). Model/thinking take the PI_*
    // env override first, then fall back to the generic ProviderOptions the
    // runner passes (config.model / config.effort). pi's thinking levels share
    // the effort vocabulary (off|minimal|low|medium|high|xhigh|max).
    this.provider = options.env?.PI_PROVIDER ?? 'anthropic';
    this.model = options.env?.PI_MODEL ?? options.model;
    this.thinkingLevel = options.env?.PI_THINKING_LEVEL ?? options.effort;
  }

  registerMemorySessionHook(): void {
    // No-op: pi manages its own session transcript, and shared memory reaches
    // the agent through the composed CLAUDE.md/instructions injected by the
    // nanoclaw-context extension. Codex/OpenCode make this a no-op too.
  }

  isSessionInvalid(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return STALE_SESSION_RE.test(msg);
  }

  /** Write settings.json, mcp.json and the system-prompt file pi reads. */
  private materializeConfig(paths: PiRuntimePaths, instructions: string): void {
    fs.mkdirSync(paths.configDir, { recursive: true });
    fs.mkdirSync(paths.sessionDir, { recursive: true });

    // Extensions: our context injector, plus the pi-mcp-adapter (baked into the
    // image at PI_MCP_ADAPTER_ENTRY) so NanoClaw's MCP tools reach pi.
    const extensions = [CONTEXT_EXTENSION_PATH];
    const adapterEntry = process.env.PI_MCP_ADAPTER_ENTRY;
    if (adapterEntry) extensions.push(adapterEntry);
    const settings: Record<string, unknown> = {
      extensions,
      // Non-interactive: never block on a project-trust prompt.
      defaultProjectTrust: 'always',
    };
    if (this.provider) settings.defaultProvider = this.provider;
    if (this.model) settings.defaultModel = this.model;
    if (this.thinkingLevel) settings.defaultThinkingLevel = this.thinkingLevel;

    fs.writeFileSync(path.join(paths.configDir, 'settings.json'), JSON.stringify(settings, null, 2));
    fs.writeFileSync(
      path.join(paths.configDir, 'mcp.json'),
      JSON.stringify({ mcpServers: mcpServersToPiConfig(this.mcpServers) }, null, 2),
    );
    fs.writeFileSync(paths.promptFile, instructions);
  }

  query(input: QueryInput): AgentQuery {
    const pending: string[] = [input.prompt];
    let waiting: (() => void) | null = null;
    let ended = false;
    let aborted = false;
    const kick = (): void => {
      waiting?.();
    };

    const self = this;
    let server: PiRpcServer | null = null;

    async function* gen(): AsyncGenerator<ProviderEvent> {
      const paths = resolvePaths();
      self.materializeConfig(paths, composeBaseInstructions(input.systemContext?.instructions));

      const srv = spawnPiRpc({
        sessionDir: paths.sessionDir,
        cwd: input.cwd,
        env: {
          PI_CODING_AGENT_DIR: paths.configDir,
          NANOCLAW_PI_SYSTEM_PROMPT_FILE: paths.promptFile,
        },
      });
      server = srv;

      try {
        const sessionFile = await startOrResumePiSession(srv, input.continuation);
        await applyPiModel(srv, {
          provider: self.provider,
          model: self.model,
          thinkingLevel: self.thinkingLevel,
        });

        // Persist the continuation only when pi surfaced a real session file —
        // emitting an empty continuation would poison resume (switch_session '').
        if (sessionFile) yield { type: 'init', continuation: sessionFile };

        while (!aborted) {
          while (pending.length === 0 && !ended && !aborted) {
            await new Promise<void>((resolve) => {
              waiting = resolve;
            });
            waiting = null;
          }
          if (aborted) return;
          if (pending.length === 0 && ended) return;

          const text = pending.shift()!;
          yield* runOneTurn(srv, text);
        }
      } finally {
        killPiRpc(srv);
      }
    }

    return {
      push: (message: string) => {
        pending.push(message);
        kick();
      },
      end: () => {
        ended = true;
        kick();
      },
      abort: () => {
        aborted = true;
        if (server) killPiRpc(server);
        kick();
      },
      events: gen(),
    };
  }
}

// ── Per-turn event pump ──────────────────────────────────────────────────────

/** Extract concatenated text from a pi AgentMessage `content` array. */
function extractMessageText(message: unknown): string | null {
  const content = (message as { content?: unknown } | undefined)?.content;
  if (!Array.isArray(content)) return null;
  const text = content
    .filter((b): b is { type: string; text: string } => {
      const block = b as { type?: string; text?: unknown };
      return block?.type === 'text' && typeof block.text === 'string';
    })
    .map((b) => b.text)
    .join('');
  return text.length > 0 ? text : null;
}

async function* runOneTurn(server: PiRpcServer, inputText: string): AsyncGenerator<ProviderEvent> {
  const turnState: { error: Error | null } = { error: null };
  let resultText: string | null = null;
  let settled = false;

  const buffer: ProviderEvent[] = [];
  let waker: (() => void) | null = null;
  const kick = (): void => {
    waker?.();
    waker = null;
  };

  const handler = (ev: PiEvent): void => {
    // Every inbound event counts as activity for the poll-loop's idle timer.
    buffer.push({ type: 'activity' });

    switch (ev.type) {
      case 'message_end': {
        // pi emits message_end for user, tool-result AND assistant messages;
        // only assistant messages carry the answer.
        const message = ev.message as { role?: string; stopReason?: string; errorMessage?: string } | undefined;
        if (message?.role === 'assistant') {
          if (message.stopReason === 'error' || message.errorMessage) {
            // A failed assistant turn (empty content + errorMessage) must not be
            // reported as an empty successful result.
            turnState.error = new Error(message.errorMessage || 'assistant turn failed');
          } else {
            // An empty final assistant message legitimately clears earlier text.
            resultText = extractMessageText(ev.message);
          }
        }
        break;
      }
      case 'tool_execution_start': {
        const name = (ev as { toolName?: string; tool?: string }).toolName || (ev as { tool?: string }).tool;
        if (name) buffer.push({ type: 'progress', message: `tool: ${name}` });
        break;
      }
      case 'extension_error': {
        const msg = (ev as { error?: string }).error;
        if (msg) buffer.push({ type: 'progress', message: `extension error: ${msg}` });
        break;
      }
      case 'agent_settled':
        settled = true;
        break;
      default:
        // agent_start/end, turn_*, message_start/update, tool_execution_update/end,
        // compaction_*, auto_retry_* — already counted as activity above.
        break;
    }

    kick();
  };

  server.eventHandlers.push(handler);

  // Wake this turn if the pi process dies mid-turn — otherwise the wait below
  // would hang until the 5-minute timer fires (the process is gone, so no
  // agent_settled will ever arrive).
  const onTerminal = (err: Error): void => {
    if (settled) return;
    turnState.error = err;
    settled = true;
    kick();
  };
  server.terminalHandlers.push(onTerminal);
  if (server.terminalError) onTerminal(server.terminalError);

  const timer = setTimeout(() => {
    turnState.error = new Error(`Turn timed out after ${TURN_TIMEOUT_MS}ms`);
    settled = true;
    kick();
  }, TURN_TIMEOUT_MS);

  try {
    // Handler is attached before the prompt is sent so no message_end /
    // agent_settled can slip past between accept and stream.
    const accept = await sendPiCommand(server, { type: 'prompt', message: inputText });
    if (!accept.success) {
      yield { type: 'error', message: accept.error || 'prompt rejected', retryable: false };
      return;
    }

    while (true) {
      while (buffer.length > 0) yield buffer.shift()!;
      if (settled) break;
      await new Promise<void>((resolve) => {
        waker = resolve;
      });
      waker = null;
    }

    while (buffer.length > 0) yield buffer.shift()!;

    if (turnState.error) {
      yield { type: 'error', message: turnState.error.message, retryable: false };
      return;
    }

    yield { type: 'result', text: resultText };
  } finally {
    clearTimeout(timer);
    const ei = server.eventHandlers.indexOf(handler);
    if (ei >= 0) server.eventHandlers.splice(ei, 1);
    const ti = server.terminalHandlers.indexOf(onTerminal);
    if (ti >= 0) server.terminalHandlers.splice(ti, 1);
  }
}

registerProvider('pi', (opts) => new PiProvider(opts));
