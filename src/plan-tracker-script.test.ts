import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// plan-tracker.sh records that a plan was written, which opens gate-plan.sh.
// Claude reports the write as a Write PostToolUse; Codex reports an apply_patch
// as a Bash PreToolUse and sends no PostToolUse for it.

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'plan-tracker.sh');
let tmp: string;
let state: string;

function run(payload: object): number {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH || '', WORKFLOW_STATE_FILE: state },
    encoding: 'utf-8',
  });
  return proc.status ?? -1;
}
const read = () => (fs.existsSync(state) ? JSON.parse(fs.readFileSync(state, 'utf-8')) : {});
const patch = (...lines: string[]) =>
  ["apply_patch <<'EOF'", '*** Begin Patch', ...lines, '*** End Patch', 'EOF'].join('\n');
const codex = (command: string) => ({ tool_name: 'Bash', cwd: '/workspace/agent', tool_input: { command } });

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-tracker-'));
  state = path.join(tmp, 'workflow-state.json');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('plan-tracker.sh', () => {
  it('records a Claude Write to reports/', () => {
    expect(run({ tool_name: 'Write', tool_input: { file_path: '/workspace/agent/reports/plan.md' } })).toBe(0);
    expect(read()).toMatchObject({ plan_written: true, plan_path: '/workspace/agent/reports/plan.md' });
  });

  it('records a Codex patch that only adds the plan, with the absolute path', () => {
    run(codex(patch('*** Add File: reports/fix-plan.md', '+PLAN')));
    expect(read()).toMatchObject({ plan_written: true, plan_path: '/workspace/agent/reports/fix-plan.md' });
  });

  it('does not record a Codex patch that also edits code, which the gate may refuse', () => {
    run(codex(patch('*** Add File: reports/fix-plan.md', '+PLAN', '*** Update File: src/foo.ts', '@@', '-a', '+b')));
    expect(read().plan_written).toBeUndefined();
  });

  it('ignores other Bash commands and other files', () => {
    run(codex('cat > reports/plan.md <<EOF\nPLAN\nEOF'));
    run({ tool_name: 'Write', tool_input: { file_path: '/workspace/agent/src/foo.ts' } });
    expect(read().plan_written).toBeUndefined();
  });
});
