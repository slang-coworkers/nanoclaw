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

/** Return the Claude Code name of a Pi tool; any other tool keeps its name. */
export function claudeToolName(tool: string): string {
  return BUILTIN_TOOLS[tool] ?? tool;
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

function sessionId(ctx: ExtensionContext): string {
  try {
    return ctx.sessionManager?.getSessionId() ?? '';
  } catch {
    return '';
  }
}

export default function nanoclawHooks(pi: ExtensionAPI): void {
  const settings = () => readHookSettings(hookSettingsPath());

  pi.on('tool_call', async (event, ctx) => {
    const toolName = claudeToolName(event.toolName);
    const toolInput = claudeToolInput(event.toolName, event.input, ctx.cwd);
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
    const toolName = claudeToolName(event.toolName);
    await runHookEvent(settings(), 'PostToolUse', toolName, {
      session_id: sessionId(ctx),
      tool_name: toolName,
      tool_input: claudeToolInput(event.toolName, event.input, ctx.cwd),
      tool_response: claudeToolResponse(toolName, { content: event.content }),
      tool_use_id: event.toolCallId,
    });
  });
}
