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
 *   tool.execute.after         ->  PostToolUse   (a block reason is appended to the tool output)
 *   event: a tool part in error ->  PostToolUseFailure (OpenCode skips tool.execute.after then)
 *   chat.message               ->  UserPromptSubmit (side effects only)
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

import { issueCloseRefusal } from '../issue-close.js';
import { claudeToolResponse, hookSettingsPath, readHookSettings, runHookEvent } from '../settings-hooks.js';

const PLUGIN_FILE = 'nanoclaw-hook-bridge.js';

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
export function failedToolPart(event: { type?: string; properties?: Record<string, unknown> }): FailedToolCall | null {
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
 * The OpenCode plugin. OpenCode calls every export of a plugin module, so the
 * file OpenCode loads re-exports only this function (see installOpenCodeHookBridge).
 */
export const NanoclawHookBridge = async () => {
  const settingsPath = hookSettingsPath();
  const servers = mcpServerNames(process.env.OPENCODE_CONFIG_CONTENT);
  const settings = () => readHookSettings(settingsPath);
  // A failed tool part can update several times; run its failure hooks once.
  const failedCalls = new Set<string>();
  return {
    // OpenCode does not call tool.execute.after for a tool that throws, so a
    // failed call reaches the hooks from the event stream instead, as Claude
    // Code's PostToolUseFailure (the dashboard records it, as for Claude).
    event: async ({ event }: { event: { type?: string; properties?: Record<string, unknown> } }) => {
      const failure = failedToolPart(event);
      if (!failure || failedCalls.has(failure.callID)) return;
      failedCalls.add(failure.callID);
      const toolName = claudeToolName(failure.tool, servers);
      await runHookEvent(settings(), 'PostToolUseFailure', toolName, {
        session_id: failure.sessionID,
        tool_name: toolName,
        tool_input: claudeToolInput(toolName, failure.input),
        tool_use_id: failure.callID,
        error: failure.error,
      });
    },
    'tool.execute.before': async (input: { tool: string; sessionID?: string }, output: { args?: unknown }) => {
      const toolName = claudeToolName(input.tool, servers);
      const toolInput = claudeToolInput(toolName, output.args);
      if (toolName === 'Bash') {
        const refusal = issueCloseRefusal(toolInput.command as string | undefined);
        if (refusal) throw new Error(refusal);
      }
      const outcome = await runHookEvent(settings(), 'PreToolUse', toolName, {
        session_id: input.sessionID ?? '',
        tool_name: toolName,
        tool_input: toolInput,
      });
      if (outcome.block) throw new Error(outcome.reason);
    },
    'tool.execute.after': async (
      input: { tool: string; sessionID?: string; args?: unknown },
      output: { args?: unknown; output?: unknown; content?: unknown },
    ) => {
      const toolName = claudeToolName(input.tool, servers);
      // OpenCode 1.18 passes the arguments of a finished tool in `input`, not `output`.
      const outcome = await runHookEvent(settings(), 'PostToolUse', toolName, {
        session_id: input.sessionID ?? '',
        tool_name: toolName,
        tool_input: claudeToolInput(toolName, input.args ?? output.args),
        tool_response: claudeToolResponse(toolName, output),
      });
      if (outcome.block && typeof output.output === 'string') output.output = `${output.output}\n\n${outcome.reason}`;
    },
    'chat.message': async (input: { sessionID?: string }, output: { parts?: unknown }) => {
      await runHookEvent(
        settings(),
        'UserPromptSubmit',
        '',
        { session_id: input.sessionID ?? '', prompt: promptText(output.parts) },
        { skip: ROUTER_HOOK },
      );
    },
  };
};

/**
 * Put the bridge where OpenCode loads plugins: the native global plugin
 * directory. A plugin found there is not a declared plugin, so server startup
 * does not wait for a package install (see the add-opencode ARCHITECTURE.md
 * "Offline startup" section). The file only re-exports `NanoclawHookBridge` from
 * this module, because OpenCode would call any other export as a plugin too.
 */
export function installOpenCodeHookBridge(
  configHome: string = process.env.XDG_CONFIG_HOME || path.join(process.env.HOME || os.homedir(), '.config'),
  bridgeModule: string = fileURLToPath(import.meta.url),
): string {
  const dir = path.join(configHome, 'opencode', 'plugin');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, PLUGIN_FILE);
  fs.writeFileSync(file, `export { NanoclawHookBridge } from ${JSON.stringify(bridgeModule)};\n`);
  return file;
}
