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

  const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
  const notification =
    '<context timezone="UTC" />\n<system-notification id="7" time="Nov 17, 2026, 3:51 PM">CRITIQUE GATE BLOCKED your PR creation (attempt 2 of 3).</system-notification>';
  const writeState = (s: object): void => fs.writeFileSync(state, JSON.stringify(s));
  const rounds = (): number => JSON.parse(fs.readFileSync(state, 'utf-8')).critique_rounds;

  it('measures idle time from the latest critique round, not from the task start', () => {
    writeState({ critique_rounds: 2, started_at: minutesAgo(60), last_critique_at: minutesAgo(1) });
    run({ prompt: 'keep going' });
    expect(rounds()).toBe(2);
  });

  it('measures idle time from the latest edit, not from the task start', () => {
    writeState({ critique_rounds: 2, started_at: minutesAgo(60), last_edit_at: minutesAgo(2) });
    run({ prompt: 'keep going' });
    expect(rounds()).toBe(2);
  });

  it('starts a new task after 10 minutes with no edit or critique round', () => {
    writeState({ critique_rounds: 2, started_at: minutesAgo(60), last_edit_at: minutesAgo(30) });
    run({ prompt: 'keep going' });
    expect(rounds()).toBe(0);
  });

  it('never resets on a prompt that carries only host notifications', () => {
    writeState({ critique_rounds: 2, started_at: minutesAgo(60) });
    run({ prompt: notification });
    expect(rounds()).toBe(2);
  });

  it('resets on a scheduled task after 10 idle minutes, even beside a notification', () => {
    writeState({ critique_rounds: 2, started_at: minutesAgo(60) });
    run({ prompt: `${notification}\n<task time="Nov 17, 2026, 3:52 PM">check open PRs</task>` });
    expect(rounds()).toBe(0);
  });

  it('resets on a routed message that arrives beside a notification', () => {
    writeState({ critique_rounds: 2, started_at: minutesAgo(1) });
    run({ prompt: `${notification}\n<message id="9" from="parent">round 2</message>` });
    expect(rounds()).toBe(0);
  });

  it('keeps the state for a follow-up within the task', () => {
    run({ prompt: '<system>re-send your answer wrapped</system>' });
    expect(JSON.parse(fs.readFileSync(state, 'utf-8')).critique_rounds).toBe(2);
  });
});
