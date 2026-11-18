/**
 * Claude Code hooks for OpenCode groups (fork-owned).
 *
 * The host writes every group's gate hooks (critique, plan, eval sandbox, PR
 * checks, telemetry, ...) into `~/.claude/settings.json` in Claude Code's hook
 * format. Claude Code runs them; OpenCode never reads that file, so before this
 * bridge an OpenCode group ran with every gate silently off. The bridge is an
 * OpenCode plugin that turns OpenCode's tool and chat events into the same hook
 * calls and runs the same hook scripts, so the scripts stay the single source
 * of truth for all providers:
 *
 *   OpenCode event                 Claude Code hook event
 *   tool.execute.before        ->  PreToolUse    (exit 2 or a deny decision blocks the tool)
 *     ... of todowrite         ->  TaskCreated, TaskCompleted (a block refuses the write)
 *   tool.execute.after         ->  PostToolUse   (a block reason is appended to the tool output)
 *   event: a tool part in error ->  PostToolUseFailure (OpenCode skips tool.execute.after then)
 *   chat.message               ->  UserPromptSubmit (context joins the prompt; not for a subagent's prompt)
 *   event: a child session     ->  SubagentStart, SubagentStop (opencode-lifecycle.ts)
 *   experimental.session.compacting -> PreCompact (stdout joins the compaction prompt)
 *   event: session.compacted   ->  SessionStart (source compact), PostCompact
 *
 * SessionStart (startup, resume) and SessionEnd belong to the provider's
 * query, not to an OpenCode event: the runner shares one OpenCode server
 * between queries and kills it without a shutdown, and it never deletes a
 * session, so no OpenCode event marks where a Claude Code session would end.
 * The provider runs them through `settingsSessionHooks` when a query starts
 * and ends, as the Claude Code CLI does for each query.
 *
 * A tool call inside a subagent runs in an OpenCode child session. Claude Code
 * reports such a call in the main session, with the subagent's `agent_id` and
 * `agent_type`: the dashboard files it under the main session, and
 * spawn-buddy.sh forwards `session_id` to find the main session's transcript.
 * The tool events take these fields from the lifecycle tracker
 * (`sessionFields`), and OpenCode's `callID` as `tool_use_id`, which the
 * dashboard uses to pair a PreToolUse with its PostToolUse.
 *
 * Consider an OpenCode reviewer that calls the NanoClaw MCP tool to send
 * "[Review Verdict] ..." before any critique. OpenCode names the tool
 * `nanoclaw_send_message`; the bridge calls the PreToolUse hooks with
 * `tool_name: "mcp__nanoclaw__send_message"` and the tool's own arguments, so
 * `gate-critique-on-deliver.sh` sees exactly what it sees under Claude, exits 2,
 * and the bridge throws, which OpenCode reports to the model as a failed tool
 * call with the hook's reason.
 *
 * The issue-close backstop is an in-process check under Claude
 * (`createPreToolUseHook`), not a script, so the bridge runs the same
 * `detectIssueClose` before the hook scripts.
 *
 * The in-flight tool record is in-process under Claude too: its PreToolUse
 * callback writes `container_state` in the session's outbound.db and its
 * PostToolUse callback clears it. The host's stuck check reads that row to give
 * a long Bash call its declared timeout. The bridge writes the same row through
 * the same mailbox calls once a tool call passes its gates, and clears it when
 * the call finishes or fails. The plugin file OpenCode loads imports the
 * runner's capability barrel first, so the OpenCode process has the mailbox
 * the runner, the MCP server and `ncl` each register for themselves.
 *
 * The hook semantics (matchers, block rules, the settings file) live in
 * settings-hooks.ts. Stop hooks need the runner, which owns the turn, so the
 * runner runs them (stop-hooks.ts); they are not handled here.
 * The intent router stays in the runner's bridge (`classifyAndPrepend`), which
 * already routes every non-Claude prompt, so its UserPromptSubmit entry is
 * skipped here to avoid classifying a message twice.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { clearContainerToolInFlight, declaredToolTimeoutMs, setContainerToolInFlight } from '../db/container-state.js';
import { issueCloseRefusal } from '../issue-close.js';
import {
  claudeToolResponse,
  hookSettingsPath,
  readHookSettings,
  runHookEvent,
  type HookOutcome,
} from '../settings-hooks.js';
import {
  OpenCodeLifecycle,
  todoList,
  type LifecycleHookCall,
  type OpenCodeEvent,
  type OpenCodeTodo,
} from './opencode-lifecycle.js';
import { createOpenCodeId } from './opencode-turn.js';

const PLUGIN_FILE = 'nanoclaw-hook-bridge.js';
const TODO_READ_TIMEOUT_MS = 5_000;

// OpenCode's built-in tools and the Claude Code tool each one stands in for.
const BUILTIN_TOOLS: Record<string, string> = {
  bash: 'Bash',
  edit: 'Edit',
  multiedit: 'MultiEdit',
  patch: 'Edit',
  write: 'Write',
  read: 'Read',
  glob: 'Glob',
  grep: 'Grep',
  list: 'LS',
  webfetch: 'WebFetch',
  websearch: 'WebSearch',
  task: 'Task',
  todowrite: 'TodoWrite',
  skill: 'Skill',
};

/**
 * Return the Claude Code name of an OpenCode tool. Built-in tools map by table;
 * an MCP tool, which OpenCode names `<server>_<tool>`, becomes
 * `mcp__<server>__<tool>`. Servers are tried longest first, because a server
 * name may itself contain the separator (`slang-mcp_github_get_issue` belongs
 * to `slang-mcp`, not to a server named `slang`).
 */
export function claudeToolName(tool: string, mcpServers: readonly string[]): string {
  if (BUILTIN_TOOLS[tool]) return BUILTIN_TOOLS[tool];
  for (const server of [...mcpServers].sort((a, b) => b.length - a.length)) {
    if (tool.startsWith(`${server}_`)) return `mcp__${server}__${tool.slice(server.length + 1)}`;
  }
  return tool;
}

/**
 * Return the hook `tool_input` for a tool call. OpenCode names the arguments of
 * its built-in tools in camelCase (`filePath`, `oldString`); Claude Code's, which
 * the hook scripts read, are snake_case (`file_path`, `old_string`). MCP tools
 * keep their own schema under both providers, so their arguments pass through.
 */
export function claudeToolInput(claudeName: string, args: unknown): Record<string, unknown> {
  const input = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  if (claudeName.startsWith('mcp__')) return { ...input };
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), value]),
  );
}

/** The MCP server names in OpenCode's generated config (`OPENCODE_CONFIG_CONTENT`). */
export function mcpServerNames(configContent: string | undefined): string[] {
  try {
    const config = JSON.parse(configContent ?? '{}') as { mcp?: Record<string, unknown> };
    return Object.keys(config.mcp ?? {});
  } catch {
    return [];
  }
}

const ROUTER_HOOK = /\/intent-router\.sh\b/;

/**
 * Return the part that adds a UserPromptSubmit hook's context to the prompt.
 * Claude Code adds that context (a hook's plain stdout or its
 * `additionalContext`) next to the user's prompt. OpenCode calls chat.message
 * before it saves the message, with the message's parts, so a synthetic text
 * part pushed there is saved with the prompt and sent to the model, as the
 * synthetic parts OpenCode adds itself are. Its id is made one millisecond
 * later than now, so it sorts after the prompt's own parts.
 */
export function promptContextPart(sessionID: string, messageID: string, context: string): Record<string, unknown> {
  return {
    id: createOpenCodeId('prt', Date.now() + 1),
    sessionID,
    messageID,
    type: 'text',
    text: context,
    synthetic: true,
  };
}

/** The text of a chat message's parts (the user prompt). */
function promptText(parts: unknown): string {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) =>
      p && typeof p === 'object' && (p as { type?: unknown }).type === 'text'
        ? String((p as { text?: unknown }).text ?? '')
        : '',
    )
    .join('\n');
}

/** A tool call that failed, read from an OpenCode `message.part.updated` event. */
export interface FailedToolCall {
  sessionID: string;
  callID: string;
  tool: string;
  input: unknown;
  error: string;
}

/** The failed tool call an OpenCode event reports, or null for any other event. */
export function failedToolPart(event: OpenCodeEvent): FailedToolCall | null {
  if (event.type !== 'message.part.updated') return null;
  const part = event.properties?.part as
    | {
        type?: string;
        sessionID?: string;
        callID?: string;
        tool?: string;
        state?: { status?: string; input?: unknown; error?: unknown };
      }
    | undefined;
  if (part?.type !== 'tool' || part.state?.status !== 'error' || !part.callID || !part.tool) return null;
  return {
    sessionID: part.sessionID ?? '',
    callID: part.callID,
    tool: part.tool,
    input: part.state.input,
    error: typeof part.state.error === 'string' ? part.state.error : String(part.state.error ?? ''),
  };
}

/**
 * Record `toolName` as the tool in flight, or clear the record when it is null.
 * A failed write is logged and ignored: the record only informs the host's
 * stuck check, and must not fail the tool call.
 */
function recordToolInFlight(toolName: string | null, toolInput?: Record<string, unknown>): void {
  try {
    if (toolName === null) clearContainerToolInFlight();
    else setContainerToolInFlight(toolName, declaredToolTimeoutMs(toolName, toolInput));
  } catch (err) {
    console.error(
      `[nanoclaw-hook-bridge] could not record the tool in flight: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** The part of the OpenCode SDK client (the plugin context's `client`) the bridge uses. */
export interface OpenCodeTodoClient {
  session: {
    todo(options: { path: { id: string }; signal?: AbortSignal }): Promise<{ data?: unknown; error?: unknown }>;
  };
}

/**
 * Return the todo list OpenCode stores for `sessionID`, or null when the
 * server does not answer. A todowrite replaces the whole list, so the stored
 * list is what the write changes.
 */
export async function storedTodos(
  client: OpenCodeTodoClient | undefined,
  sessionID: string,
): Promise<OpenCodeTodo[] | null> {
  if (!client) return null;
  try {
    const result = await client.session.todo({
      path: { id: sessionID },
      signal: AbortSignal.timeout(TODO_READ_TIMEOUT_MS),
    });
    return Array.isArray(result.data) ? todoList(result.data) : null;
  } catch {
    return null;
  }
}

/**
 * The OpenCode plugin. OpenCode calls every export of a plugin module, so the
 * file OpenCode loads re-exports only this function (see installOpenCodeHookBridge).
 */
export const NanoclawHookBridge = async (ctx: { client?: OpenCodeTodoClient } = {}) => {
  const settingsPath = hookSettingsPath();
  const servers = mcpServerNames(process.env.OPENCODE_CONFIG_CONTENT);
  const settings = () => readHookSettings(settingsPath);
  const lifecycle = new OpenCodeLifecycle();
  const run = (call: LifecycleHookCall) => runHookEvent(settings(), call.event, call.matchTarget, call.payload);
  // A failed tool part can update several times; run its failure hooks once.
  const failedCalls = new Set<string>();

  // Run the TaskCreated and TaskCompleted hooks of a todowrite, one task at a
  // time as Claude Code creates them. A block refuses the whole write, which
  // leaves the stored list as it was, as a blocked TaskCreate leaves no task.
  async function runTaskHooks(sessionID: string, todos: unknown): Promise<HookOutcome> {
    const before = await storedTodos(ctx.client, sessionID);
    if (!before) {
      console.error(`[nanoclaw-hook-bridge] no todo list for session ${sessionID}; task hooks not run`);
      return { block: false, reason: '' };
    }
    const reasons: string[] = [];
    for (const call of lifecycle.taskCalls(sessionID, before, todoList(todos))) {
      const outcome = await run(call);
      if (outcome.block) reasons.push(outcome.reason);
    }
    return reasons.length > 0 ? { block: true, reason: reasons.join('\n\n') } : { block: false, reason: '' };
  }

  return {
    event: async ({ event }: { event: OpenCodeEvent }) => {
      // The tracker reads the event before anything awaits (see opencode-lifecycle.ts).
      const calls = lifecycle.observe(event);
      // OpenCode does not call tool.execute.after for a tool that throws, so a
      // failed call reaches the hooks from the event stream instead, as Claude
      // Code's PostToolUseFailure (the dashboard records it, as for Claude).
      const failure = failedToolPart(event);
      if (failure && !failedCalls.has(failure.callID)) {
        failedCalls.add(failure.callID);
        recordToolInFlight(null);
        const toolName = claudeToolName(failure.tool, servers);
        await runHookEvent(settings(), 'PostToolUseFailure', toolName, {
          ...lifecycle.sessionFields(failure.sessionID),
          tool_name: toolName,
          tool_input: claudeToolInput(toolName, failure.input),
          tool_use_id: failure.callID,
          error: failure.error,
        });
      }
      for (const call of calls) await run(call);
    },
    'tool.execute.before': async (
      input: { tool: string; sessionID?: string; callID?: string },
      output: { args?: unknown },
    ) => {
      const toolName = claudeToolName(input.tool, servers);
      const toolInput = claudeToolInput(toolName, output.args);
      if (toolName === 'Bash') {
        const refusal = issueCloseRefusal(toolInput.command as string | undefined);
        if (refusal) throw new Error(refusal);
      }
      const outcome = await runHookEvent(settings(), 'PreToolUse', toolName, {
        ...lifecycle.sessionFields(input.sessionID ?? ''),
        tool_name: toolName,
        tool_input: toolInput,
        ...(input.callID ? { tool_use_id: input.callID } : {}),
      });
      if (outcome.block) throw new Error(outcome.reason);
      if (toolName === 'TodoWrite') {
        const tasks = await runTaskHooks(input.sessionID ?? '', toolInput.todos);
        if (tasks.block) throw new Error(tasks.reason);
      }
      recordToolInFlight(toolName, toolInput);
    },
    'tool.execute.after': async (
      input: { tool: string; sessionID?: string; callID?: string; args?: unknown },
      output: { args?: unknown; output?: unknown; content?: unknown },
    ) => {
      const toolName = claudeToolName(input.tool, servers);
      recordToolInFlight(null);
      // OpenCode 1.18 passes the arguments of a finished tool in `input`, not `output`.
      const outcome = await runHookEvent(settings(), 'PostToolUse', toolName, {
        ...lifecycle.sessionFields(input.sessionID ?? ''),
        tool_name: toolName,
        tool_input: claudeToolInput(toolName, input.args ?? output.args),
        tool_response: claudeToolResponse(toolName, output),
        ...(input.callID ? { tool_use_id: input.callID } : {}),
      });
      if (outcome.block && typeof output.output === 'string') output.output = `${output.output}\n\n${outcome.reason}`;
    },
    'chat.message': async (
      input: { sessionID?: string; messageID?: string },
      output: { message?: { id?: string }; parts?: unknown[] },
    ) => {
      // OpenCode sends a task's prompt to the child session as a chat message.
      // Claude Code reports a subagent's start as SubagentStart, never as a
      // user prompt, and workflow-state-reset.sh must not reset a workflow
      // because a subagent started.
      if (lifecycle.isSubagent(input.sessionID ?? '')) return;
      const outcome = await runHookEvent(
        settings(),
        'UserPromptSubmit',
        '',
        { session_id: input.sessionID ?? '', prompt: promptText(output.parts) },
        { skip: ROUTER_HOOK },
      );
      const messageID = output.message?.id ?? input.messageID;
      if (outcome.context && messageID && Array.isArray(output.parts)) {
        output.parts.push(promptContextPart(input.sessionID ?? '', messageID, outcome.context));
      }
    },
    // Claude Code uses a PreCompact hook's stdout as instructions for the
    // summary; compact-instructions.ts writes the delivery rules there. This
    // hook cannot cancel an OpenCode compaction, so a block only drops them.
    'experimental.session.compacting': async (input: { sessionID: string }, output: { context: string[] }) => {
      const outcome = await run(lifecycle.preCompact(input.sessionID));
      if (outcome.context) output.context.push(outcome.context);
    },
  };
};

/** Runs the group's SessionStart and SessionEnd hooks for the OpenCode provider's queries. */
export interface OpenCodeSessionHooks {
  /** A query starts on `sessionId`: a session it created (`startup`) or a stored continuation (`resume`). */
  start(sessionId: string, source: 'startup' | 'resume', model?: string): Promise<void>;
  /** The query on `sessionId` ends. */
  end(sessionId: string): Promise<void>;
}

/**
 * Return the session hooks that read the group's settings.json. Each call
 * reads the file again, as the bridge does, so a hook the host adds while the
 * container runs takes effect. Claude Code ends an SDK query's session with
 * `reason: "other"`, so SessionEnd uses it too.
 */
export function settingsSessionHooks(env: NodeJS.ProcessEnv = process.env): OpenCodeSessionHooks {
  const settingsPath = hookSettingsPath(env);
  return {
    async start(sessionId, source, model) {
      await runHookEvent(readHookSettings(settingsPath), 'SessionStart', source, {
        session_id: sessionId,
        source,
        ...(model ? { model } : {}),
      });
    },
    async end(sessionId) {
      await runHookEvent(readHookSettings(settingsPath), 'SessionEnd', 'other', {
        session_id: sessionId,
        reason: 'other',
      });
    },
  };
}

/**
 * Put the bridge where OpenCode loads plugins: the native global plugin
 * directory. A plugin found there is not a declared plugin, so server startup
 * does not wait for a package install (see the add-opencode ARCHITECTURE.md
 * "Offline startup" section). The file is the OpenCode process's entry into
 * the runner code: it imports the capability barrel, which registers the
 * session mailbox as the runner's own entry does, and re-exports only
 * `NanoclawHookBridge`, because OpenCode would call any other export as a
 * plugin too.
 */
export function installOpenCodeHookBridge(
  configHome: string = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || os.homedir(), '.config'),
  bridgeModule: string = fileURLToPath(import.meta.url),
  barrelModule: string = fileURLToPath(new URL('../modules/index.ts', import.meta.url)),
): string {
  const dir = path.join(configHome, 'opencode', 'plugin');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, PLUGIN_FILE);
  fs.writeFileSync(
    file,
    `import ${JSON.stringify(barrelModule)};\nexport { NanoclawHookBridge } from ${JSON.stringify(bridgeModule)};\n`,
  );
  return file;
}
