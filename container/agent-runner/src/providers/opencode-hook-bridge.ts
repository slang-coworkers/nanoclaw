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
 * Stop hooks need the runner, which owns the turn; they are not handled here.
 * The intent router stays in the runner's bridge (`classifyAndPrepend`), which
 * already routes every non-Claude prompt, so its UserPromptSubmit entry is
 * skipped here to avoid classifying a message twice.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { detectIssueClose } from '../issue-close.js';

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit';

export interface HookCommand {
  type?: string;
  command: string;
  timeout?: number;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookCommand[];
}

export type HookSettings = Partial<Record<HookEvent, HookMatcher[]>>;

export interface HookOutcome {
  block: boolean;
  reason: string;
}

const AGENT_DIR = '/workspace/agent';
const DEFAULT_TIMEOUT_S = 60;
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

/** True when a Claude Code hook matcher selects `toolName` ("" and "*" select every tool). */
export function matcherSelects(matcher: string | undefined, toolName: string): boolean {
  if (!matcher || matcher === '*') return true;
  try {
    return new RegExp(`^(?:${matcher})$`).test(toolName);
  } catch {
    return matcher === toolName;
  }
}

/**
 * Read a hook result the way Claude Code does: exit 2 blocks with stderr as the
 * reason; exit 0 blocks only when stdout is a JSON decision to block or deny;
 * any other exit status is a non-blocking hook error.
 */
export function hookOutcome(code: number | null, stdout: string, stderr: string): HookOutcome {
  if (code === 2) return { block: true, reason: stderr.trim() || 'Blocked by a hook.' };
  if (code !== 0) return { block: false, reason: '' };
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return { block: false, reason: '' };
  }
  const specific = (parsed.hookSpecificOutput ?? {}) as Record<string, unknown>;
  if (parsed.decision === 'block' || specific.permissionDecision === 'deny' || parsed.continue === false) {
    const reason = parsed.reason ?? specific.permissionDecisionReason ?? parsed.stopReason;
    return { block: true, reason: typeof reason === 'string' && reason ? reason : 'Blocked by a hook.' };
  }
  return { block: false, reason: '' };
}

/** Run one hook command with `payload` on stdin; resolves even on failure or timeout. */
export function runHookCommand(
  hook: HookCommand,
  payload: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HookOutcome> {
  return new Promise((resolve) => {
    // The hooks run from the agent directory, as under Claude Code; outside a
    // container (tests) that directory does not exist.
    const cwd = fs.existsSync(AGENT_DIR) ? AGENT_DIR : undefined;
    const child = spawn('/bin/sh', ['-c', hook.command], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), (hook.timeout ?? DEFAULT_TIMEOUT_S) * 1000);
    child.stdout.on('data', (b: Buffer) => (stdout += b.toString()));
    child.stderr.on('data', (b: Buffer) => (stderr += b.toString()));
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ block: false, reason: '' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(hookOutcome(code, stdout, stderr));
    });
    child.stdin.on('error', () => {
      /* the hook may exit before reading its input */
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

/** Read the group's hook settings; a missing or unreadable file means no hooks. */
export function readHookSettings(settingsPath: string): HookSettings {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as { hooks?: HookSettings };
    return parsed.hooks ?? {};
  } catch {
    return {};
  }
}

/**
 * Run every hook registered for `event` that selects `toolName`, in order, and
 * stop at the first block. `skip` drops commands that another path already runs.
 */
export async function runHookEvent(
  settings: HookSettings,
  event: HookEvent,
  toolName: string,
  payload: Record<string, unknown>,
  skip?: RegExp,
): Promise<HookOutcome> {
  for (const entry of settings[event] ?? []) {
    if (event !== 'UserPromptSubmit' && !matcherSelects(entry.matcher, toolName)) continue;
    for (const hook of entry.hooks ?? []) {
      if (hook.type && hook.type !== 'command') continue;
      if (skip?.test(hook.command)) continue;
      const outcome = await runHookCommand(hook, { hook_event_name: event, cwd: AGENT_DIR, ...payload });
      if (outcome.block) return outcome;
    }
  }
  return { block: false, reason: '' };
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

/** The text of a tool result: bash output, or the text blocks of an MCP result. */
export function toolResultText(output: unknown): string {
  const o = (output ?? {}) as Record<string, unknown>;
  if (typeof o.output === 'string') return o.output;
  const content = o.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .join('\n');
  }
  return '';
}

/**
 * The hook `tool_response` for a finished tool. Claude Code hands Bash hooks
 * `{stdout, stderr}` and MCP hooks the tool result, which `track-critique.sh`
 * parses as a JSON string with a `content` field.
 */
export function claudeToolResponse(claudeName: string, output: unknown): unknown {
  const text = toolResultText(output);
  return claudeName === 'Bash' ? { stdout: text, stderr: '' } : JSON.stringify({ content: text });
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

/**
 * The OpenCode plugin. OpenCode calls every export of a plugin module, so the
 * file OpenCode loads re-exports only this function (see installOpenCodeHookBridge).
 */
export const NanoclawHookBridge = async () => {
  const settingsPath =
    process.env.NANOCLAW_HOOK_SETTINGS ?? path.join(process.env.HOME || os.homedir(), '.claude', 'settings.json');
  const servers = mcpServerNames(process.env.OPENCODE_CONFIG_CONTENT);
  const settings = () => readHookSettings(settingsPath);
  return {
    'tool.execute.before': async (input: { tool: string; sessionID?: string }, output: { args?: unknown }) => {
      const toolName = claudeToolName(input.tool, servers);
      const toolInput = claudeToolInput(toolName, output.args);
      if (toolName === 'Bash' && process.env.NANOCLAW_ALLOW_ISSUE_CLOSE !== '1') {
        const match = detectIssueClose(toolInput.command as string | undefined);
        if (match) {
          throw new Error(
            `Closing a GitHub issue (${match}) is a maintainer-only action — coworkers triage and comment, they do not close. ` +
              `Post your duplicate/wontfix verdict as an issue comment and leave the close to a human maintainer.`,
          );
        }
      }
      const outcome = await runHookEvent(settings(), 'PreToolUse', toolName, {
        session_id: input.sessionID ?? '',
        tool_name: toolName,
        tool_input: toolInput,
      });
      if (outcome.block) throw new Error(outcome.reason);
    },
    'tool.execute.after': async (
      input: { tool: string; sessionID?: string },
      output: { args?: unknown; output?: unknown; content?: unknown },
    ) => {
      const toolName = claudeToolName(input.tool, servers);
      const outcome = await runHookEvent(settings(), 'PostToolUse', toolName, {
        session_id: input.sessionID ?? '',
        tool_name: toolName,
        tool_input: claudeToolInput(toolName, output.args),
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
        ROUTER_HOOK,
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
