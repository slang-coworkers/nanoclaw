// Integration tests for container/hooks/pr-auto-map.sh.
//
// A push to a branch that backs a PR moves the PR's head, so the PR's
// explanation comment (the /explain-diff-html explanation) describes a stale head
// until it is rewritten. The hook reads repo, branch and new head from git's own push report
// and reminds the agent. It also keeps the receipts the refresh gates read
// (container/hooks/lib/explain-diff-owed.sh): PR created, branch pushed,
// explanation comment written by upsert_pr_body.py.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'pr-auto-map.sh');

let tmpRoot: string;
let receiptsFile: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-auto-map-test-'));
  receiptsFile = path.join(tmpRoot, 'claude', 'explain-diff-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function hook(command: string, stdout: string, stderr: string): string {
  const payload = {
    tool_name: 'Bash',
    tool_input: { command },
    tool_response: { stdout, stderr, interrupted: false },
  };
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: { PATH: process.env.PATH || '', EXPLAIN_DIFF_STATE_FILE: receiptsFile },
    encoding: 'utf-8',
  });
  expect(proc.status).toBe(0);
  const out = (proc.stdout ?? '').trim();
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : '';
}

const run = (command: string, stderr: string): string => hook(command, '', stderr);

interface Receipts {
  seq: number;
  prs?: Record<string, Record<string, unknown>>;
  pushes?: Record<string, Record<string, unknown>>;
}
const receipts = (): Receipts => JSON.parse(fs.readFileSync(receiptsFile, 'utf-8')) as Receipts;

const UPSERT =
  'python3 /home/node/.claude/skills/explain-diff-html/scripts/upsert_pr_body.py --repo "$R" --pr "$N" --head "$(git -C "$WT" rev-parse HEAD)" --explanation /tmp/explain-body.md';
const upsertOut = (head: string) =>
  `${JSON.stringify({ updated: true, repo: 'shader-slang/slang', pr: 13213, chars: 9000, head, legacy_comment: 'none' })}\n`;

describe('pr-auto-map.sh — push reminds the agent to refresh the explanation comment', () => {
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
    // Nothing moved → nothing recorded.
    expect(fs.existsSync(receiptsFile)).toBe(false);
  });
});

describe('pr-auto-map.sh — receipts for the explanation comment refresh gates', () => {
  it('PR create: records the PR and its branch (owner: prefix dropped), keeps the reminder', () => {
    const ctx = hook(
      'gh pr create --repo shader-slang/slang --head slang-coworkers:fix/issue-13073 --title t --body-file /tmp/b.md',
      'https://github.com/shader-slang/slang/pull/13213\n',
      '',
    );
    expect(ctx).toContain('PR created: shader-slang/slang#13213');
    expect(ctx).toContain('report_pr_created(repo="shader-slang/slang", pr_number=13213)');
    const pr = receipts().prs?.['shader-slang/slang#13213'];
    expect(pr).toMatchObject({ repo: 'shader-slang/slang', number: 13213, branch: 'fix/issue-13073' });
    expect(String(pr?.created_at)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    expect(pr?.explained_seq).toBeUndefined();
  });

  it('PR create without --head records branch null; a variable --head is not guessed', () => {
    hook('gh pr create --fill', 'https://github.com/o/r/pull/7\n', '');
    hook('gh pr create -H "$BR" --fill', 'https://github.com/o/r/pull/8\n', '');
    expect(receipts().prs?.['o/r#7'].branch).toBeNull();
    expect(receipts().prs?.['o/r#8'].branch).toBeNull();
  });

  it('push: records head and time for repo:branch', () => {
    run(
      'git push origin HEAD',
      'To https://github.com/slang-coworkers/slang.git\n   84be79e..555d69c  fix/issue-13073 -> fix/issue-13073\n',
    );
    expect(receipts().pushes?.['slang-coworkers/slang:fix/issue-13073']).toMatchObject({
      repo: 'slang-coworkers/slang',
      branch: 'fix/issue-13073',
      head: '555d69c',
      seq: 1,
    });
  });

  it('push and PR create in one command: both are recorded and both reminders survive', () => {
    const ctx = hook(
      'git push -u origin fix/x && gh pr create --fill',
      'https://github.com/o/r/pull/9\n',
      'To https://github.com/o/r.git\n * [new branch]      fix/x -> fix/x\n',
    );
    expect(ctx).toContain('PR created: o/r#9');
    expect(ctx).toContain('Pushed the new head to o/r:fix/x');
    expect(receipts().pushes?.['o/r:fix/x'].head).toBeNull();
    expect(receipts().prs?.['o/r#9']).toBeDefined();
  });

  it('upsert success: records explained_head/at for the PR, even when --repo/--pr are shell variables', () => {
    run(
      'git push',
      'To https://github.com/slang-coworkers/slang.git\n   84be79e..555d69c  fix/issue-13073 -> fix/issue-13073\n',
    );
    hook('gh pr create --fill', 'https://github.com/shader-slang/slang/pull/13213\n', '');
    expect(hook(UPSERT, upsertOut('555d69c0ffee'), '')).toBe('');
    const pr = receipts().prs?.['shader-slang/slang#13213'];
    expect(pr).toMatchObject({ explained_head: '555d69c0ffee', explained_seq: 3 });
    expect(String(pr?.explained_at)).toMatch(/Z$/);
    // The explained head is the fork branch's last push: the PR is bound to it.
    expect(pr?.branch).toBe('fix/issue-13073');
  });

  it('upsert with the older output shape falls back to literal --repo/--pr flags', () => {
    hook(
      'python3 upsert_pr_body.py --repo o/r --pr 12 --head abc1234 --explanation /tmp/e.md',
      '{"updated": true, "chars": 100, "head": "abc1234def00", "legacy_comment": "none"}\n',
      '',
    );
    expect(receipts().prs?.['o/r#12']).toMatchObject({ explained_head: 'abc1234def00', created_at: null });
  });

  it('no receipt for --dry-run, --quiz-positions, or a failed / head-mismatch run', () => {
    hook(`${UPSERT} --dry-run`, `## 📖 Explanation\n${upsertOut('555d69c0ffee')}`, '[dry-run] 900 chars');
    hook('python3 upsert_pr_body.py --quiz-positions --head 555d69c', `C A D B C\n${upsertOut('555d69c0ffee')}`, '');
    hook(UPSERT, '', 'head mismatch: explanation written from 555d69c0ffee, PR head is 9f8e7d600000');
    hook(UPSERT, '{"updated": false}\n', '');
    expect(fs.existsSync(receiptsFile)).toBe(false);
  });

  it('a push in the same command as a successful upsert does not re-issue the push reminder', () => {
    const ctx = hook(
      `git push && ${UPSERT}`,
      upsertOut('9f8e7d6aaaaa'),
      'To https://github.com/o/slang.git\n   555d69c..9f8e7d6  fix/x -> fix/x\n',
    );
    expect(ctx).toBe('');
    const r = receipts();
    expect(r.pushes?.['o/slang:fix/x'].seq).toBe(1);
    expect(r.prs?.['shader-slang/slang#13213'].explained_seq).toBe(2);
  });

  it('a POST to an existing PR (comments/reviews) is not a PR creation', () => {
    const ctx = hook(
      'curl -X POST https://api.github.com/repos/o/r/pulls/5/comments -d @c.json',
      '{"html_url": "https://github.com/o/r/pull/5#discussion_r1"}',
      '',
    );
    expect(ctx).toBe('');
    expect(fs.existsSync(receiptsFile)).toBe(false);
  });

  it('EXPLAIN_DIFF_STATE_FILE picks the receipts path, creating its directory', () => {
    const custom = path.join(tmpRoot, 'nested', 'dir', 'receipts.json');
    const proc = spawnSync('bash', [SCRIPT], {
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'gh pr create --fill' },
        tool_response: { stdout: 'https://github.com/o/r/pull/1\n', stderr: '' },
      }),
      env: { PATH: process.env.PATH || '', EXPLAIN_DIFF_STATE_FILE: custom },
      encoding: 'utf-8',
    });
    expect(proc.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(custom, 'utf-8')).prs['o/r#1']).toBeDefined();
  });

  it('an unwritable receipts path never breaks the reminder', () => {
    const ro = path.join(tmpRoot, 'ro');
    fs.mkdirSync(ro);
    fs.chmodSync(ro, 0o500);
    try {
      const proc = spawnSync('bash', [SCRIPT], {
        input: JSON.stringify({
          tool_name: 'Bash',
          tool_input: { command: 'gh pr create --fill' },
          tool_response: { stdout: 'https://github.com/o/r/pull/1\n', stderr: '' },
        }),
        env: { PATH: process.env.PATH || '', EXPLAIN_DIFF_STATE_FILE: path.join(ro, 'sub', 'r.json') },
        encoding: 'utf-8',
      });
      expect(proc.status).toBe(0);
      expect(proc.stdout).toContain('PR created: o/r#1');
    } finally {
      fs.chmodSync(ro, 0o700);
    }
  });
});
