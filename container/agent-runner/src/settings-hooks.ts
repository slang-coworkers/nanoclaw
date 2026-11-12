/**
 * Claude Code settings.json hooks, run outside Claude Code (fork-owned).
 *
 * The host writes every group's hooks (gates, telemetry, PR checks) into
 * `~/.claude/settings.json` in Claude Code's format. The Claude Agent SDK runs
 * them itself. For the other providers, two callers run the same hook scripts
 * through this module, so the scripts stay the single source of truth:
 *
 *   providers/opencode-hook-bridge.ts  tool and prompt events of an OpenCode group
 *   stop-hooks.ts                      the Stop event of every non-Claude turn
 *
 * The functions follow Claude Code's rules: how a matcher selects a tool, how
 * an exit status or a JSON decision blocks, and which events use matchers.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'UserPromptSubmit' | 'Stop' | 'StopFailure';

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

export const AGENT_DIR = '/workspace/agent';
const DEFAULT_TIMEOUT_S = 60;

// Claude Code applies matchers to tool events only; the other events run every entry.
const TOOL_EVENTS: ReadonlySet<HookEvent> = new Set(['PreToolUse', 'PostToolUse']);

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

/** The group's hook settings file: `NANOCLAW_HOOK_SETTINGS`, else `~/.claude/settings.json`. */
export function hookSettingsPath(env: NodeJS.ProcessEnv = process.env): string {
  return env.NANOCLAW_HOOK_SETTINGS ?? path.join(env.HOME || os.homedir(), '.claude', 'settings.json');
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

export interface RunHookEventOptions {
  /** Drops commands that another path already runs. */
  skip?: RegExp;
  /**
   * Runs every selected hook at once and blocks when any of them blocks, as
   * Claude Code does. Without it the hooks run in order and the first block
   * stops the rest, which a tool gate wants: a denied call needs no later check.
   */
  all?: boolean;
}

/** Run the hooks registered for `event` that select `toolName`, with `payload` on stdin. */
export async function runHookEvent(
  settings: HookSettings,
  event: HookEvent,
  toolName: string,
  payload: Record<string, unknown>,
  options: RunHookEventOptions = {},
): Promise<HookOutcome> {
  const selected: HookCommand[] = [];
  for (const entry of settings[event] ?? []) {
    if (TOOL_EVENTS.has(event) && !matcherSelects(entry.matcher, toolName)) continue;
    for (const hook of entry.hooks ?? []) {
      if (hook.type && hook.type !== 'command') continue;
      if (options.skip?.test(hook.command)) continue;
      selected.push(hook);
    }
  }
  const input = { hook_event_name: event, cwd: AGENT_DIR, ...payload };
  if (options.all) {
    const blocks = (await Promise.all(selected.map((hook) => runHookCommand(hook, input)))).filter((o) => o.block);
    return blocks.length > 0
      ? { block: true, reason: blocks.map((o) => o.reason).join('\n\n') }
      : { block: false, reason: '' };
  }
  for (const hook of selected) {
    const outcome = await runHookCommand(hook, input);
    if (outcome.block) return outcome;
  }
  return { block: false, reason: '' };
}
