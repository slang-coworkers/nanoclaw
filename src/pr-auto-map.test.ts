// Integration tests for container/hooks/pr-auto-map.sh — the push half.
//
// A push to a branch that backs a PR moves the PR's head, so the PR description
// (the /explain-diff-html explanation) describes a stale head until it is
// rewritten. The hook reads repo, branch and new head from git's own push report
// and reminds the agent. The PR-created half uses GNU `grep -P` (the container's
// grep) and is not exercised here.

import { spawnSync } from 'child_process';
import path from 'path';

import { describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'pr-auto-map.sh');

function run(command: string, stderr: string): string {
  const payload = {
    tool_name: 'Bash',
    tool_input: { command },
    tool_response: { stdout: '', stderr, interrupted: false },
  };
  const proc = spawnSync('bash', [SCRIPT], { input: JSON.stringify(payload), encoding: 'utf-8' });
  expect(proc.status).toBe(0);
  const out = (proc.stdout ?? '').trim();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

describe('pr-auto-map.sh — push reminds the agent to refresh the PR description', () => {
  it('fast-forward push from a worktree: repo, branch and new head come from the push report', () => {
    const ctx = run(
      'cd /workspace/agent/wt-slang-13073-pr2 && git push origin HEAD',
      'To https://github.com/shader-slang/slang.git\n   84be79e..555d69c  fix/issue-13073-this-mode -> fix/issue-13073-this-mode\n',
    );
    expect(ctx).toContain('Pushed 555d69c to shader-slang/slang:fix/issue-13073-this-mode');
    expect(ctx).toContain('/explain-diff-html');
  });

  it('forced update over ssh', () => {
    const ctx = run(
      'git push -f origin HEAD:fix/issue-9',
      'To github.com:slang-coworkers/slang.git\n + 1a2b3c4...9f8e7d6 HEAD -> fix/issue-9 (forced update)\n',
    );
    expect(ctx).toContain('Pushed 9f8e7d6 to slang-coworkers/slang:fix/issue-9');
  });

  it('new branch', () => {
    const ctx = run(
      'git push -u origin feat/x',
      'To https://github.com/o/r.git\n * [new branch]      feat/x -> feat/x\n',
    );
    expect(ctx).toContain('to o/r:feat/x');
  });

  it('stays silent when nothing moved, on dry runs, tags, and non-GitHub remotes', () => {
    expect(run('git push', 'Everything up-to-date\n')).toBe('');
    expect(run('git push --dry-run origin x', 'To https://github.com/o/r.git\n   1111111..2222222  x -> x\n')).toBe('');
    expect(
      run('git push origin v1.2.3', 'To https://github.com/o/r.git\n * [new tag]         v1.2.3 -> v1.2.3\n'),
    ).toBe('');
    expect(run('git push lab main', 'To https://gitlab.example.com/o/r.git\n   1111111..2222222  main -> main\n')).toBe(
      '',
    );
  });
});
