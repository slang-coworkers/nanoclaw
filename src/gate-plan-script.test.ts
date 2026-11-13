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
let overlayDir: string;
let markerFile: string;

function run(payload: object, env: Record<string, string> = {}): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      WORKFLOW_STATE_FILE: stateFile,
      OVERLAY_MARKER_DIR: overlayDir,
      ...env,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: proc.stderr ?? '' };
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-plan-test-'));
  stateFile = path.join(tmpRoot, 'workflow-state.json');
  overlayDir = tmpRoot;
  markerFile = path.join(overlayDir, '.overlay-plan-gate');
  // Default: marker present (most tests assume the gate is opted in via the
  // plan-gate overlay). The "Marker absent → no-op" describe block deletes
  // it before running.
  fs.writeFileSync(markerFile, 'plan-gate\n');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('the Claude SDK fork switch does not open the gate', () => {
  // CLAUDE_CODE_FORK_SUBAGENT is forwarded to every container of an install
  // that sets it; it never marked a subagent call. A subagent shares the
  // parent's state file, so the parent's plan covers it through the same check.
  it('CLAUDE_CODE_FORK_SUBAGENT=1 + no plan + Edit → still refused', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run(
      { tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } },
      { CLAUDE_CODE_FORK_SUBAGENT: '1', OVERLAY_HAS_PLAN: '1' },
    );
    expect(r.status).toBe(2);
  });

  it("a subagent call (agent_id) passes on the parent's plan", () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: true }));
    const r = run({ agent_id: 'sub-1', tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
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

  it('a written plan stays valid however many edits follow it', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: true, edits_since_plan: 40 }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
    expect(r.status).toBe(0);
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
      env: { PATH: process.env.PATH || '', WORKFLOW_STATE_FILE: stateA, OVERLAY_MARKER_DIR: overlayDir },
      encoding: 'utf-8',
    });
    const b = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } }),
      env: { PATH: process.env.PATH || '', WORKFLOW_STATE_FILE: stateB, OVERLAY_MARKER_DIR: overlayDir },
      encoding: 'utf-8',
    });
    expect(a.status).toBe(0); // session A had a plan → passes
    expect(b.status).toBe(2); // session B did not → blocked, independent of A
  });
});

// Marker-absent path: when the `plan-gate` overlay is NOT in the coworker's
// resolved overlay set, the composer doesn't materialize the marker and the
// hook short-circuits (exit 0) on the first line. Mirrors the symmetric
// opt-in pattern in gate-critique-on-deliver.sh.
describe('Marker absent → no-op (opt-in via plan-gate overlay)', () => {
  beforeEach(() => {
    // Remove the marker that the outer beforeEach planted.
    fs.unlinkSync(markerFile);
  });

  it('no marker + Edit + plan_written=false → exit 0 (would normally deny)', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
    expect(r.status).toBe(0);
    expect(r.stderr).not.toContain('PLAN REQUIRED');
  });

  it('no marker + Bash write + plan_written=false → exit 0', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Bash', tool_input: { command: 'echo hi > /workspace/src/foo.txt' } });
    expect(r.status).toBe(0);
  });

  it('no marker + plan_written=false + Edit → exit 0 (would normally deny)', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run({ tool_name: 'Edit', tool_input: { file_path: '/workspace/src/foo.ts' } });
    expect(r.status).toBe(0);
  });
});

describe('Codex apply_patch (reported as a Bash call carrying the patch)', () => {
  const patch = (...lines: string[]) =>
    ["apply_patch <<'EOF'", '*** Begin Patch', ...lines, '*** End Patch', 'EOF'].join('\n');
  const codex = (command: string) => ({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    cwd: '/workspace/agent',
    turn_id: 't1',
    tool_input: { command },
  });

  it('a patch to source code with no plan is refused', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const r = run(codex(patch('*** Update File: src/foo.ts', '@@', '-a', '+b')));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('PLAN REQUIRED');
  });

  it('a patch that only writes the plan passes', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    expect(run(codex(patch('*** Add File: reports/fix-plan.md', '+PLAN'))).status).toBe(0);
  });

  it('a notes patch followed by another command is refused until a plan exists', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const compound = `${patch('*** Add File: reports/notes.md', '+notes')}\npython3 -c "open('src/x.py','w').write('x')"`;
    const r = run(codex(compound));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('PLAN REQUIRED');
  });

  it('the quoted-argument form of a notes patch passes', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const quoted = ["apply_patch '*** Begin Patch", '*** Add File: reports/notes.md', '+notes', "*** End Patch'"].join(
      '\n',
    );
    expect(run(codex(quoted)).status).toBe(0);
  });

  it('a patch that writes the plan and code together is refused until a plan exists', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    const both = patch('*** Add File: reports/fix-plan.md', '+PLAN', '*** Update File: src/foo.ts', '@@', '-a', '+b');
    expect(run(codex(both)).status).toBe(2);
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: true }));
    expect(run(codex(both)).status).toBe(0);
  });

  it('judges a file by its absolute path, including a move target', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: false }));
    expect(run(codex(patch('*** Update File: /tmp/elsewhere/notes.txt', '@@', '-a', '+b'))).status).toBe(2);
    expect(run(codex(patch('*** Update File: reports/a.md', '*** Move to: src/a.ts', '@@', '-a', '+b'))).status).toBe(
      2,
    );
  });

  it('a recorded plan whose file does not exist yet does not open the gate (parallel patches)', () => {
    const planFile = path.join(tmpRoot, 'reports-plan.md');
    fs.writeFileSync(stateFile, JSON.stringify({ plan_written: true, plan_path: planFile }));
    const code = codex(patch('*** Update File: src/foo.ts', '@@', '-a', '+b'));
    expect(run(code).status).toBe(2);
    fs.writeFileSync(planFile, 'PLAN\n');
    expect(run(code).status).toBe(0);
  });

  it('is off without the plan-gate overlay', () => {
    fs.rmSync(markerFile);
    expect(run(codex(patch('*** Update File: src/foo.ts', '@@', '-a', '+b'))).status).toBe(0);
  });
});
