import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// workflow-state-reset.sh starts a new task's state on a routed message, so one
// task's plan and critique rounds never satisfy the gates of the next.

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'workflow-state-reset.sh');
let tmp: string;
let state: string;

function run(payload: object, env: Record<string, string> = {}): number {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH || '', WORKFLOW_STATE_FILE: state, ...env },
    encoding: 'utf-8',
  });
  return proc.status ?? -1;
}
const routed = '<context timezone="UTC" /><messages><message id="1" sender="a">fix #1</message></messages>';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-reset-'));
  state = path.join(tmp, 'workflow-state.json');
  fs.writeFileSync(
    state,
    JSON.stringify({ plan_written: true, critique_rounds: 2, last_activity_at: new Date().toISOString() }),
  );
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('workflow-state-reset.sh', () => {
  it('resets on a routed message even where the install sets CLAUDE_CODE_FORK_SUBAGENT=1', () => {
    expect(run({ prompt: routed }, { CLAUDE_CODE_FORK_SUBAGENT: '1' })).toBe(0);
    expect(JSON.parse(fs.readFileSync(state, 'utf-8'))).toMatchObject({ plan_written: false, critique_rounds: 0 });
  });

  it("does not reset from inside a subagent (agent_id), which works within the parent's task", () => {
    run({ agent_id: 'sub-1', prompt: routed });
    expect(JSON.parse(fs.readFileSync(state, 'utf-8'))).toMatchObject({ plan_written: true, critique_rounds: 2 });
  });

  it('keeps the state for a follow-up within the task', () => {
    run({ prompt: '<system>re-send your answer wrapped</system>' });
    expect(JSON.parse(fs.readFileSync(state, 'utf-8')).critique_rounds).toBe(2);
  });
});
