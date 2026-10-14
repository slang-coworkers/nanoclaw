import fs from 'fs';
import path from 'path';

import { query as sdkQuery, type HookCallback, type PreCompactHookInput } from '@anthropic-ai/claude-agent-sdk';

import { clearContainerToolInFlight, setContainerToolInFlight } from '../db/container-state.js';
import { BUILTIN_MCP_SERVER, isMcpToolAllowed, parseMcpPolicy, type McpPolicy } from '../mcp-policy.js';
import type { MemorySessionHookRegistration } from '../memory/session-hook.js';
import { resolveEnvInherit } from './codex-app-server.js';
import { TIMEZONE, formatLocalStamp } from '../timezone.js';
import { shimCwd } from './cwd-shim.js';
import type { ResolvedRuntimeConfiguration } from '../provider-contracts/registry.js';
// The execution-policy, inference, MCP, and memory derivations live in
// claude-config.ts. The runtime contract (provider-contracts/claude.ts)
// declares them; core calls them and hands the results to this provider's
// constructor and registerMemorySessionHook. This module never imports the
// contract — registration is two-step so it compiles on a core without one.
import {
  SDK_DISALLOWED_TOOLS,
  TOOL_ALLOWLIST,
  resolveClaudeExecutionPolicy,
  resolveClaudeInference,
  resolveClaudeMcpServers,
  type resolveClaudeMemoryRuntime,
} from './claude-config.js';
// Transcript archiving and rotation are this provider's own concern: both
// read the SDK's on-disk .jsonl, which no other provider has.
import {
  archiveClaudeTranscript,
  claudeConfigDirectory,
  readRestoredModelUsage,
  rotateClaudeContinuation,
} from './claude-history.js';
import { cleanCount } from '../claude-usage.js';
import { registerProvider } from './provider-registry.js';
import type {
  AgentProvider,
  AgentQuery,
  ProviderEvent,
  ProviderOptions,
  QueryInput,
  UsageAccounting,
  UsageAccountingModel,
} from './types.js';

function log(msg: string): void {
  console.error(`[claude-provider] ${msg}`);
}

export interface SdkRateLimitInfo {
  status?: string;
  resetsAt?: number;
  rateLimitType?: string;
  utilization?: number;
  errorCode?: string;
  overageDisabledReason?: string;
}

/**
 * Map an SDK `rate_limit_event` to a provider event — or to NOTHING.
 *
 * The SDK emits this "when rate limit info changes": it is TELEMETRY, and
 * `status` is usually 'allowed' (here's your remaining headroom). We used to
 * treat every one as a terminal quota error: on a stock install that logged a
 * spurious "Rate limit (retryable: false, quota)" on perfectly healthy turns
 * (#3016), and any consumer acting on the classification aborted those turns
 * outright. **Only 'rejected' is an actual block.**
 *
 * When it IS rejected the SDK tells us WHY, so we distinguish properly instead
 * of guessing: `errorCode: 'credits_required'` / `overageDisabledReason:
 * 'out_of_credits'` means genuinely out of credits (billing); anything else is a
 * transient window limit that resets (`resetsAt`, `rateLimitType`).
 *
 * Returns null when the event is informational (do not disturb the turn).
 */
export function classifyRateLimitEvent(
  info: SdkRateLimitInfo | undefined,
): { message: string; classification: 'rate_limit' | 'quota' } | null {
  if (info?.status !== 'rejected') return null;
  const outOfCredits = info.errorCode === 'credits_required' || info.overageDisabledReason === 'out_of_credits';
  let detail = '';
  if (typeof info.resetsAt === 'number' && Number.isFinite(info.resetsAt)) {
    const ms = info.resetsAt < 1e12 ? info.resetsAt * 1000 : info.resetsAt;
    detail = ` (resets ${new Date(ms).toISOString()})`;
  }
  const window = info.rateLimitType ? ` [${info.rateLimitType}]` : '';
  return {
    message: `${outOfCredits ? 'Out of credits' : 'Rate limit'}${window}${detail}`,
    classification: outOfCredits ? 'quota' : 'rate_limit',
  };
}

// --- Final per-call usage (cost accounting) ----------------------------------
//
// The assistant messages the SDK streams carry the `message_start` usage
// SNAPSHOT: input and cache fields are final, `output_tokens` is not. Charging
// that alone kept ~1% of output tokens fleet-wide (prod, 2026-10). The two
// helpers below recover each call's FINAL usage as a second `message_usage`
// report (`final: true`) for the same id; poll-loop charges only the increase.

type MessageUsageEvent = Extract<ProviderEvent, { type: 'message_usage' }>;

interface SdkUsageShape {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation?: { ephemeral_1h_input_tokens?: number | null; ephemeral_5m_input_tokens?: number | null } | null;
  iterations?: Array<{
    cache_creation?: { ephemeral_1h_input_tokens?: number | null; ephemeral_5m_input_tokens?: number | null } | null;
  }> | null;
}

/** The message a stream is currently on, keyed by `parent_tool_use_id ?? 'main'`. */
export type StreamHeads = Map<string, { id: string; model?: string; usage: SdkUsageShape }>;

function cacheSplit(u: SdkUsageShape): { h1: number; m5: number } | null {
  if (
    u.cache_creation &&
    (u.cache_creation.ephemeral_1h_input_tokens != null || u.cache_creation.ephemeral_5m_input_tokens != null)
  ) {
    return { h1: u.cache_creation.ephemeral_1h_input_tokens ?? 0, m5: u.cache_creation.ephemeral_5m_input_tokens ?? 0 };
  }
  const its = (u.iterations ?? []).filter((i) => i?.cache_creation);
  if (its.length === 0) return null;
  return {
    h1: its.reduce((s, i) => s + (i.cache_creation?.ephemeral_1h_input_tokens ?? 0), 0),
    m5: its.reduce((s, i) => s + (i.cache_creation?.ephemeral_5m_input_tokens ?? 0), 0),
  };
}

/**
 * Track `message_start` and turn a `message_delta` into the call's FINAL usage.
 *
 * `message_delta.usage` carries the final `output_tokens`; newer API shapes
 * repeat input/cache there too, the classic shape does not. Each field takes
 * the larger of start and delta, so either shape yields the full final usage.
 * Returns null for every other stream event (and for a delta whose start we
 * never saw — there is no id to attach it to).
 */
export function finalUsageFromStreamEvent(
  msg: {
    event?: {
      type?: string;
      message?: { id?: string; model?: string; usage?: SdkUsageShape };
      usage?: SdkUsageShape | null;
    };
    parent_tool_use_id?: string | null;
  },
  heads: StreamHeads,
): MessageUsageEvent | null {
  const ev = msg.event;
  if (!ev) return null;
  const key = msg.parent_tool_use_id ?? 'main';
  if (ev.type === 'message_start') {
    if (ev.message?.id) heads.set(key, { id: ev.message.id, model: ev.message.model, usage: ev.message.usage ?? {} });
    return null;
  }
  if (ev.type === 'message_stop') {
    heads.delete(key);
    return null;
  }
  if (ev.type !== 'message_delta' || !ev.usage) return null;
  const head = heads.get(key);
  if (!head) return null;
  const s = head.usage;
  const d = ev.usage;
  const split = cacheSplit(d) ?? cacheSplit(s);
  return {
    type: 'message_usage',
    messageId: head.id,
    model: head.model,
    inputTokens: Math.max(s.input_tokens ?? 0, d.input_tokens ?? 0),
    outputTokens: d.output_tokens ?? s.output_tokens ?? 0,
    cacheCreationInputTokens: Math.max(s.cache_creation_input_tokens ?? 0, d.cache_creation_input_tokens ?? 0),
    cacheReadInputTokens: Math.max(s.cache_read_input_tokens ?? 0, d.cache_read_input_tokens ?? 0),
    ephemeral1hInputTokens: split?.h1 ?? 0,
    ephemeral5mInputTokens: split?.m5 ?? 0,
    isSubagent: key !== 'main',
    final: true,
  };
}

interface SdkResultShape {
  session_id?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
  modelUsage?: Record<string, UsageAccountingModel>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: { ephemeral_1h_input_tokens?: number; ephemeral_5m_input_tokens?: number };
  };
}

/** The result's accounting payload, or null when it carries neither `usage` nor `modelUsage`. */
export function resultAccounting(r: SdkResultShape, isError: boolean): UsageAccounting | null {
  const mu = r.modelUsage && typeof r.modelUsage === 'object' ? pickModelUsage(r.modelUsage) : undefined;
  if (!r.usage && !mu) return null;
  const u = r.usage ?? {};
  return {
    inputTokens: cleanCount(u.input_tokens),
    outputTokens: cleanCount(u.output_tokens),
    cacheCreationInputTokens: cleanCount(u.cache_creation_input_tokens),
    cacheReadInputTokens: cleanCount(u.cache_read_input_tokens),
    ephemeral1hInputTokens: cleanCount(u.cache_creation?.ephemeral_1h_input_tokens),
    ephemeral5mInputTokens: cleanCount(u.cache_creation?.ephemeral_5m_input_tokens),
    durationMs: r.duration_ms ?? 0,
    totalCostUsd: typeof r.total_cost_usd === 'number' && Number.isFinite(r.total_cost_usd) ? r.total_cost_usd : 0,
    numTurns: r.num_turns ?? 0,
    sessionId: r.session_id ?? null,
    ...(mu ? { modelUsage: mu } : {}),
    ...(isError ? { isError: true } : {}),
  };
}

/** Keep only the token/cost fields of `result.modelUsage` (it also carries context-window metadata). */
function pickModelUsage(mu: Record<string, UsageAccountingModel>): Record<string, UsageAccountingModel> {
  const out: Record<string, UsageAccountingModel> = {};
  for (const [model, u] of Object.entries(mu)) {
    if (!u || typeof u !== 'object') continue;
    out[model] = {
      inputTokens: cleanCount(u.inputTokens),
      outputTokens: cleanCount(u.outputTokens),
      cacheReadInputTokens: cleanCount(u.cacheReadInputTokens),
      cacheCreationInputTokens: cleanCount(u.cacheCreationInputTokens),
      costUSD: typeof u.costUSD === 'number' && Number.isFinite(u.costUSD) && u.costUSD > 0 ? u.costUSD : 0,
    };
  }
  return out;
}

/**
 * FINAL usage of every API call in a subagent transcript (`agent-*.jsonl`).
 * Claude Code writes each content block as its own line with the call's final
 * usage; lines repeating one id collapse to one event. Malformed lines and
 * calls without usage are skipped.
 */
export function finalUsageFromTranscript(text: string): MessageUsageEvent[] {
  const byId = new Map<string, MessageUsageEvent>();
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let j: { type?: string; timestamp?: unknown; message?: { id?: unknown; model?: unknown; usage?: SdkUsageShape } };
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    const m = j?.message;
    if (j?.type !== 'assistant' || typeof m?.id !== 'string' || !m.id || !m.usage || typeof m.usage !== 'object')
      continue;
    const u = m.usage;
    const split = cacheSplit(u);
    const ev: MessageUsageEvent = {
      type: 'message_usage',
      messageId: m.id,
      model: typeof m.model === 'string' ? m.model : undefined,
      inputTokens: cleanCount(u.input_tokens),
      outputTokens: cleanCount(u.output_tokens),
      cacheCreationInputTokens: cleanCount(u.cache_creation_input_tokens),
      cacheReadInputTokens: cleanCount(u.cache_read_input_tokens),
      ephemeral1hInputTokens: cleanCount(split?.h1),
      ephemeral5mInputTokens: cleanCount(split?.m5),
      isSubagent: true,
      final: true,
      // Canonical ISO, so it compares as an instant with the runner's own stamps.
      ...(typeof j.timestamp === 'string' && Number.isFinite(Date.parse(j.timestamp))
        ? { callTs: new Date(j.timestamp).toISOString() }
        : {}),
    };
    const prev = byId.get(m.id);
    if (!prev || ev.outputTokens >= prev.outputTokens)
      byId.set(m.id, prev?.callTs && !ev.callTs ? { ...ev, callTs: prev.callTs } : ev);
  }
  return [...byId.values()];
}

/** Bytes read per chunk; a transcript of any size is read in these, never whole. */
const SUBAGENT_READ_CHUNK_BYTES = 4 * 1024 * 1024;
/** A single JSONL line longer than this is skipped (logged), not buffered. */
const SUBAGENT_MAX_LINE_BYTES = 16 * 1024 * 1024;
/**
 * What one hook invocation may read before it yields: the SDK awaits the hook,
 * so an enormous transcript must not hold the turn. The rest is read by a
 * re-fired hook (the cursor is kept), and the subagent's calls are in the turn's
 * cumulative `modelUsage` either way — the backstop settles what is not read.
 */
const SUBAGENT_READ_BUDGET_BYTES = Number(process.env.NANOCLAW_SUBAGENT_READ_BUDGET_BYTES) || 256 * 1024 * 1024;
const SUBAGENT_READ_BUDGET_MS = 10_000;

/** Where each subagent transcript was read up to, so a re-fired hook reads only what was appended. */
const subagentReadCursors = new Map<
  string,
  { dev: number; ino: number; offset: number; carry: string; skipping: boolean }
>();

/**
 * Resolve `p` and accept it only as `<project>/<session>/subagents/agent-<id>.jsonl`
 * NEXT TO this hook's own session transcript (`<project>/<session>.jsonl`, the
 * hook input's `transcript_path`), under the real Claude projects root. A path
 * into another session's directory, a symlink out, or any other file is refused.
 */
export function validateSubagentTranscriptPath(p: string, projectsRoot: string, transcriptPath: string): string | null {
  try {
    const root = fs.realpathSync(projectsRoot);
    const real = fs.realpathSync(p);
    const rel = path.relative(root, real);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
    const parts = rel.split(path.sep);
    if (parts.length !== 4 || parts[2] !== 'subagents' || !/^agent-[A-Za-z0-9_-]+\.jsonl$/.test(parts[3])) return null;
    // Bind to the session the hook fired for. The transcript may not exist yet
    // (a session's first turn), so resolve its directory, not the file.
    if (!transcriptPath.endsWith('.jsonl')) return null;
    const projectDir = fs.realpathSync(path.dirname(transcriptPath));
    const session = path.basename(transcriptPath, '.jsonl');
    if (path.join(root, parts[0]) !== projectDir || parts[1] !== session) return null;
    return real;
  } catch {
    return null;
  }
}

/**
 * `SubagentStop` hook: read the finished subagent's transcript and queue each
 * call's FINAL usage. A subagent's calls never reach the stream as
 * `message_delta`, so this is the only place their real output tokens appear
 * per message — and for a background subagent that finishes after its parent's
 * last result, there may be no later result to back it up. The compaction
 * sidechain also fires this hook, with a path that does not exist.
 *
 * Defensive: the hook's `session_id`, its `transcript_path` and the session
 * the running query announced must agree, and the path must be a regular
 * `agent-*.jsonl` in that session's subagents directory; it is opened without
 * following a symlink and the open descriptor must be the file validated (same
 * device and inode, and on Linux the same resolved path). Read asynchronously
 * in bounded chunks — never whole — and incrementally (a re-fired hook reads
 * only appended lines), up to a per-invocation byte/time budget. The
 * transcript is complete when the hook fires, so a final record without a
 * trailing newline is parsed too. Every failure is logged and swallowed:
 * accounting must never break a turn, and whatever is not read here is in the
 * turn's cumulative `modelUsage`, which the backstop settles.
 */
export function createSubagentUsageHook(
  sink: (e: MessageUsageEvent) => void,
  opts: { projectsRoot: string; sessionId?: () => string | undefined; budgetBytes?: number },
): HookCallback {
  return async (input) => {
    const p = (input as { agent_transcript_path?: unknown }).agent_transcript_path;
    const transcriptPath = (input as { transcript_path?: unknown }).transcript_path;
    const hookSession = (input as { session_id?: unknown }).session_id;
    if (typeof p !== 'string' || !p) return {};
    // Bound to the RUNNING query: the hook's session, its transcript's name and
    // the session this query's `init` announced must all be the same.
    const querySession = opts.sessionId?.();
    const bound =
      typeof transcriptPath === 'string' &&
      typeof hookSession === 'string' &&
      path.basename(transcriptPath, '.jsonl') === hookSession &&
      (querySession === undefined || querySession === hookSession);
    const real = bound ? validateSubagentTranscriptPath(p, opts.projectsRoot, transcriptPath) : null;
    if (!real) {
      if (fs.existsSync(p)) log(`subagent usage: ignoring a transcript outside this query's session: ${p}`);
      return {};
    }
    let fh: fs.promises.FileHandle | undefined;
    try {
      const expected = fs.statSync(real);
      fh = await fs.promises.open(real, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
      const st = await fh.stat();
      if (!st.isFile() || st.ino !== expected.ino || st.dev !== expected.dev || !openedAt(fh.fd, real)) {
        log(`subagent usage: ${real} changed between validation and open — not read`);
        return {};
      }
      let cur = subagentReadCursors.get(real);
      if (!cur || cur.ino !== st.ino || cur.dev !== st.dev || st.size < cur.offset) {
        cur = { dev: st.dev, ino: st.ino, offset: 0, carry: '', skipping: false };
      }
      const buf = Buffer.alloc(Math.min(SUBAGENT_READ_CHUNK_BYTES, Math.max(1, st.size - cur.offset)));
      const budgetBytes = opts.budgetBytes ?? SUBAGENT_READ_BUDGET_BYTES;
      const startOffset = cur.offset;
      const startedAt = Date.now();
      while (cur.offset < st.size) {
        if (cur.offset - startOffset >= budgetBytes || Date.now() - startedAt >= SUBAGENT_READ_BUDGET_MS) {
          log(
            `subagent usage: ${real} read budget reached at byte ${cur.offset} of ${st.size} — the rest is ` +
              `settled from the turn's cumulative usage`,
          );
          subagentReadCursors.set(real, cur);
          return {};
        }
        const { bytesRead } = await fh.read(buf, 0, Math.min(buf.length, st.size - cur.offset), cur.offset);
        if (bytesRead <= 0) break;
        cur.offset += bytesRead;
        const text = cur.carry + buf.subarray(0, bytesRead).toString('utf8');
        const lastNl = text.lastIndexOf('\n');
        let complete = lastNl === -1 ? '' : text.slice(0, lastNl);
        cur.carry = lastNl === -1 ? text : text.slice(lastNl + 1);
        if (cur.skipping && lastNl !== -1) {
          // Drop the rest of an over-long line, up to its newline.
          const nl = complete.indexOf('\n');
          complete = nl === -1 ? '' : complete.slice(nl + 1);
          cur.skipping = false;
        } else if (cur.skipping) {
          complete = '';
        }
        if (cur.carry.length > SUBAGENT_MAX_LINE_BYTES) {
          log(`subagent usage: a line in ${real} exceeds ${SUBAGENT_MAX_LINE_BYTES} bytes — skipped`);
          cur.carry = '';
          cur.skipping = true;
        }
        for (const ev of finalUsageFromTranscript(complete)) sink(ev);
      }
      // The subagent has stopped: its transcript is complete, so a last record
      // without a newline is final, not partial.
      if (cur.carry.trim() && !cur.skipping) {
        const tail = finalUsageFromTranscript(cur.carry);
        if (tail.length > 0) {
          for (const ev of tail) sink(ev);
          cur.carry = '';
        }
      }
      subagentReadCursors.set(real, cur);
    } catch (err) {
      log(`subagent usage read failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await fh?.close().catch(() => undefined);
    }
    return {};
  };
}

/**
 * Is the open descriptor the file that was validated? Resolves the descriptor's
 * own path (Linux `/proc/self/fd`), so a parent directory swapped for a symlink
 * after validation is caught. Without `/proc` the device/inode check stands.
 */
function openedAt(fd: number, real: string): boolean {
  try {
    return fs.realpathSync(`/proc/self/fd/${fd}`) === real;
  } catch {
    return !fs.existsSync('/proc/self/fd');
  }
}

/** Test seam: forget the incremental read positions. */
export function __resetSubagentReadCursors(): void {
  subagentReadCursors.clear();
}

// Re-exported because callers still import these from here; both are read by this
// module's own MCP allow-list helpers, so they come in through the import above.
import type { McpServerConfig } from './types.js';
export { SDK_DISALLOWED_TOOLS, TOOL_ALLOWLIST };

export function parseAllowedMcpTools(env?: Record<string, string | undefined>): string[] {
  if (!env?.NANOCLAW_ALLOWED_MCP_TOOLS) return [];
  try {
    return (JSON.parse(env.NANOCLAW_ALLOWED_MCP_TOOLS) as string[]).filter((tool) => tool.startsWith('mcp__'));
  } catch {
    log('Failed to parse NANOCLAW_ALLOWED_MCP_TOOLS');
    return [];
  }
}

/**
 * Extra names for the SDK's `disallowedTools`, derived from the host's
 * discovered inventory.
 *
 * Kept as a backstop only. It is inventory-derived, so it can never be proven
 * complete — which is exactly why it must not be the mechanism the policy
 * relies on. The mechanisms that are complete: a server the policy allows
 * nothing on is never wired (index.ts), the built-in server filters itself
 * (mcp-tools/server.ts), and `mcpPolicyPreToolUseDecision` below default-denies
 * every `mcp__` call the policy does not name.
 *
 * No longer bails out on an empty allowed list: that early return is precisely
 * what made `--tools '[]'` install zero blocks.
 */
function computeBlockedTools(
  env: Record<string, string | undefined> | undefined,
  policy: McpPolicy,
): string[] | undefined {
  if (!policy.restrict || !env?.NANOCLAW_MCP_TOOL_INVENTORY) return undefined;
  try {
    const inventory = JSON.parse(env.NANOCLAW_MCP_TOOL_INVENTORY) as Record<string, string[]>;
    const blocked: string[] = [];
    for (const tools of Object.values(inventory)) {
      for (const tool of tools) {
        if (!isMcpToolAllowed(policy, tool)) blocked.push(tool);
      }
    }
    if (blocked.length > 0) {
      log(`Blocking ${blocked.length} MCP tools not in allowed list`);
      return blocked;
    }
  } catch {
    log('Failed to parse NANOCLAW_MCP_TOOL_INVENTORY');
  }
  return undefined;
}

/** NanoClaw's own server, which the allow-list never governs. */
function isBuiltinMcpServer(serverName: string): boolean {
  return serverName === BUILTIN_MCP_SERVER;
}

// MCP server names are sanitized by the SDK when forming tool prefixes:
// any character outside [A-Za-z0-9_-] becomes '_'. Mirror that here so our
// allowlist patterns match what the SDK actually exposes.
function mcpAllowPattern(serverName: string): string {
  return `mcp__${serverName.replace(/[^a-zA-Z0-9_-]/g, '_')}__*`;
}

/**
 * What to put in the SDK's `allowedTools` for MCP.
 *
 * Under `unrestricted` this stays what it always was: one wildcard per wired
 * server, so a server added at runtime is reachable without a code change.
 *
 * Under a restrictive state the EXTERNAL wildcards are dropped and the exact
 * permitted names are listed instead. Emitting `mcp__<external>__*` alongside a
 * narrow allow-list was the shape of the original bug: the wildcard re-admitted
 * the whole namespace the policy had just excluded. The built-in namespace
 * keeps its wildcard — the allow-list does not govern it.
 */
export function mcpAllowedToolEntries(policy: McpPolicy, serverNames: string[]): string[] {
  if (!policy.restrict) return serverNames.map(mcpAllowPattern);
  // The built-in namespace keeps its wildcard under every state: it is out of
  // this policy's scope, and enumerating it here would mean this file has to
  // know every tool `registerTools` ever adds — a list that would silently
  // fall behind and quietly drop new built-ins.
  const builtinWildcards = serverNames.filter(isBuiltinMcpServer).map(mcpAllowPattern);
  return [...builtinWildcards, ...policy.tools];
}

/**
 * Default-deny check for every `mcp__*` tool call, evaluated at the call.
 *
 * This is the one enforcement point in the provider that does not depend on
 * how the SDK interprets an allow/deny pattern, on the host inventory being
 * complete, or on which servers happened to be wired. It answers the only
 * question that matters — "may this agent group call THIS tool?" — from the
 * policy the host resolved at spawn.
 *
 * Non-MCP tools are none of its business; `SDK_DISALLOWED_TOOLS` and the
 * issue-close backstop handle those.
 *
 * Returns null to allow. Exported for tests.
 */
export function mcpPolicyPreToolUseDecision(policy: McpPolicy, toolName: string): string | null {
  if (!toolName.startsWith('mcp__')) return null;
  // `isMcpToolAllowed` passes every built-in: they are outside this policy.
  if (isMcpToolAllowed(policy, toolName)) return null;
  return (
    `Tool '${toolName}' is not in this agent group's external MCP tool allow-list ` +
    `(${policy.origin}). This is a configuration boundary, not a transient ` +
    `failure: retrying or reaching the same capability another way is not appropriate. ` +
    `An admin can widen it with \`ncl groups mcp-tools set\`; an agent may never widen its own.`
  );
}

interface SDKUserMessage {
  type: 'user';
  message: { role: 'user'; content: string };
  parent_tool_use_id: null;
  session_id: string;
}

/**
 * Push-based async iterable for streaming user messages to the Claude SDK.
 */
class MessageStream {
  private queue: SDKUserMessage[] = [];
  private waiting: (() => void) | null = null;
  private done = false;

  push(text: string): void {
    this.queue.push({
      type: 'user',
      message: { role: 'user', content: text },
      parent_tool_use_id: null,
      session_id: '',
    });
    this.waiting?.();
  }

  end(): void {
    this.done = true;
    this.waiting?.();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.done) return;
      await new Promise<void>((r) => {
        this.waiting = r;
      });
      this.waiting = null;
    }
  }
}

/**
 * Detect a Bash command that would CLOSE a GitHub issue. Closing a
 * contributor's issue (even a genuine duplicate of a maintainer-owned issue)
 * is a maintainer privilege — coworkers triage and comment, they do not close.
 * This is a deterministic backstop for the instruction-level guardrail: the
 * #11719 regression closed an issue as a duplicate after the prose guardrail
 * (scoped to "PRs", not issues) let it through and the orchestrator authorized
 * it. We block the command's *content* because the close rides inside a Bash
 * `gh` / GraphQL call, which the SDK's tool-name `disallowedTools` can't see.
 *
 * Covers the two paths observed in the wild:
 *   - REST:    gh issue close … / gh api … issues/<n> -f state=closed / state_reason=…
 *   - GraphQL: a `closeIssue(` mutation (used because REST state_reason 403s for the App token)
 *
 * Deliberately does NOT match `gh pr close` or `closePullRequest` — PR close is
 * a separate surface the fixer/reviewer legitimately use. Returns the matched
 * fragment (for the block message) or null.
 */
export function detectIssueClose(command: string | undefined): string | null {
  if (!command || typeof command !== 'string') return null;
  // GraphQL mutation: closeIssue( … ). PR equivalent is closePullRequest, which
  // won't match this because of the trailing `(` boundary after "Issue".
  if (/\bcloseIssue\s*\(/i.test(command)) return 'GraphQL closeIssue mutation';
  // REST via gh CLI: `gh issue close <n>` (allow flags/`-R` between).
  if (/\bgh\s+issue\s+close\b/i.test(command)) return 'gh issue close';
  // REST via gh api: a PATCH to issues/<n> that sets state=closed or any
  // state_reason. Require an issues path so we don't catch PR endpoints.
  if (/\bgh\s+api\b/i.test(command) && /\/issues\/\d+/i.test(command) && /\bstate(_reason)?=/i.test(command)) {
    return 'gh api issues state change';
  }
  return null;
}

/**
 * PreToolUse hook: record the current tool + its declared timeout so the host
 * sweep can widen its stuck tolerance while Bash is running a long-declared
 * script. Defense-in-depth: if SDK_DISALLOWED_TOOLS slips through somehow,
 * block the call here instead of letting the agent hang.
 */
function createPreToolUseHook(policy: McpPolicy): HookCallback {
  return async (input) => {
    const i = input as { tool_name?: string; tool_input?: Record<string, unknown> };
    const toolName = i.tool_name ?? '';
    if (SDK_DISALLOWED_TOOLS.includes(toolName)) {
      return {
        decision: 'block',
        stopReason: `Tool '${toolName}' is not available in this environment — use the nanoclaw equivalent.`,
      } as unknown as ReturnType<HookCallback>;
    }
    // MCP allow-list, default-deny. Placed first among the policy checks because
    // it is the broadest: it covers direct servers the host proxy never sees
    // (the built-in `nanoclaw` server, the `codex` stdio child) as well as
    // proxied ones, and it does not care whether the SDK honoured the
    // allowedTools/disallowedTools it was handed.
    const mcpDenial = mcpPolicyPreToolUseDecision(policy, toolName);
    if (mcpDenial) {
      log(`PreToolUse: denied ${toolName} — not in the explicit external allow-list`);
      return { decision: 'block', stopReason: mcpDenial } as unknown as ReturnType<HookCallback>;
    }
    // Backstop: no coworker closes GitHub issues. Block the close at the tool
    // boundary regardless of what the model was told or authorized. Opt-out is a
    // per-group env flag (unset everywhere today) so a future maintainer-grade
    // group can be granted the capability via container config, not a code change.
    if (toolName === 'Bash' && process.env.NANOCLAW_ALLOW_ISSUE_CLOSE !== '1') {
      const match = detectIssueClose(i.tool_input?.command as string | undefined);
      if (match) {
        return {
          decision: 'block',
          stopReason:
            `Closing a GitHub issue (${match}) is a maintainer-only action — coworkers triage and comment, they do not close. ` +
            `Post your duplicate/wontfix verdict as an issue comment and leave the close to a human maintainer.`,
        } as unknown as ReturnType<HookCallback>;
      }
    }
    // Bash exposes its timeout via the tool_input.timeout field (ms). Any other
    // tool: no declared timeout.
    const declaredTimeoutMs =
      toolName === 'Bash' && typeof i.tool_input?.timeout === 'number' ? (i.tool_input.timeout as number) : null;
    try {
      setContainerToolInFlight(toolName, declaredTimeoutMs);
    } catch (err) {
      log(`PreToolUse: failed to record container_state: ${err instanceof Error ? err.message : String(err)}`);
    }
    return { continue: true };
  };
}

/** Clear in-flight tool on PostToolUse / PostToolUseFailure. */
const postToolUseHook: HookCallback = async () => {
  try {
    clearContainerToolInFlight();
  } catch (err) {
    log(`PostToolUse: failed to clear container_state: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { continue: true };
};

/** Minimum spacing between `activity` frames derived from streaming deltas. */
const STREAM_ACTIVITY_INTERVAL_MS = 1000;

// The notices are written for a terminal user; a chat user can't act on them
// and must never be invited to paste a key.
const OWNER_FIX_HINT =
  "Whoever runs this NanoClaw needs to fix this outside the chat. Please don't send keys or passwords here.";

/** The Claude CLI's own fixed failure notices (exact strings), safe to show in a channel, and the hint added to each. */
const SDK_NOTICES = new Map([
  ['Not logged in · Please run /login', OWNER_FIX_HINT],
  ['Invalid API key · Fix external API key', OWNER_FIX_HINT],
  ['Invalid auth token · Fix external auth token', OWNER_FIX_HINT],
  ['Credit balance is too low', OWNER_FIX_HINT],
  ['Prompt is too long', 'This conversation got too long. An admin can send /clear to start a new one.'],
]);

/** The real clock for archive names and rotation stamps; tests hand the history functions a fixed one. */
const REAL_CLOCK = { now: () => Date.now() };

// The PreCompact hook is provider-originated: the SDK raises it from inside
// the query, and the archive it triggers reads the SDK's own transcript.
function createPreCompactHook(assistantName?: string): HookCallback {
  return async (input) => {
    const preCompact = input as PreCompactHookInput;
    archiveClaudeTranscript(
      {
        transcriptPath: preCompact.transcript_path,
        sessionId: preCompact.session_id,
        assistantName,
        log,
      },
      REAL_CLOCK,
    );
    return {};
  };
}

// ── Provider ──

/**
 * Claude Code auto-compacts context at this window (tokens). Default is
 * tuned for a 200K context model (~80% fill). For 1M models (model ID
 * contains "[1m]"), we raise the window to 900K so the agent can use the
 * full context before compacting.
 *
 * Operator override: set CLAUDE_CODE_AUTO_COMPACT_WINDOW in the host env or
 * `.env`; the host-side claude provider (src/providers/claude.ts) passes it
 * into the container.
 */
function getAutoCompactWindow(): string {
  if (process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) return process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
  const model = process.env.ANTHROPIC_MODEL || '';
  if (model.includes('[1m]')) return '900000';
  return '165000';
}
const CLAUDE_CODE_AUTO_COMPACT_WINDOW = getAutoCompactWindow();

/**
 * Stale-session detection. Matches Claude Code's error text when a
 * resumed session can't be found — missing transcript .jsonl, unknown
 * session ID, etc.
 */
const STALE_SESSION_RE = /no conversation found|ENOENT.*\.jsonl|session.*not found/i;

export class ClaudeProvider implements AgentProvider {
  private assistantName?: string;
  private mcp: ReturnType<typeof resolveClaudeMcpServers>;
  private inference: ReturnType<typeof resolveClaudeInference>;
  private executionPolicy: ReturnType<typeof resolveClaudeExecutionPolicy>;
  private env: Record<string, string | undefined>;
  private additionalDirectories?: string[];
  // The envInherit-resolved MCP map this provider hands the SDK. Distinct from
  // `this.mcp` (the contract resolver's output, which applies shimCwd only).
  private mcpServers: Record<string, McpServerConfig>;
  private mcpPolicy: McpPolicy;
  private blockedTools?: string[];
  // Kept as a field: upstream's inference resolver has no fallbackModel.
  private fallbackModel?: string;
  private memorySessionHook?: MemorySessionHookRegistration;

  /**
   * `configuration` is the contract's configuration as resolved by core
   * (createProvider): execution policy, inference, and MCP servers. This
   * provider does not call the resolves itself.
   */
  constructor(options: ProviderOptions = {}, configuration?: ResolvedRuntimeConfiguration) {
    // `configuration` is what core resolved from the runtime contract, and
    // createProvider always supplies it. It stays OPTIONAL because direct
    // construction is still a supported entry point — other branches of this fork
    // construct the provider straight in their tests, and a required argument turns
    // that into a crash they cannot see until the composed-state CI run. Resolving
    // the same functions here as a fallback is tolerant in exactly the way the rest
    // of this refactor is (an absent seamVersion means 1; dropped declarations are
    // accepted and ignored), and the resolves are the provider's OWN, so nothing
    // reaches for the contract.
    const runtimeConfiguration: ResolvedRuntimeConfiguration = configuration ?? {
      executionPolicy: resolveClaudeExecutionPolicy(),
      inference: resolveClaudeInference(
        { model: options.model, effort: options.effort, speed: options.speed },
        process.env,
      ),
      mcpServers: resolveClaudeMcpServers(options.mcpServers ?? {}, process.env),
    };
    this.assistantName = options.assistantName;
    this.mcp = runtimeConfiguration.mcpServers as ReturnType<typeof resolveClaudeMcpServers>;
    this.additionalDirectories = options.additionalDirectories;
    this.inference = runtimeConfiguration.inference as ReturnType<typeof resolveClaudeInference>;
    this.executionPolicy = runtimeConfiguration.executionPolicy as ReturnType<typeof resolveClaudeExecutionPolicy>;
    this.fallbackModel = options.fallbackModel;
    this.env = {
      ...(options.env ?? {}),
      CLAUDE_CODE_AUTO_COMPACT_WINDOW,
      // NanoClaw owns memory (the OKF tree + session-start hook), so Claude
      // Code's native auto-memory must stay off or the two disagree about
      // recall. group-init.ts writes the same flag into each group's
      // settings.json; this covers the SDK child for groups scaffolded before
      // that flag existed. Spread last so a caller env cannot re-enable it.
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
    };
    // Resolve `envInherit` names → values from process env for every stdio
    // MCP entry. Claude Agent SDK spawns MCP children with a literal env
    // map and has no name-indirection; we resolve in-memory and drop the
    // envInherit field. Resolved values live only in this record and are
    // handed straight to the SDK (which uses them for child_process.spawn
    // env); they MUST NOT be written anywhere on disk.
    const src = options.mcpServers ?? {};
    const resolved: Record<string, McpServerConfig> = {};
    for (const [name, cfg] of Object.entries(src)) {
      if ('url' in cfg) {
        resolved[name] = cfg;
        continue;
      }
      const mergedEnv = resolveEnvInherit(cfg, process.env, name);
      // shimCwd runs last and consumes `cwd`: the Agent SDK's stdio config has
      // no cwd field, so the only way to honour it is the /bin/sh chdir wrap,
      // which rewrites command/args. Nothing may re-resolve them afterwards.
      resolved[name] = shimCwd({
        command: cfg.command,
        args: cfg.args,
        env: mergedEnv,
        ...(cfg.cwd ? { cwd: cfg.cwd } : {}),
      });
    }
    this.mcpServers = resolved;
    // Policy is snapshotted at construction — deliberately. It changes only
    // when the container is respawned, which is exactly what `ncl groups
    // mcp-tools set` now forces for every session in the group. A live-mutable
    // seam here would be a second, weaker source of truth: the SDK caches the
    // allowedTools/mcpServers it was handed at query start, and a wired stdio
    // server is a running child process, so "narrow the snapshot" could not
    // actually revoke a direct tool mid-session. Restart can, and does.
    this.mcpPolicy = parseMcpPolicy(this.env);
    this.blockedTools = computeBlockedTools(this.env, this.mcpPolicy);
    // A server the policy allows nothing on should already have been dropped
    // by index.ts before it got here. Drop it again rather than trusting that:
    // wiring a server is what creates its tools, so this is the cheapest
    // complete revocation available and it costs one filter.
    for (const name of Object.keys(this.mcpServers)) {
      if (isBuiltinMcpServer(name)) continue;
      const prefix = `mcp__${name.replace(/[^a-zA-Z0-9_-]/g, '_')}__`;
      if (this.mcpPolicy.restrict && !this.mcpPolicy.tools.some((t) => t.startsWith(prefix))) {
        log(`Not wiring MCP server "${name}" — the explicit allow-list names no tool on it`);
        delete this.mcpServers[name];
      }
    }
  }

  /**
   * `memory` is the contract's resolved memory capability (the runtime env
   * that keeps the SDK's own auto-memory off). Core registers before any
   * query, so the SDK sees the same env it always did.
   *
   * Returns FALSE on purpose (2026-09-29): Claude Code has a session-start
   * hook, and the runner used it to deliver the OKF Memory section — but Claude
   * Code persists hook stdout above ~10 KB to a file and hands the model only a
   * ~2 KB preview ("Output too large … Full output saved to …"). Every group
   * whose index.md + system/definition.md crossed that line (prod: main,
   * slang-fixer, slang_ci-babysitter, slang-pr-approver) lost its Map and the
   * memory definition in every context window since. The system-prompt path
   * (same one Codex uses) has no such clipping, is re-read on every query
   * rebuild, and is resent after compaction, so memory now travels there. The
   * contract's registration step removes the stale SessionStart entry from
   * settings.json so an old install does not double-inject a preview.
   */
  registerMemorySessionHook(hook: MemorySessionHookRegistration, memory?: unknown): boolean {
    this.memorySessionHook = hook;
    this.env = {
      ...this.env,
      ...((memory as ReturnType<typeof resolveClaudeMemoryRuntime> | undefined) ?? {}),
    };
    return false;
  }

  isSessionInvalid(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return STALE_SESSION_RE.test(msg);
  }

  /**
   * Pre-resume maintenance: drop a transcript too large or too old to
   * cold-resume within the host's idle ceiling (see claude-history.ts).
   */
  maybeRotateContinuation(continuation: string, _cwd: string): string | null {
    return rotateClaudeContinuation({ continuation, assistantName: this.assistantName, log }, REAL_CLOCK);
  }

  /** The `modelUsage` Claude Code restores on resume — its transcript's last `cost-state`. */
  readRestoredUsage(continuation: string): Record<string, UsageAccountingModel> | null {
    const mu = readRestoredModelUsage(continuation);
    return mu ? pickModelUsage(mu as Record<string, UsageAccountingModel>) : null;
  }

  query(input: QueryInput): AgentQuery {
    const stream = new MessageStream();
    stream.push(input.prompt);

    const instructions = input.systemContext?.instructions;

    // The executable the SDK spawns. Defaults to the bundled native claude
    // binary. CLAUDE_CODE_EXECUTABLE points it at the claude-trace wrapper (the
    // real binary under a request-logging reverse proxy) so each session dumps
    // .claude-trace/*.jsonl + *.html. The wrapper MUST keep the child's stdout
    // (SDK stream-json) clean; claude-trace's own logs go to stderr.
    const claudeExecutable =
      process.env.CLAUDE_CODE_EXECUTABLE || '/app/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude';

    // Only kill() aborts this. The SDK then closes its process: stdin end,
    // SIGTERM, then SIGKILL.
    const sdkAbort = new AbortController();

    // Final per-call usage of subagent calls, queued by the SubagentStop hook
    // (which runs outside the message loop) and drained into the event stream
    // before the next event — so it is accounted before the turn's `result`
    // when the subagent finished inside the turn, and on the next event (or at
    // stream end) when a background subagent finished after it.
    const pendingUsage: Extract<ProviderEvent, { type: 'message_usage' }>[] = [];
    // The SDK session this query runs as (from its `init`); the usage hook only
    // reads transcripts of this session.
    let querySessionId: string | undefined;

    const sdkResult = sdkQuery({
      prompt: stream,
      options: {
        abortController: sdkAbort,
        pathToClaudeCodeExecutable: claudeExecutable,
        cwd: input.cwd,
        additionalDirectories: this.additionalDirectories,
        resume: input.continuation,
        // The append (agent name + destinations) is rebuilt at every container
        // start. Left to the SDK default, Claude Code records the prompt on a
        // session's first request and resends that record on every resume, so
        // a resumed agent would keep its old name and destination list until
        // compaction. snapshot: false renders it fresh each time.
        //
        // Upstream also hardcodes `pathToClaudeCodeExecutable: '/pnpm/claude'`
        // here. NOT taken: this fork already sets that property above from
        // `claudeExecutable`, which selects the claude-trace wrapper when tracing
        // is on and the SDK-bundled native binary otherwise. A second literal
        // would be a duplicate key that silently wins and disables tracing.
        systemPrompt: instructions
          ? { type: 'preset' as const, preset: 'claude_code' as const, append: instructions, snapshot: false }
          : undefined,
        // Fork tool policy: upstream moved these onto `this.mcp` /
        // `this.executionPolicy`, shapes this fork does not carry.
        allowedTools: [...TOOL_ALLOWLIST, ...mcpAllowedToolEntries(this.mcpPolicy, Object.keys(this.mcpServers))],
        disallowedTools: [...SDK_DISALLOWED_TOOLS, ...(this.blockedTools ?? [])],
        // The SDK emits `assistant` only per completed content block, so a long
        // block is silent and the host sweep kills the container mid-generation.
        // Streaming deltas are the liveness signal for that window; translateEvents
        // turns them into throttled `activity` and nothing else.
        includePartialMessages: true,
        env: this.env,
        model: this.inference.model,
        fallbackModel: this.fallbackModel,
        // Tier-2 ceiling SOFT brake: the SDK ends this query once its cost reaches the
        // remaining headroom (checked between calls → best-effort, ≤ one in-flight-call
        // overshoot). Omitted (undefined) when there is no applicable ceiling.
        ...(input.maxBudgetUsd != null ? { maxBudgetUsd: input.maxBudgetUsd } : {}),
        // Forward subagent (Task tool) text/thinking messages into this stream.
        // Cost, not rendering, is why: by default the SDK forwards only a
        // subagent's tool_use/tool_result blocks, so a subagent message that is
        // pure text — typically its final answer — never reaches us and its
        // tokens are invisible to the cost cap. Subagent transcripts are written
        // to a SEPARATE file (`<sdk-session-id>/subagents/agent-*.jsonl`), and
        // the on-disk route cannot attribute them: `.claude-shared` is shared by
        // every session in the agent group, and the directory is named after the
        // ORIGINAL sdk session id, which after a few resumes is no longer the
        // live continuation. Forwarding is the only seam that attributes
        // correctly. The `text` event below is gated on `parent_tool_use_id ==
        // null` so this does NOT open a second delivery door (issue #1327).
        forwardSubagentText: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        effort: this.inference.effort as any,
        permissionMode: this.executionPolicy.permissionMode,
        allowDangerouslySkipPermissions: this.executionPolicy.allowDangerouslySkipPermissions,
        settingSources: ['project', 'user', 'local'],
        // Flag-level settings: `fastMode` only when the install turns it on,
        // then the execution policy's fixed keys, spread last so per-group
        // input can never override them. Both are Settings members rather
        // than query options, which is why they ride `settings`.
        settings: { ...this.inference.settings, ...this.executionPolicy.settings },
        // this.mcpServers, not this.mcp.mcpServers: the contract resolver applies
        // shimCwd but NOT envInherit, and the fork resolves `envInherit` names to
        // values in the constructor. Using the resolver's map drops those values,
        // and also skips the constructor's removal of disallowed external servers.
        mcpServers: this.mcpServers,
        hooks: {
          PreToolUse: [{ hooks: [createPreToolUseHook(this.mcpPolicy)] }],
          PostToolUse: [{ hooks: [postToolUseHook] }],
          PostToolUseFailure: [{ hooks: [postToolUseHook] }],
          PreCompact: [{ hooks: [createPreCompactHook(this.assistantName)] }],
          // Only when the consumer meters spend: the transcript read is pure accounting.
          ...(input.usageTracking
            ? {
                SubagentStop: [
                  {
                    hooks: [
                      createSubagentUsageHook((e) => pendingUsage.push(e), {
                        projectsRoot: path.join(claudeConfigDirectory(), 'projects'),
                        sessionId: () => querySessionId,
                      }),
                    ],
                  },
                ],
              }
            : {}),
        },
      },
    });

    let aborted = false;

    async function* translateEvents(): AsyncGenerator<ProviderEvent> {
      let messageCount = 0;
      let lastStreamActivityAt = 0;
      const streamHeads: StreamHeads = new Map();
      for await (const message of sdkResult) {
        if (aborted) return;
        while (pendingUsage.length > 0) yield pendingUsage.shift()!;

        // Yield activity for every SDK event so the poll loop knows the agent
        // is working. Deltas arrive per token and carry no content for us, so
        // they count at most once per second, and not as messages — except a
        // `message_delta`, which carries the call's FINAL usage (the assistant
        // messages only ever carry the start-of-stream snapshot).
        if (message.type === 'stream_event') {
          const finalUsage = finalUsageFromStreamEvent(
            message as Parameters<typeof finalUsageFromStreamEvent>[0],
            streamHeads,
          );
          if (finalUsage) yield finalUsage;
          const now = Date.now();
          if (now - lastStreamActivityAt < STREAM_ACTIVITY_INTERVAL_MS) continue;
          lastStreamActivityAt = now;
          yield { type: 'activity' };
          continue;
        }
        messageCount++;
        yield { type: 'activity' };

        if (message.type === 'system' && message.subtype === 'init') {
          querySessionId = message.session_id;
          yield { type: 'init', continuation: message.session_id };
        } else if (message.type === 'assistant') {
          // Surface each assistant message's text as it streams in. The final
          // `result` event only carries the LAST assistant text — a wrapped
          // <message> block composed between tool calls would otherwise be
          // invisible to the poll-loop and silently lost.
          //
          // ONE text event per assistant message, joining its text blocks in
          // content order ('' separator — the blocks are adjacent output).
          // Emitting per-BLOCK events would hand the poll-loop's block parser
          // fragments: a <message> block (or an <internal> span) spanning two
          // text blocks of the same assistant message would look unterminated
          // in each event, while the turn's result text — which reports the
          // final message's text as a whole — could still contain it complete.
          // Joining pins the containment premise at the granularity the
          // result reports. Blocks split across ASSISTANT MESSAGES (a tool
          // call between them) remain unparseable mid-turn by design; the
          // poll-loop's midTurnSent===0 fallback and wrap-nudge cover that.
          const asst = message as {
            parent_tool_use_id?: string | null;
            message?: {
              id?: string;
              model?: string;
              content?: Array<{ type?: string; text?: string }>;
              usage?: {
                input_tokens?: number;
                output_tokens?: number;
                cache_creation_input_tokens?: number;
                cache_read_input_tokens?: number;
                cache_creation?: {
                  ephemeral_1h_input_tokens?: number;
                  ephemeral_5m_input_tokens?: number;
                };
              };
            };
          };
          // A subagent's messages carry `parent_tool_use_id`. They are forwarded
          // for COST only (see forwardSubagentText above) — never for delivery:
          // the poll-loop parses `text` events for complete <message> blocks and
          // sends them, so letting a subagent's prose through here would deliver
          // a nested agent's scratchpad to the user. Gating here is also
          // behavior-preserving for the pre-#1327 default, where the only
          // forwarded subagent blocks were tool_use/tool_result and the filter
          // below already dropped them.
          const isSubagent = asst.parent_tool_use_id != null;
          const content = asst.message?.content;
          if (!isSubagent && Array.isArray(content)) {
            const text = content
              .filter((block) => block.type === 'text' && block.text)
              .map((block) => block.text)
              .join('');
            if (text) yield { type: 'text', text };
          }
          // PER-MESSAGE usage — the cost cap's accounting basis (issue #1327).
          // One assistant message per content block, all blocks of one API
          // response repeating the same `message.id` and the same usage — the
          // `message_start` SNAPSHOT (final input/cache, partial output). The
          // consumer charges the id once and tops it up when the final usage
          // arrives (stream `message_delta` above, or the SubagentStop hook).
          const mu = asst.message?.usage;
          if (mu) {
            yield {
              type: 'message_usage',
              messageId: asst.message?.id ?? null,
              model: asst.message?.model,
              inputTokens: mu.input_tokens ?? 0,
              outputTokens: mu.output_tokens ?? 0,
              cacheCreationInputTokens: mu.cache_creation_input_tokens ?? 0,
              cacheReadInputTokens: mu.cache_read_input_tokens ?? 0,
              ephemeral1hInputTokens: mu.cache_creation?.ephemeral_1h_input_tokens ?? 0,
              ephemeral5mInputTokens: mu.cache_creation?.ephemeral_5m_input_tokens ?? 0,
              isSubagent,
            };
          } else {
            // A genuine assistant message with no `usage` object. Signal it so
            // the poll-loop treats the turn as degraded and settles from the
            // aggregate — otherwise, mixed with usage-bearing messages, this
            // one's spend would be invisible and free (issue #1327).
            yield { type: 'message_missing_usage', isSubagent };
          }
        } else if (message.type === 'result') {
          // `result` text exists only on subtype:"success"; error subtypes
          // (e.g. a non-retryable 403 billing_error) carry their message in
          // `errors[]` instead. Keep that actionable notice separate from
          // model output so the poll-loop can deliver it without scratchpad.
          const m = message as { result?: string; is_error?: boolean; errors?: string[] };
          const isError = m.is_error === true;
          // Some failures (e.g. an invalid API key) leave errors[] empty and put
          // the SDK's own notice in `result`. Other result text can echo upstream
          // bodies, so only exact fixed notices are reused; the rest stay generic.
          const candidate = isError && !m.errors?.length ? (m.result?.trim() ?? '') : '';
          // Notice first, hint on its own line: setup's ping shows only the first line.
          const hint = SDK_NOTICES.get(candidate);
          const resultAsError = hint ? `${candidate}\n${hint}` : '';
          // Per-turn accounting, whenever the result carries EITHER the main-loop
          // `usage` or the cumulative `modelUsage` (an error result can have only
          // the latter, and its billed calls must still be settled). It rides on
          // the `result` itself so the consumer settles it before any delivery
          // step can throw; the `usage` event after it is the log line.
          const accounting = resultAccounting(message as SdkResultShape, isError);
          yield {
            type: 'result',
            text: resultAsError ? null : (m.result ?? null),
            isError,
            error: m.errors?.length ? m.errors.join('\n') : resultAsError || undefined,
            ...(accounting ? { accounting } : {}),
          };
          if (accounting) yield { type: 'usage', ...accounting };
        } else if (message.type === 'system' && (message as { subtype?: string }).subtype === 'api_retry') {
          yield { type: 'error', message: 'API retry', retryable: true };
        } else if (message.type === 'rate_limit_event') {
          // The SDK emits this "when rate limit info CHANGES" — it is telemetry,
          // not necessarily an error. `rate_limit_info.status` is usually
          // 'allowed' (here's your remaining headroom). Treating every one of
          // these as a terminal quota error logged a spurious rate-limit line
          // on healthy turns (#3016) — and aborted them outright wherever the
          // classification is acted on. ONLY 'rejected' is an actual block.
          //
          // When it IS rejected the SDK tells us WHY, so we can finally
          // distinguish the two cases properly instead of guessing:
          //   errorCode 'credits_required' / overageDisabledReason
          //   'out_of_credits'  → genuinely out of credits (billing)
          //   otherwise         → a transient window limit that resets.
          const info = (message as { rate_limit_info?: SdkRateLimitInfo }).rate_limit_info;
          const blocked = classifyRateLimitEvent(info);
          if (!blocked) {
            // Informational ('allowed' / 'allowed_warning') — never kill the turn.
            if (info?.status === 'allowed_warning') {
              log(
                `rate-limit warning: ${info.rateLimitType ?? 'window'} at ${
                  info.utilization != null ? `${Math.round(info.utilization * 100)}%` : 'high'
                } utilization`,
              );
            }
          } else {
            yield { type: 'error', message: blocked.message, retryable: false, classification: blocked.classification };
          }
        } else if (message.type === 'system' && (message as { subtype?: string }).subtype === 'compact_boundary') {
          const meta = (message as { compact_metadata?: { pre_tokens?: number } }).compact_metadata;
          const detail = meta?.pre_tokens ? ` (${meta.pre_tokens.toLocaleString()} tokens compacted)` : '';
          // Not a `result`: the poll loop treats result text as the agent's turn
          // output — a synthetic "Context compacted." result has no <message>
          // block, so it triggers the "response was not delivered — please
          // re-send" nudge and the agent duplicates its previous message.
          // Compaction is bookkeeping: log it, count it as activity only.
          log(`Context compacted${detail}.`);
          yield { type: 'activity' };
        } else if (message.type === 'system' && (message as { subtype?: string }).subtype === 'task_notification') {
          const tn = message as { summary?: string; status?: string };
          yield {
            type: 'progress',
            message: tn.summary || (tn.status ? `Task ${tn.status}` : 'Task notification'),
            task: 'finished',
          };
        } else if (message.type === 'system' && (message as { subtype?: string }).subtype === 'task_started') {
          // A background subagent was spawned. Surface it (and count it in the poll
          // loop): while it runs the main agent emits nothing, and on prod
          // 2026-09-09 the 20-min idle-end ended a wiki fold under four live
          // subagents, killing them with the query.
          const ts = message as { description?: string; summary?: string; task_id?: string; task_type?: string };
          yield {
            type: 'progress',
            message: `Task started: ${ts.description || ts.summary || ts.task_type || ts.task_id || 'background task'}`,
            task: 'started',
          };
        } else if (
          message.type === 'system' &&
          ((message as { subtype?: string }).subtype === 'task_progress' ||
            (message as { subtype?: string }).subtype === 'task_updated')
        ) {
          // Subagent heartbeat: activity only (keeps the idle timer and the
          // container heartbeat fresh without a log line per tool call).
          yield { type: 'activity' };
        }
      }
      // A background subagent that finished after the last SDK message.
      while (pendingUsage.length > 0) yield pendingUsage.shift()!;
      log(`Query completed after ${messageCount} SDK messages`);
    }

    return {
      push: (msg) => stream.push(msg),
      end: () => stream.end(),
      events: translateEvents(),
      drainPendingUsage: () => pendingUsage.splice(0),
      abort: () => {
        aborted = true;
        stream.end();
      },
      kill: () => {
        aborted = true;
        stream.end();
        sdkAbort.abort();
      },
    };
  }
}

// Function-form registration only; the runtime contract attaches itself from
// provider-contracts/claude.ts through the same two-step path any
// skill-installed provider uses.
registerProvider('claude', (opts, configuration) => {
  if (!configuration) {
    throw new Error('Claude provider requires its runtime contract; construct it through createProvider');
  }
  return new ClaudeProvider(opts, configuration);
});
