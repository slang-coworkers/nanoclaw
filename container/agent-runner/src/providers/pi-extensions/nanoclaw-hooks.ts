/**
 * Claude Code hooks for Pi groups (fork-owned).
 *
 * The host writes every group's gate hooks into `~/.claude/settings.json` in
 * Claude Code's format: the critique gate's Bash half (PR creation, long
 * comments), the PR description limits, the eval sandbox, the plan gate and
 * the git-remote and CLAUDE.md guards. Pi never reads that file, so before
 * this extension a Pi group ran with every Bash gate off. The extension turns
 * Pi's tool events into the same hook calls and runs the same scripts through
 * settings-hooks.ts, the module the OpenCode bridge uses:
 *
 *   Pi event       Claude Code hook event
 *   tool_call  ->  PreToolUse   (exit 2 or a deny decision blocks the tool)
 *   tool_result -> PostToolUse  (side effects: PR receipts, edit counts)
 *
 * Stop hooks run in the runner (stop-hooks.ts), and the intent router runs in
 * the runner's bridge, so neither runs here. The issue-close backstop is an
 * in-process check, as under Claude and OpenCode.
 *
 * Consider a Pi fixer in a critique-gated group that runs `gh pr create`
 * before any critique. Pi reports tool `bash` with `{command}`; the extension
 * calls the PreToolUse hooks with `tool_name: "Bash"`, gate-critique-on-deliver.sh
 * exits 2, and the extension returns `{block: true, reason}`, which Pi reports
 * to the model as a blocked tool call.
 *
 * The tool-name map and the absolute-path handling follow the MIT-licensed
 * @ryan_nookpi/pi-extension-claude-hooks-bridge (Jonghak Seo). That package
 * reads only `<cwd>/.claude/settings.json` and also runs Stop and
 * UserPromptSubmit, which the runner already owns here, so it is not used as is.
 *
 * Loaded via settings.json `extensions` (pi.ts); jiti transpiles the TS and
 * resolves the `.js` imports to the runner's `.ts` modules. The ExtensionAPI
 * types are declared locally, as in nanoclaw-context.ts, because pi is an
 * image CLI and not an agent-runner dependency.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { issueCloseRefusal } from '../../issue-close.js';
import { claudeToolResponse, hookSettingsPath, readHookSettings, runHookEvent } from '../../settings-hooks.js';

interface ToolCallEvent {
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

interface ToolResultEvent extends ToolCallEvent {
  content: unknown;
  isError: boolean;
}

interface ExtensionContext {
  cwd: string;
  sessionManager?: { getSessionId(): string };
}

interface ExtensionAPI {
  on(
    event: 'tool_call',
    handler: (event: ToolCallEvent, ctx: ExtensionContext) => Promise<{ block: true; reason: string } | undefined>,
  ): void;
  on(event: 'tool_result', handler: (event: ToolResultEvent, ctx: ExtensionContext) => Promise<void>): void;
}

// Pi's built-in tools and the Claude Code tool each one stands in for.
const BUILTIN_TOOLS: Record<string, string> = {
  bash: 'Bash',
  read: 'Read',
  edit: 'Edit',
  write: 'Write',
  grep: 'Grep',
  find: 'Glob',
  ls: 'LS',
};

// Pi tools with no Claude Code counterpart, under the names the hook matchers
// use. pi-mcp-adapter's mcpScript runs JavaScript that can call any MCP tool,
// so the eval sandbox refuses it as a whole (gate-eval-sandbox.sh).
const PI_ONLY_TOOLS: Record<string, string> = {
  mcpScript: 'McpScript',
};

/** Return the Claude Code name of a Pi tool; any other tool keeps its name. */
export function claudeToolName(tool: string): string {
  return BUILTIN_TOOLS[tool] ?? PI_ONLY_TOOLS[tool] ?? tool;
}

/**
 * Return the hook `tool_input` for a Pi tool call. Pi names a file `path`
 * (often relative) and an edit `edits: [{oldText, newText}]`; the hook scripts
 * read Claude Code's `file_path` (absolute) and `old_string`/`new_string`. A
 * single edit also gets the top-level pair, as Claude's Edit has.
 */
export function claudeToolInput(tool: string, input: unknown, cwd: string): Record<string, unknown> {
  const out: Record<string, unknown> =
    input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {};
  if (typeof out.path === 'string' && BUILTIN_TOOLS[tool]) {
    out.file_path = path.isAbsolute(out.path) ? path.normalize(out.path) : path.resolve(cwd, out.path);
  }
  if (tool === 'edit' && Array.isArray(out.edits)) {
    const edits = (out.edits as Array<{ oldText?: unknown; newText?: unknown }>).map((e) => ({
      old_string: e?.oldText,
      new_string: e?.newText,
    }));
    out.edits = edits;
    if (edits.length === 1) Object.assign(out, edits[0]);
  }
  return out;
}

/** The MCP server names of this Pi group, from the mcp.json the runner writes (pi.ts). */
export function piMcpServers(env: NodeJS.ProcessEnv = process.env): string[] {
  const dir = env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'mcp.json'), 'utf-8')) as { mcpServers?: object };
    return Object.keys(config.mcpServers ?? {});
  } catch {
    return [];
  }
}

/**
 * Return the Claude Code name and input of a Pi MCP call, or null for any other
 * tool. pi-mcp-adapter names an MCP tool `<server>_<tool>` and, unless direct
 * tools are switched on, calls it through its one `mcp` proxy tool: `tool`
 * carries that name, `server` may name the server, and `args` holds the
 * arguments as an object or a JSON string. Consider an eval-sandbox Pi group
 * that calls `mcp {tool: "slang-mcp_discord_send_message", args: {…}}`: the
 * hooks see `mcp__slang-mcp__discord_send_message` with those arguments, so
 * the sandbox's MCP matcher selects the call as it does under Claude.
 */
export function claudeMcpCall(
  tool: string,
  input: Record<string, unknown>,
  servers: readonly string[],
): { name: string; input: Record<string, unknown> } | null {
  let full = tool;
  let args: unknown = input;
  let named: string | undefined;
  if (tool === 'mcp') {
    // The proxy's status, search, describe and connect forms call no tool.
    if (typeof input.tool !== 'string' || !input.tool) return null;
    full = input.tool;
    args = input.args;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        args = { raw: args };
      }
    }
    if (typeof input.server === 'string' && input.server) named = input.server;
  }
  const asInput = (value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  if (named) {
    const own = full.startsWith(`${named}_`) ? full.slice(named.length + 1) : full;
    return { name: `mcp__${named}__${own}`, input: asInput(args) };
  }
  // The longest server name first, so `slang-mcp-x_tool` is not read as `slang-mcp`.
  for (const server of [...servers].sort((a, b) => b.length - a.length)) {
    if (full.startsWith(`${server}_`)) {
      return { name: `mcp__${server}__${full.slice(server.length + 1)}`, input: asInput(args) };
    }
  }
  return null;
}

function sessionId(ctx: ExtensionContext): string {
  try {
    return ctx.sessionManager?.getSessionId() ?? '';
  } catch {
    return '';
  }
}

export default function nanoclawHooks(pi: ExtensionAPI): void {
  const settings = () => readHookSettings(hookSettingsPath());
  const servers = piMcpServers();
  /** The Claude Code name and input of a Pi tool call: an MCP call, else a built-in tool. */
  const claudeCall = (event: ToolCallEvent, cwd: string) =>
    claudeMcpCall(event.toolName, event.input, servers) ?? {
      name: claudeToolName(event.toolName),
      input: claudeToolInput(event.toolName, event.input, cwd),
    };

  pi.on('tool_call', async (event, ctx) => {
    const { name: toolName, input: toolInput } = claudeCall(event, ctx.cwd);
    if (toolName === 'Bash') {
      const refusal = issueCloseRefusal(toolInput.command as string | undefined);
      if (refusal) return { block: true, reason: refusal };
    }
    const outcome = await runHookEvent(settings(), 'PreToolUse', toolName, {
      session_id: sessionId(ctx),
      tool_name: toolName,
      tool_input: toolInput,
      tool_use_id: event.toolCallId,
    });
    return outcome.block ? { block: true, reason: outcome.reason } : undefined;
  });

  pi.on('tool_result', async (event, ctx) => {
    const { name: toolName, input: toolInput } = claudeCall(event, ctx.cwd);
    await runHookEvent(settings(), 'PostToolUse', toolName, {
      session_id: sessionId(ctx),
      tool_name: toolName,
      tool_input: toolInput,
      tool_response: claudeToolResponse(toolName, { content: event.content }),
      tool_use_id: event.toolCallId,
    });
  });
}
