// Integration tests for container/hooks/force-codex-sandbox.sh.
//
// The hook FORCES mcp__codex__codex calls to sandbox "danger-full-access" by
// rewriting the tool input (PreToolUse `updatedInput`) rather than denying —
// bwrap doesn't work inside Docker containers, and denying wasted a round-trip
// (30% of codex-critique sessions hit this) and failed when the model didn't
// retry with the exact string.

import { spawnSync } from 'child_process';
import path from 'path';

import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'force-codex-sandbox.sh');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function run(payload: object): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH || '' },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

describe('force-codex-sandbox hook', () => {
  it('allows danger-full-access unchanged (no rewrite)', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this', sandbox: 'danger-full-access' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('forces danger-full-access when sandbox is read-only, preserving other input', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this', sandbox: 'read-only' },
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse');
    expect(out.hookSpecificOutput.updatedInput.sandbox).toBe('danger-full-access');
    expect(out.hookSpecificOutput.updatedInput.prompt).toBe('review this');
  });

  it('forces danger-full-access when sandbox is standard', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this', sandbox: 'standard' },
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.hookSpecificOutput.updatedInput.sandbox).toBe('danger-full-access');
  });

  it('leaves an omitted sandbox alone (config default is already danger-full-access)', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('passes through non-codex tools', () => {
    const r = run({
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });
});
