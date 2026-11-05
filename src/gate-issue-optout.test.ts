// Integration tests for container/hooks/gate-issue-optout.sh (+ lib/issue_optout.py).
//
// The host writes `.issue-opt-outs.json` into each group folder; the hook refuses a
// tool call that writes to GitHub and names an opted-out issue, and passes
// everything else. Run against a temp dir standing in for /workspace/agent.
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ISSUE_OPT_OUT_GATE_CMD, ISSUE_OPT_OUT_GATE_MATCHER, ensureIssueOptOutGate } from './container-runner.js';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-issue-optout.sh');
const hasPython = spawnSync('python3', ['--version']).status === 0;
const hasJq = spawnSync('jq', ['--version']).status === 0;

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-issue-optout-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

const LIST = {
  version: 1,
  updated_at: '2026-11-05T00:00:00Z',
  issues: {
    'shader-slang/slang': [
      { number: 123, label: 'no-bot' },
      { number: 77, label: 'goodfirstbug' },
    ],
  },
};

function run(toolName: string, toolInput: object, env: Record<string, string> = {}, list: object | null = LIST) {
  if (list) fs.writeFileSync(path.join(tmp, '.issue-opt-outs.json'), JSON.stringify(list));
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: tmp }),
    env: { PATH: process.env.PATH || '', HOME: tmp, OVERLAY_MARKER_DIR: tmp, ...env },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: (proc.stderr ?? '').trim() };
}

const bash = (command: string, env: Record<string, string> = {}, list: object | null = LIST) =>
  run('Bash', { command }, env, list);

describe.skipIf(!hasPython || !hasJq)('gate-issue-optout.sh', () => {
  it('is inert without a list, with an empty list, and when ISSUE_OPT_OUT_GATE=0', () => {
    expect(bash('gh issue comment 123 -R shader-slang/slang --body hi', {}, null).status).toBe(0);
    expect(bash('gh issue comment 123 -R shader-slang/slang --body hi', {}, { version: 1, issues: {} }).status).toBe(0);
    expect(bash('gh issue comment 123 -R shader-slang/slang --body hi', { ISSUE_OPT_OUT_GATE: '0' }).status).toBe(0);
  });

  it('refuses a comment, an edit and a close on an opted-out issue, naming the issue and its label', () => {
    const r = bash('gh issue comment 123 -R shader-slang/slang --body "I can take this"');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('ISSUE OPT-OUT');
    expect(r.stderr).toContain('shader-slang/slang#123 (no-bot)');
    expect(bash('gh issue edit 77 --add-label bug').status).toBe(2);
    expect(bash('gh issue close 123').status).toBe(2);
  });

  it('refuses a PR, a branch push and an API write that name the issue', () => {
    expect(bash('gh pr create --draft --title "Fix #123: crash" --body "Fixes #123"').status).toBe(2);
    expect(bash('git push origin fix/issue-123').status).toBe(2);
    expect(bash('gh api repos/shader-slang/slang/issues/123/comments -f body=hi').status).toBe(2);
    expect(bash("curl -X POST https://api.github.com/repos/shader-slang/slang/issues/77/labels -d '{}'").status).toBe(
      2,
    );
  });

  it('passes reads, writes about other issues, and the same number in another repository', () => {
    expect(bash('gh issue view 123 -R shader-slang/slang').status).toBe(0);
    expect(bash('gh api repos/shader-slang/slang/issues/123/comments').status).toBe(0);
    expect(bash('gh issue comment 124 -R shader-slang/slang --body hi').status).toBe(0);
    expect(bash('gh issue comment 123 -R other/repo --body hi').status).toBe(0);
    expect(bash('git push origin fix/issue-1230').status).toBe(0);
    expect(bash('ls -la && echo "#123 is not a GitHub call"').status).toBe(0);
  });

  it('refuses the GitHub MCP writes for the issue and passes its reads', () => {
    expect(
      run('mcp__github__add_issue_comment', { owner: 'shader-slang', repo: 'slang', issue_number: 123, body: 'x' })
        .status,
    ).toBe(2);
    expect(
      run('mcp__github__create_pull_request', { owner: 'shader-slang', repo: 'slang', title: 'Fix #77', body: '' })
        .status,
    ).toBe(2);
    expect(run('mcp__github__get_issue', { owner: 'shader-slang', repo: 'slang', issue_number: 123 }).status).toBe(0);
    expect(
      run('mcp__github__add_issue_comment', { owner: 'other', repo: 'repo', issue_number: 123, body: 'x' }).status,
    ).toBe(0);
  });

  it('ignores tools that cannot reach GitHub', () => {
    expect(run('Write', { file_path: '/tmp/x', content: 'Fixes #123' }).status).toBe(0);
  });
});

describe('ensureIssueOptOutGate', () => {
  it('registers the hook once, with the GitHub-capable matcher', () => {
    const settings = path.join(tmp, 'settings.json');
    fs.writeFileSync(settings, JSON.stringify({ hooks: {} }));
    ensureIssueOptOutGate(settings);
    ensureIssueOptOutGate(settings);
    const doc = JSON.parse(fs.readFileSync(settings, 'utf-8'));
    const entries = (doc.hooks.PreToolUse as { matcher: string; hooks: { command: string }[] }[]).filter((e) =>
      e.hooks.some((h) => h.command === ISSUE_OPT_OUT_GATE_CMD),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].matcher).toBe(ISSUE_OPT_OUT_GATE_MATCHER);
    expect(ISSUE_OPT_OUT_GATE_MATCHER).toContain('Bash');
    expect(ISSUE_OPT_OUT_GATE_MATCHER).toContain('mcp__github__');
  });
});
