// Integration tests for container/hooks/gate-plan.sh.
//
// gate-plan replaces plan-gate.sh's plan-required check (without the
// critique branch — that lives in gate-critique-on-deliver.sh now). Subagents
// pass through unconditionally (their parent's plan covers them; their
// deliveries are still gated by gate-critique-on-deliver.sh).

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-plan.sh');

interface RunResult {
  status: number;
  stderr: string;
}

let tmpRoot: string;
let stateFile: string;

function run(payload: object, env: Record<string, string> = {}): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      WORKFLOW_STATE_FILE: stateFile,
      ...env,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: proc.stderr ?? '' };
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-plan-test-'));
  stateFile = path.join(tmpRoot, 'workflow-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Subagent fork passes through', () => {
  it('subagent + no plan + Edit → exit 0', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run(
      { tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } },
      { CLAUDE_CODE_FORK_SUBAGENT: '1', OVERLAY_HAS_PLAN: '1' },
    );
    expect(r.status).toBe(0);
  });
});

describe('Plan-required gate', () => {
  it('blocks Edit when plan_written is false', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('PLAN REQUIRED');
  });

  it('passes Edit when plan_written is true', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: true }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
    expect(r.status).toBe(0);
  });

  it('OVERLAY_HAS_PLAN=0 disables enforcement (one-off bring-up)', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } }, { OVERLAY_HAS_PLAN: '0' });
    expect(r.status).toBe(0);
  });

  it('plan-stale flag fires denial', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: true, plan_stale: true, edits_since_plan: 17 }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('PLAN STALE');
  });
});

describe('Allowlist exemptions (workspace bookkeeping files)', () => {
  for (const f of [
    '/workspace/agent/plans/foo.md',
    '/workspace/agent/reports/bar.md',
    '/workspace/agent/memory/baz.md',
    '/workspace/agent/CLAUDE.local.md',
    '/workspace/.claude/settings.json',
  ]) {
    it(`exempt: ${f}`, () => {
      fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
      const r = run({ tool_name: 'Write', tool_input: { file_path: f } });
      expect(r.status).toBe(0);
    });
  }
});

describe('Bash heuristic — only file-writing commands counted', () => {
  it('plain ls passes', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Bash', tool_input: { command: 'ls -la' } });
    expect(r.status).toBe(0);
  });

  it('echo > redirect blocked when no plan', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Bash', tool_input: { command: 'echo hi > /workspace/src/foo.txt' } });
    expect(r.status).toBe(2);
  });

  it('git apply blocked when no plan', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Bash', tool_input: { command: 'git apply patch.diff' } });
    expect(r.status).toBe(2);
  });
});

describe('Per-session isolation', () => {
  // Two concurrent "sessions" simulated by two distinct state files.
  // /workspace/.claude/workflow-state.json is per-session via the per-session
  // /workspace mount in container-runner.ts. Each session sees its own
  // counters; flipping one session's plan_written does not leak.
  it('two state files independently gate', () => {
    const stateA = path.join(tmpRoot, 'sessA-workflow-state.json');
    const stateB = path.join(tmpRoot, 'sessB-workflow-state.json');
    fs.writeFileSync(stateA, JSON.stringify({ plan_written: true }));
    fs.writeFileSync(stateB, JSON.stringify({ plan_written: false }));

    const a = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } }),
      env: { PATH: process.env.PATH || '', WORKFLOW_STATE_FILE: stateA },
      encoding: 'utf-8',
    });
    const b = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } }),
      env: { PATH: process.env.PATH || '', WORKFLOW_STATE_FILE: stateB },
      encoding: 'utf-8',
    });
    expect(a.status).toBe(0); // session A had a plan → passes
    expect(b.status).toBe(2); // session B did not → blocked, independent of A
  });
});
