import * as fs from 'fs';

import { createOpencodeClient, createOpencodeServer, type OpencodeClient } from '@opencode-ai/sdk';

import type { MemorySessionHookRegistration } from '../memory/session-hook.js';
import { registerProvider } from './provider-registry.js';
import type { AgentProvider, AgentQuery, ProviderEvent, ProviderOptions, QueryInput } from './types.js';
import { mcpServersToOpenCodeConfig } from './mcp-to-opencode.js';

function log(msg: string): void {
  console.error(`[opencode-provider] ${msg}`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SESSION_STATUS_RETRY_ERROR_AFTER = 3;

/** Stale / dead OpenCode session heuristics (complement Claude-centric host patterns). */
const STALE_SESSION_RE =
  /no conversation found|ENOENT.*\.jsonl|session.*not found|NotFoundError|connection reset|ECONNRESET|404|event timeout/i;

type OpencodeServerHandle = { url: string; close: () => void };

/**
 * Start OpenCode in-process via the SDK, not the `opencode` CLI. The
 * container ships `@opencode-ai/sdk` but not the standalone CLI binary, so
 * spawning `opencode serve` ENOENTs (RC-H2). `createOpencodeServer` gives
 * us the same HTTP surface with none of the PATH dependency.
 */
async function startOpencodeServer(config: Record<string, unknown>, timeoutMs = 10_000): Promise<OpencodeServerHandle> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const server = await createOpencodeServer({
      hostname: '127.0.0.1',
      port: 4096,
      signal: controller.signal,
      timeout: timeoutMs,
      // The SDK accepts a typed Config but permits a loose object when the
      // caller owns schema tracking — we do, via mcpServersToOpenCodeConfig.
      config: config as never,
    });
    return { url: server.url, close: () => server.close() };
  } finally {
    clearTimeout(timer);
  }
}

function readClaudeMdForPrompt(): string | undefined {
  // Coworker CLAUDE.md is composed by the host (composeCoworkerSpine) with
  // all operational content — spine invariants, context fragments, skills,
  // workflows, overlays — baked in. Main's CLAUDE.md similarly contains the
  // manager body plus any project fragments. No separate "global" body
  // needs to be appended; the shared bucket at /workspace/shared/ is for
  // cross-group facts (learnings), not prompt content.
  const groupPath = '/workspace/agent/CLAUDE.md';
  if (fs.existsSync(groupPath)) {
    return fs.readFileSync(groupPath, 'utf-8');
  }
  return undefined;
}

function wrapPromptWithContext(text: string, systemInstructions?: string): string {
  let out = text;
  const claudeMd = readClaudeMdForPrompt();
  if (claudeMd) {
    out = `<system>\n${claudeMd}\n</system>\n\n${out}`;
  }
  if (systemInstructions) {
    out = `<system>\n${systemInstructions}\n</system>\n\n${out}`;
  }
  return out;
}

function buildOpenCodeConfig(options: ProviderOptions): Record<string, unknown> {
  const provider = process.env.OPENCODE_PROVIDER || 'anthropic';
  const model = process.env.OPENCODE_MODEL;
  const smallModel = process.env.OPENCODE_SMALL_MODEL;
  const proxyUrl = process.env.ANTHROPIC_BASE_URL;

  const providerModelId = model ? model.replace(new RegExp(`^${escapeRegExp(provider)}/`), '') : undefined;
  const providerSmallModelId = smallModel
    ? smallModel.replace(new RegExp(`^${escapeRegExp(provider)}/`), '')
    : undefined;
  const modelsToRegister = [providerModelId, providerSmallModelId]
    .filter(Boolean)
    .filter((mid, i, a) => a.indexOf(mid as string) === i);

  const providerOptions: Record<string, unknown> =
    provider === 'anthropic'
      ? {}
      : {
          [provider]: {
            options: { apiKey: 'placeholder', baseURL: proxyUrl },
            ...(modelsToRegister.length > 0
              ? {
                  models: Object.fromEntries(
                    modelsToRegister.map((mid) => [mid, { id: mid, name: mid, tool_call: true }]),
                  ),
                }
              : {}),
          },
        };

  const mcp = mcpServersToOpenCodeConfig(options.mcpServers);

  return {
    ...(model ? { model } : {}),
    ...(smallModel ? { small_model: smallModel } : {}),
    enabled_providers: [provider],
    permission: 'allow',
    autoupdate: false,
    snapshot: false,
    provider: providerOptions,
    mcp,
  };
}

type SharedRuntime = {
  server: OpencodeServerHandle;
  client: OpencodeClient;
  stream: AsyncGenerator<{ type: string; properties: Record<string, unknown> }, void, void>;
  streamRelease: () => void;
};

let sharedRuntime: SharedRuntime | null = null;
let sharedConfigKey: string | null = null;
let sharedInit: Promise<SharedRuntime> | null = null;

function runtimeConfigKey(options: ProviderOptions): string {
  return JSON.stringify({
    mcp: mcpServersToOpenCodeConfig(options.mcpServers),
    model: process.env.OPENCODE_MODEL,
    small: process.env.OPENCODE_SMALL_MODEL,
    op: process.env.OPENCODE_PROVIDER,
  });
}

async function ensureSharedRuntime(options: ProviderOptions): Promise<SharedRuntime> {
  const key = runtimeConfigKey(options);
  if (sharedRuntime && sharedConfigKey === key) return sharedRuntime;

  if (sharedInit) return sharedInit;

  sharedInit = (async () => {
    if (sharedRuntime) {
      destroySharedRuntime();
    }
    const config = buildOpenCodeConfig(options);
    const server = await startOpencodeServer(config);
    const client = createOpencodeClient({ baseUrl: server.url });
    const sub = await client.event.subscribe();
    const stream = sub.stream as AsyncGenerator<{ type: string; properties: Record<string, unknown> }, void, void>;
    sharedRuntime = {
      server,
      client,
      stream,
      streamRelease: () => {
        void stream.return?.(undefined);
      },
    };
    sharedConfigKey = key;
    sharedInit = null;
    return sharedRuntime;
  })();

  return sharedInit;
}

export function destroySharedRuntime(): void {
  if (sharedRuntime) {
    try {
      sharedRuntime.streamRelease();
    } catch {
      /* ignore */
    }
    try {
      sharedRuntime.server.close();
    } catch {
      /* ignore */
    }
    sharedRuntime = null;
    sharedConfigKey = null;
  }
  sharedInit = null;
}

function sessionErrorMessage(props: { error?: unknown }): string {
  const err = props.error as { data?: { message?: string } } | undefined;
  if (err && typeof err === 'object' && err.data && typeof err.data.message === 'string') {
    return err.data.message;
  }
  return JSON.stringify(props.error) || 'OpenCode session error';
}

export class OpenCodeProvider implements AgentProvider {
  readonly supportsNativeSlashCommands = false;

  private readonly options: ProviderOptions;
  private activeSessionId: string | undefined;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
  }

  // The hook is a Claude Code mechanism with no OpenCode equivalent; returning
  // false makes the runner deliver memory through the system prompt instead.
  registerMemorySessionHook(_hook: MemorySessionHookRegistration): boolean {
    return false;
  }

  isSessionInvalid(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return STALE_SESSION_RE.test(msg);
  }

  query(input: QueryInput): AgentQuery {
    if (input.continuation) {
      this.activeSessionId = input.continuation;
    } else {
      this.activeSessionId = undefined;
    }

    const pending: string[] = [];
    let waiting: (() => void) | null = null;
    let ended = false;
    let aborted = false;

    const systemInstructions = input.systemContext?.instructions;
    pending.push(wrapPromptWithContext(input.prompt, systemInstructions));

    const kick = (): void => {
      waiting?.();
    };

    const self = this;
    const IDLE_TIMEOUT_MS = 90_000;

    async function* gen(): AsyncGenerator<ProviderEvent> {
      let initYielded = false;
      const rt = await ensureSharedRuntime(self.options);
      const { client, stream } = rt;

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
        let sessionId = self.activeSessionId;

        if (!sessionId) {
          const created = await client.session.create();
          if (created.error) {
            throw new Error(`OpenCode: failed to create session: ${JSON.stringify(created.error)}`);
          }
          sessionId = created.data?.id;
          if (!sessionId) throw new Error('OpenCode: failed to create session (no id)');
          self.activeSessionId = sessionId;
        }

        if (!initYielded) {
          yield { type: 'init', continuation: sessionId };
          initYielded = true;
        }

        const promptRes = await client.session.promptAsync({
          path: { id: sessionId },
          body: { parts: [{ type: 'text', text }] },
        });
        if (promptRes.error) {
          self.activeSessionId = undefined;
          throw new Error(`OpenCode promptAsync: ${JSON.stringify(promptRes.error)}`);
        }

        const partTextByMessageId = new Map<string, string>();
        const roleByMessageId = new Map<string, string>();
        let lastEventAt = Date.now();
        let eventTimedOut = false;
        const timeoutCheck = setInterval(() => {
          if (Date.now() - lastEventAt > IDLE_TIMEOUT_MS) {
            log(`OpenCode event timeout (${IDLE_TIMEOUT_MS}ms) — clearing session ${sessionId}`);
            eventTimedOut = true;
            self.activeSessionId = undefined;
            destroySharedRuntime();
            kick();
          }
        }, 5000);

        try {
          turn: while (true) {
            if (aborted) return;
            if (eventTimedOut) {
              throw new Error(`OpenCode event timeout (${IDLE_TIMEOUT_MS}ms)`);
            }

            const { value: ev, done } = await stream.next();
            if (done) {
              throw new Error('OpenCode SSE stream ended unexpectedly');
            }

            if (!ev?.type || ev.type === 'server.connected' || ev.type === 'server.heartbeat') continue;

            lastEventAt = Date.now();
            yield { type: 'activity' };

            switch (ev.type) {
              case 'message.updated': {
                const info = ev.properties.info as { id?: string; role?: string } | undefined;
                if (info?.id && info?.role) {
                  roleByMessageId.set(info.id, info.role);
                }
                break;
              }
              case 'message.part.updated': {
                const part = ev.properties.part as { type?: string; messageID?: string; text?: string } | undefined;
                if (part?.type === 'text' && part.messageID && part.text) {
                  partTextByMessageId.set(part.messageID, part.text);
                }
                break;
              }
              case 'permission.updated': {
                const perm = ev.properties as { id?: string; sessionID?: string };
                if (perm.sessionID === sessionId && perm.id) {
                  try {
                    await client.postSessionIdPermissionsPermissionId({
                      path: { id: sessionId, permissionID: perm.id },
                      body: { response: 'always' },
                    });
                  } catch (err) {
                    log(`Failed to auto-reply permission: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
                break;
              }
              case 'session.status': {
                const props = ev.properties as {
                  sessionID?: string;
                  status?: { type?: string; attempt?: number; message?: string };
                };
                if (props.sessionID !== sessionId) break;
                const st = props.status;
                if (
                  st?.type === 'retry' &&
                  typeof st.attempt === 'number' &&
                  st.attempt >= SESSION_STATUS_RETRY_ERROR_AFTER &&
                  st.message
                ) {
                  self.activeSessionId = undefined;
                  throw new Error(`OpenCode retry limit (${st.attempt}): ${st.message}`);
                }
                break;
              }
              case 'session.error': {
                const props = ev.properties as { sessionID?: string; error?: unknown };
                if (props.sessionID === sessionId || props.sessionID === undefined) {
                  self.activeSessionId = undefined;
                  throw new Error(sessionErrorMessage(props));
                }
                break;
              }
              case 'session.idle': {
                const sid = (ev.properties as { sessionID?: string }).sessionID;
                if (sid === sessionId) {
                  break turn;
                }
                break;
              }
              default:
                break;
            }
          }
        } finally {
          clearInterval(timeoutCheck);
        }

        let resultText = '';
        for (const [msgId, role] of roleByMessageId) {
          if (role === 'assistant') {
            resultText = partTextByMessageId.get(msgId) ?? resultText;
          }
        }
        yield { type: 'result', text: resultText || null };
      }
    }

    return {
      push: (message: string) => {
        // No `systemInstructions` on a push: this session already carries them
        // from its opening prompt, and the addendum now includes the memory
        // section for this provider — re-sending would stack a stale copy per
        // message. (The CLAUDE.md half of the wrapper is pre-existing.)
        pending.push(wrapPromptWithContext(message));
        kick();
      },
      end: () => {
        ended = true;
        kick();
      },
      events: gen(),
      abort: () => {
        aborted = true;
        this.activeSessionId = undefined;
        kick();
        destroySharedRuntime();
      },
    };
  }
}

registerProvider('opencode', (opts) => new OpenCodeProvider(opts));
