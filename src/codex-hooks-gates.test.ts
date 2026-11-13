import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { EVAL_SANDBOX_GATE_MATCHER } from './container-runner.js';

// Codex runs hooks only from its managed hook file (container/codex-hooks.toml,
// installed as /etc/codex/requirements.toml). The Bash gates Claude Code runs as
// PreToolUse hooks must be wired there too, or a Codex group can create a PR or
// post a long comment ungated. Codex sends the same payload (tool_name "Bash",
// tool_input.command), and a hook's exit 2 blocks the command (measured on lego,
// codex 0.160.0).

interface HookEntry {
  event: string;
  matcher: string | null;
  commands: string[];
}

/** The hook entries of the file: one per `[[hooks.<Event>]]` table. */
function hookEntries(toml: string): HookEntry[] {
  const entries: HookEntry[] = [];
  let current: HookEntry | null = null;
  for (const raw of toml.split('\n')) {
    const line = raw.trim();
    const table = /^\[\[hooks\.([A-Za-z]+)\]\]$/.exec(line);
    if (table) {
      current = { event: table[1], matcher: null, commands: [] };
      entries.push(current);
      continue;
    }
    if (!current || line.startsWith('#')) continue;
    const matcher = /^matcher\s*=\s*"(.*)"$/.exec(line);
    if (matcher) current.matcher = matcher[1];
    const command = /^command\s*=\s*"(.*)"$/.exec(line);
    if (command) current.commands.push(command[1]);
  }
  return entries;
}

const entries = hookEntries(fs.readFileSync(path.resolve('container', 'codex-hooks.toml'), 'utf-8'));

describe('Codex managed hooks', () => {
  it.each(['gate-critique-on-deliver.sh', 'gate-pr-description.sh', 'gate-plan.sh', 'plan-tracker.sh'])(
    'runs %s on Bash before the command, once',
    (script) => {
      const wired = entries.filter((e) => e.commands.some((c) => c === `bash /app/hooks/${script}`));
      expect(wired).toHaveLength(1);
      expect(wired[0]).toMatchObject({ event: 'PreToolUse', matcher: 'Bash' });
    },
  );

  it('runs the eval sandbox on Bash and its MCP tools, with the matcher Claude groups get', () => {
    const wired = entries.filter((e) => e.commands.includes('bash /app/hooks/gate-eval-sandbox.sh'));
    expect(wired).toHaveLength(1);
    expect(wired[0]).toMatchObject({ event: 'PreToolUse', matcher: EVAL_SANDBOX_GATE_MATCHER });
  });

  it('runs the issue-close backstop from the read-only runner mount on Bash, once', () => {
    const wired = entries.filter((e) => e.commands.includes('bun /app/src/issue-close-hook.ts'));
    expect(wired).toHaveLength(1);
    expect(wired[0]).toMatchObject({ event: 'PreToolUse', matcher: 'Bash' });
  });

  it('keeps the dashboard hook on every PreToolUse call', () => {
    const dashboard = entries.find((e) => e.commands.some((c) => c.includes('codex-dashboard-hook.sh PreToolUse')));
    expect(dashboard).toMatchObject({ event: 'PreToolUse', matcher: null });
  });
});
