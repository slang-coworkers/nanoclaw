import fs from 'fs';
import os from 'os';
import path from 'path';

import { query as sdkQuery, type HookCallback, type PreCompactHookInput } from '@anthropic-ai/claude-agent-sdk';

import { clearContainerToolInFlight, setContainerToolInFlight } from '../db/connection.js';
import { BUILTIN_MCP_SERVER, isMcpToolAllowed, parseMcpPolicy, type McpPolicy } from '../mcp-policy.js';
import type { MemorySessionHookRegistration } from '../memory/session-hook.js';
import { resolveEnvInherit } from './codex-app-server.js';
import { TIMEZONE, formatLocalStamp } from '../timezone.js';
import { registerProvider } from './provider-registry.js';
import type {
  AgentProvider,
  AgentQuery,
  McpServerConfig,
  ProviderEvent,
  ProviderOptions,
  QueryInput,
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

// Deferred SDK builtins that either sidestep nanoclaw's own scheduling or
// don't fit our async message-passing model (they're designed for Claude
// Code's interactive UI and would hang here).
//
// - CronCreate / CronDelete / CronList / ScheduleWakeup: we have durable
//   scheduling via `ncl tasks`.
// - AskUserQuestion: SDK returns a placeholder instead of blocking on a
//   real answer — we have mcp__nanoclaw__ask_user_question that persists
//   the question and blocks on the real reply.
// - SendMessage: addresses Claude Code's own in-session subagents, which are
//   unrelated to NanoClaw agent groups — but the name reads as the obvious
//   way to message another agent, so an agent that just called
//   mcp__nanoclaw__create_agent reaches for it and gets "No agent named 'x'
//   is currently addressable". mcp__nanoclaw__send_message is the real
//   agent-to-agent path (it resolves the destination map in inbound.db).
// - EnterPlanMode / ExitPlanMode / EnterWorktree / ExitWorktree: Claude
//   Code UI affordances; in a headless container they'd appear stuck.
// - DesignSync: desktop design-tool integration — nothing to sync with in a
//   headless container (~9.3KB/turn schema).
// - ReportFindings: code-review-reporting UI affordance with no headless
//   host surface to receive it (~1.9KB/turn schema).
export const SDK_DISALLOWED_TOOLS = [
  'CronCreate',
  'CronDelete',
  'CronList',
  'ScheduleWakeup',
  'AskUserQuestion',
  'SendMessage',
  'EnterPlanMode',
  'ExitPlanMode',
  'EnterWorktree',
  'ExitWorktree',
  'DesignSync',
  'ReportFindings',
];

// Base tool allowlist for NanoClaw agent containers (always included).
// MCP-tool entries are derived at the call site from the registered
// `mcpServers` map so that any server added via `add_mcp_server` (or wired
// in container.json directly) is reachable to the agent — without this,
// the SDK's allowedTools filter silently drops every MCP namespace not
// listed here.
//
// Exported because claude.tool-collisions.test.ts asserts this list never
// re-admits a tool named in SDK_DISALLOWED_TOOLS (upstream 81b18a9f).
export const TOOL_ALLOWLIST = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'Task',
  'TaskOutput',
  'TaskStop',
  'TeamCreate',
  'TeamDelete',
  'TodoWrite',
  'ToolSearch',
  'Skill',
  'NotebookEdit',
];

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
  if (policy.state === 'unrestricted' || !env?.NANOCLAW_MCP_TOOL_INVENTORY) return undefined;
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
  if (policy.state === 'unrestricted') return serverNames.map(mcpAllowPattern);
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
    `(policy: ${policy.state} — ${policy.origin}). This is a configuration boundary, not a transient ` +
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

// ── Transcript archiving (PreCompact hook) ──

interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
}

function parseTranscript(content: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'user' && entry.message?.content) {
        const text =
          typeof entry.message.content === 'string'
            ? entry.message.content
            : entry.message.content.map((c: { text?: string }) => c.text || '').join('');
        if (text) messages.push({ role: 'user', content: text });
      } else if (entry.type === 'assistant' && entry.message?.content) {
        const textParts = entry.message.content
          .filter((c: { type: string }) => c.type === 'text')
          .map((c: { text: string }) => c.text);
        const text = textParts.join('');
        if (text) messages.push({ role: 'assistant', content: text });
      }
    } catch {
      /* skip unparseable lines */
    }
  }
  return messages;
}

function formatTranscriptMarkdown(messages: ParsedMessage[], title?: string | null, assistantName?: string): string {
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const lines = [`# ${title || 'Conversation'}`, '', `Archived: ${dateStr}`, '', '---', ''];
  for (const msg of messages) {
    const sender = msg.role === 'user' ? 'User' : assistantName || 'Assistant';
    const content = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '...' : msg.content;
    lines.push(`**${sender}**: ${content}`, '');
  }
  return lines.join('\n');
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
    log(`PreToolUse: denied ${toolName} (policy ${policy.state})`);
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

/**
 * Read a Claude transcript .jsonl, render a markdown summary, and drop it into
 * the agent's `conversations/` folder so context survives a compaction or a
 * session rotation. Best-effort: returns false (and logs) on any failure.
 */
function archiveTranscriptFile(
  transcriptPath: string | undefined,
  sessionId: string | undefined,
  assistantName?: string,
): boolean {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    log('No transcript found for archiving');
    return false;
  }

  try {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const messages = parseTranscript(content);
    if (messages.length === 0) return false;

    // Try to get summary from sessions index
    let summary: string | undefined;
    const indexPath = path.join(path.dirname(transcriptPath), 'sessions-index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        summary = index.entries?.find(
          (e: { sessionId: string; summary?: string }) => e.sessionId === sessionId,
        )?.summary;
      } catch {
        /* ignore */
      }
    }

    const name = summary
      ? summary
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 50)
      : `conversation-${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')}`;

    const conversationsDir = process.env.NANOCLAW_CONVERSATIONS_DIR || '/workspace/agent/conversations';
    fs.mkdirSync(conversationsDir, { recursive: true });
    // Local calendar date — the fallback `name` above already uses local
    // hours, and the agent navigates conversations/ by these date prefixes.
    const filename = `${formatLocalStamp(new Date(), TIMEZONE).slice(0, 10)}-${name}.md`;
    fs.writeFileSync(path.join(conversationsDir, filename), formatTranscriptMarkdown(messages, summary, assistantName));
    log(`Archived conversation to ${filename}`);
    return true;
  } catch (err) {
    log(`Failed to archive transcript: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function createPreCompactHook(assistantName?: string): HookCallback {
  return async (input) => {
    const preCompact = input as PreCompactHookInput;
    archiveTranscriptFile(preCompact.transcript_path, preCompact.session_id, assistantName);
    return {};
  };
}

// ── Continuation rotation (cold-resume guard) ──

/**
 * Resume cost is dominated by transcript size. Past this many bytes a fresh
 * cold container can't reload the .jsonl before the host's 30-min idle ceiling
 * fires, so the session is dropped and started clean. Operator-overridable.
 */
function transcriptRotateBytes(): number {
  return Number(process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES) || 12 * 1024 * 1024;
}

/**
 * Secondary age trigger, measured from the transcript's first entry. 0 (or a
 * non-positive value) disables the age check; size alone then governs.
 */
function transcriptRotateAgeMs(): number {
  const raw = process.env.CLAUDE_TRANSCRIPT_ROTATE_AGE_DAYS;
  if (raw === undefined || raw.trim() === '') return 14 * 86_400_000;
  const days = Number(raw);
  if (!Number.isFinite(days)) return 14 * 86_400_000;
  // Explicit non-positive override disables the age check; size alone governs.
  return days > 0 ? days * 86_400_000 : Infinity;
}

function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(process.env.HOME || os.homedir(), '.claude');
}

function claudeProjectsDir(): string {
  return path.join(claudeConfigDir(), 'projects');
}

// Wire the shared memory tree into Claude's native SessionStart hook: write a
// hooks.SessionStart entry into settings.json that runs the memory hook command
// on the given sources. Idempotent — any prior entry for the same command (or a
// legacy alias) is stripped before re-adding, so repeated boots don't stack
// duplicate hooks.
function writeMemorySessionHook(hook: MemorySessionHookRegistration): void {
  const configDir = claudeConfigDir();
  const settingsFile = path.join(configDir, 'settings.json');
  fs.mkdirSync(configDir, { recursive: true });

  const parsed: unknown = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf-8')) : {};
  if (!isRecord(parsed)) throw new Error(`${settingsFile} must contain a JSON object`);

  const hooks = parsed.hooks === undefined ? {} : parsed.hooks;
  if (!isRecord(hooks)) throw new Error(`${settingsFile} hooks must be a JSON object`);

  const sessionStart = hooks.SessionStart === undefined ? [] : hooks.SessionStart;
  if (!Array.isArray(sessionStart)) throw new Error(`${settingsFile} hooks.SessionStart must be an array`);

  const memoryCommands = new Set([hook.command, ...hook.legacyCommands]);
  const nextSessionStart = sessionStart
    .map((entry) => removeMemoryCommands(entry, memoryCommands))
    .filter((entry) => entry !== undefined);
  nextSessionStart.push({
    matcher: hook.sources.join('|'),
    hooks: [{ type: 'command', command: hook.command, timeout: 10 }],
  });

  hooks.SessionStart = nextSessionStart;
  parsed.hooks = hooks;
  fs.writeFileSync(settingsFile, JSON.stringify(parsed, null, 2) + '\n');
}

function removeMemoryCommands(value: unknown, commands: ReadonlySet<string>): unknown {
  if (!isRecord(value) || !Array.isArray(value.hooks)) return value;
  const hooks = value.hooks.filter((hook) => {
    if (!isRecord(hook)) return true;
    return typeof hook.command !== 'string' || !commands.has(hook.command);
  });
  return hooks.length > 0 ? { ...value, hooks } : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Locate the .jsonl backing a session id. The SDK names project dirs by a
 * mangled cwd; rather than reproduce that convention we scan project dirs for
 * `<sessionId>.jsonl` (session ids are UUIDs, so this is unambiguous).
 */
function findTranscriptPath(sessionId: string): string | null {
  const projects = claudeProjectsDir();
  let dirs: string[];
  try {
    dirs = fs.readdirSync(projects);
  } catch {
    return null;
  }
  for (const dir of dirs) {
    const candidate = path.join(projects, dir, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Epoch-ms of the first transcript entry, or null if unreadable. */
function transcriptStartMs(transcriptPath: string): number | null {
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const buf = Buffer.alloc(4096);
      const n = fs.readSync(fd, buf, 0, buf.length, 0);
      const firstLine = buf.toString('utf-8', 0, n).split('\n', 1)[0];
      const ts = JSON.parse(firstLine)?.timestamp;
      const ms = ts ? Date.parse(ts) : NaN;
      return Number.isNaN(ms) ? null : ms;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

// ── Provider ──

/**
 * Claude Code auto-compacts context at this window (tokens). Default is
 * tuned for a 200K context model (~80% fill). For 1M models (model ID
 * contains "[1m]"), we raise the window to 900K so the agent can use the
 * full context before compacting. Operator override: set
 * CLAUDE_CODE_AUTO_COMPACT_WINDOW in the host env to raise or lower the
 * threshold without editing source.
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
  readonly supportsNativeSlashCommands = true;

  private assistantName?: string;
  private mcpServers: Record<string, McpServerConfig>;
  private env: Record<string, string | undefined>;
  private additionalDirectories?: string[];
  private mcpPolicy: McpPolicy;
  private blockedTools?: string[];
  private model?: string;
  private effort?: string;
  private fallbackModel?: string;
  private memorySessionHook?: MemorySessionHookRegistration;

  constructor(options: ProviderOptions = {}) {
    this.assistantName = options.assistantName;
    this.additionalDirectories = options.additionalDirectories;
    this.model = options.model;
    this.effort = options.effort;
    this.fallbackModel = options.fallbackModel;
    this.env = {
      ...(options.env ?? {}),
      CLAUDE_CODE_AUTO_COMPACT_WINDOW,
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
      resolved[name] = { command: cfg.command, args: cfg.args, env: mergedEnv };
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
      if (this.mcpPolicy.state !== 'unrestricted' && !this.mcpPolicy.tools.some((t) => t.startsWith(prefix))) {
        log(`Not wiring MCP server "${name}" — no allowed tools under the ${this.mcpPolicy.state} policy`);
        delete this.mcpServers[name];
      }
    }
  }

  registerMemorySessionHook(hook: MemorySessionHookRegistration): void {
    writeMemorySessionHook(hook);
    this.memorySessionHook = hook;
  }

  isSessionInvalid(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return STALE_SESSION_RE.test(msg);
  }

  maybeRotateContinuation(continuation: string): string | null {
    const transcriptPath = findTranscriptPath(continuation);
    if (!transcriptPath) return null;

    let size: number;
    try {
      size = fs.statSync(transcriptPath).size;
    } catch {
      return null;
    }

    const maxBytes = transcriptRotateBytes();
    const startMs = transcriptStartMs(transcriptPath);
    const ageMs = startMs === null ? 0 : Date.now() - startMs;
    const maxAgeMs = transcriptRotateAgeMs();

    let reason: string | null = null;
    if (size > maxBytes) {
      reason = `transcript ${(size / 1_048_576).toFixed(1)}MB > ${(maxBytes / 1_048_576).toFixed(0)}MB cap`;
    } else if (startMs !== null && ageMs > maxAgeMs) {
      reason = `transcript ${(ageMs / 86_400_000).toFixed(1)}d old > ${(maxAgeMs / 86_400_000).toFixed(0)}d cap`;
    }
    if (!reason) return null;

    // Preserve a readable summary, then move the heavy .jsonl out of the
    // resume path so the SDK starts a fresh session and the disk is reclaimed.
    archiveTranscriptFile(transcriptPath, continuation, this.assistantName);
    try {
      fs.renameSync(transcriptPath, `${transcriptPath}.rotated-${Date.now()}`);
    } catch (err) {
      log(`Failed to move rotated transcript aside: ${err instanceof Error ? err.message : String(err)}`);
    }
    return reason;
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

    const sdkResult = sdkQuery({
      prompt: stream,
      options: {
        pathToClaudeCodeExecutable: claudeExecutable,
        cwd: input.cwd,
        additionalDirectories: this.additionalDirectories,
        resume: input.continuation,
        systemPrompt: instructions
          ? { type: 'preset' as const, preset: 'claude_code' as const, append: instructions }
          : undefined,
        allowedTools: [...TOOL_ALLOWLIST, ...mcpAllowedToolEntries(this.mcpPolicy, Object.keys(this.mcpServers))],
        disallowedTools: [...SDK_DISALLOWED_TOOLS, ...(this.blockedTools ?? [])],
        env: this.env,
        model: this.model,
        fallbackModel: this.fallbackModel,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        effort: this.effort as any,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        settingSources: ['project', 'user', 'local'],
        mcpServers: this.mcpServers,
        hooks: {
          PreToolUse: [{ hooks: [createPreToolUseHook(this.mcpPolicy)] }],
          PostToolUse: [{ hooks: [postToolUseHook] }],
          PostToolUseFailure: [{ hooks: [postToolUseHook] }],
          PreCompact: [{ hooks: [createPreCompactHook(this.assistantName)] }],
        },
      },
    });

    let aborted = false;

    async function* translateEvents(): AsyncGenerator<ProviderEvent> {
      let messageCount = 0;
      for await (const message of sdkResult) {
        if (aborted) return;
        messageCount++;

        // Yield activity for every SDK event so the poll loop knows the agent is working
        yield { type: 'activity' };

        if (message.type === 'system' && message.subtype === 'init') {
          yield { type: 'init', continuation: message.session_id };
        } else if (message.type === 'result') {
          // `result` text exists only on subtype:"success"; error subtypes
          // (e.g. a non-retryable 403 billing_error) carry their message in
          // `errors[]` instead. Surface either so the poll-loop can deliver a
          // billing/quota notice to the user rather than dropping the turn.
          const m = message as { result?: string; is_error?: boolean; errors?: string[] };
          const text = m.result ?? (m.errors && m.errors.length > 0 ? m.errors.join('\n') : null);
          yield { type: 'result', text, isError: m.is_error === true };
          // Emit structured per-turn usage so the poll-loop can log
          // a grep-friendly line. Fields come from the SDK's result
          // message (shape: { usage: { input_tokens, cache_*_input_tokens,
          // output_tokens, cache_creation: { ephemeral_*_input_tokens } },
          // duration_ms, total_cost_usd, num_turns, session_id }).
          const r = message as {
            session_id?: string;
            duration_ms?: number;
            total_cost_usd?: number;
            num_turns?: number;
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
          if (r.usage) {
            yield {
              type: 'usage',
              inputTokens: r.usage.input_tokens ?? 0,
              outputTokens: r.usage.output_tokens ?? 0,
              cacheCreationInputTokens: r.usage.cache_creation_input_tokens ?? 0,
              cacheReadInputTokens: r.usage.cache_read_input_tokens ?? 0,
              ephemeral1hInputTokens: r.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
              ephemeral5mInputTokens: r.usage.cache_creation?.ephemeral_5m_input_tokens ?? 0,
              durationMs: r.duration_ms ?? 0,
              totalCostUsd: r.total_cost_usd ?? 0,
              numTurns: r.num_turns ?? 0,
              sessionId: r.session_id ?? null,
            };
          }
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
          const tn = message as { summary?: string };
          yield { type: 'progress', message: tn.summary || 'Task notification' };
        }
      }
      log(`Query completed after ${messageCount} SDK messages`);
    }

    return {
      push: (msg) => stream.push(msg),
      end: () => stream.end(),
      events: translateEvents(),
      abort: () => {
        aborted = true;
        stream.end();
      },
    };
  }
}

registerProvider('claude', (opts) => new ClaudeProvider(opts));
