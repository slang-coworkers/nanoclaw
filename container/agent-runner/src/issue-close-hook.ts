/**
 * The issue-close backstop as a PreToolUse hook command (fork-owned).
 *
 * Claude, OpenCode and Pi run issueCloseRefusal() in process. Codex runs hooks
 * only as commands from its managed hook file (container/codex-hooks.toml), so
 * this file wraps the same check: it reads the Claude Code hook payload on
 * stdin and, for a Bash command that would close a GitHub issue, writes the
 * refusal to stderr and exits 2, which blocks the command. The rule stays in
 * one place (issue-close.ts).
 *
 *   bun /app/src/issue-close-hook.ts   (/app/src is the read-only runner mount)
 */
import { issueCloseRefusal } from './issue-close.js';

/** The hook's answer for one payload: exit 2 with the refusal, or exit 0. */
export function issueCloseHookResult(
  payload: unknown,
  env: NodeJS.ProcessEnv = process.env,
): { code: 0 | 2; stderr: string } {
  const p = (payload && typeof payload === 'object' ? payload : {}) as {
    tool_name?: unknown;
    tool_input?: { command?: unknown };
  };
  if (p.tool_name !== 'Bash') return { code: 0, stderr: '' };
  const command = typeof p.tool_input?.command === 'string' ? p.tool_input.command : undefined;
  const refusal = issueCloseRefusal(command, env);
  return refusal ? { code: 2, stderr: refusal } : { code: 0, stderr: '' };
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  let payload: unknown = {};
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    process.exit(0);
  }
  const result = issueCloseHookResult(payload);
  if (result.stderr) process.stderr.write(`${result.stderr}\n`);
  process.exit(result.code);
}

if (import.meta.main) void main();
