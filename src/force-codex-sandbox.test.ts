// Integration tests for container/hooks/force-codex-sandbox.sh.
//
// The hook rejects mcp__codex__codex calls with sandbox != "danger-full-access".
// bwrap doesn't work inside Docker containers, so read-only sandbox wastes a
// round-trip (30% of codex-critique sessions hit this).

import { spawnSync } from 'child_process';
import path from 'path';

import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'force-codex-sandbox.sh');

interface RunResult {
  status: number;
  stderr: string;
}

function run(payload: object): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH || '' },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: proc.stderr ?? '' };
}

describe('force-codex-sandbox hook', () => {
  it('allows mcp__codex__codex with danger-full-access', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this', sandbox: 'danger-full-access' },
    });
    expect(r.status).toBe(0);
  });

  it('blocks mcp__codex__codex with read-only', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this', sandbox: 'read-only' },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('BLOCKED');
    expect(r.stderr).toContain('danger-full-access');
  });

  it('blocks mcp__codex__codex with standard sandbox', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this', sandbox: 'standard' },
    });
    expect(r.status).toBe(2);
  });

  it('allows mcp__codex__codex when sandbox is omitted (defaults to danger-full-access)', () => {
    const r = run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'review this' },
    });
    expect(r.status).toBe(0);
  });

  it('passes through non-codex tools', () => {
    const r = run({
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });
    expect(r.status).toBe(0);
  });
});
