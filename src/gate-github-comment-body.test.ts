// Integration tests for container/hooks/gate-github-comment-body.sh (+ lib/github_comment_body.py).
//
// A GitHub comment, review or issue/PR body is refused when GitHub would show it broken:
// the whole body is the literal text `@<path>` (gh reads a file only for -F/--body-file and
// `gh api -F key=@<path>`), or the body opens with a memo's YAML frontmatter block. The two
// real cases below are the commands open-model coworkers ran on prod on 2026-11-16.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-github-comment-body.sh');
const hasPython = spawnSync('python3', ['--version']).status === 0;
const hasJq = spawnSync('jq', ['--version']).status === 0;

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-github-comment-body-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(toolName: string, toolInput: object, env: Record<string, string> = {}) {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: tmp }),
    env: { PATH: process.env.PATH || '', HOME: tmp, ...env },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: (proc.stderr ?? '').trim() };
}

const bash = (command: string, env: Record<string, string> = {}) => run('Bash', { command }, env);

const MEMO = [
  '---',
  'type: comment',
  'title: "Held triage comment draft for shader-slang/slang#14468"',
  'description: 5-bullet triage outcome; retry payload while GitHub API auth is down',
  'tags: [slang, issue-comment, held]',
  '---',
  '',
  '**Status:** Triaged — enhancement (optimization) · low · IR · P3.',
  '',
].join('\n');

const COMMENT = [
  '**Status:** fixed — awaiting a human maintainer.',
  '**Link:** https://github.com/shader-slang/slang/pull/14497',
  '',
  '---',
  '',
  'Thanks @jkwak-work for the repro.',
  '',
].join('\n');

function file(name: string, text: string): string {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, text);
  return p;
}

describe.skipIf(!hasPython || !hasJq)('gate-github-comment-body.sh', () => {
  describe('the two prod cases', () => {
    it('refuses `gh api -f body=@<path>` (slang-fixer, shader-slang/slang#14489)', () => {
      const body = file('issue-comment-14489-final.md', COMMENT);
      const r = bash(
        `gh api -X PATCH repos/shader-slang/slang/issues/comments/6912309417 -f body=@${body} --jq '.html_url' 2>&1 | tail -1`,
      );
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('GITHUB BODY IS A FILE NAME');
      expect(r.stderr).toContain(`"@${body}"`);
      expect(r.stderr).toContain(`-F body=@${body}`);
      expect(r.stderr.split('\n')).toHaveLength(1);
      // The command that fixed it: -F reads the file.
      expect(
        bash(`gh api -X PATCH repos/shader-slang/slang/issues/comments/6912309417 -F body=@${body} --jq '.body'`)
          .status,
      ).toBe(0);
    });

    it('refuses a memo with frontmatter piped through jq into `gh api --input -` (slang-triager, #14468)', () => {
      const memo = file('comment-14468.md', MEMO);
      const post = [
        'N=14468; REPO=shader-slang/slang',
        'IDFILE="/workspace/agent/.gh-comments/${REPO//\\//-}-$N.id"; mkdir -p "$(dirname "$IDFILE")"',
        `BODY="$(cat ${memo})"`,
        `jq -Rsn --arg b "$BODY" '{body:$b}' | gh api "repos/$REPO/issues/$N/comments" --method POST --input - --jq '.id' | tee "$IDFILE"; echo "EXIT=$?"`,
      ].join('\n');
      const r = bash(post);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('GITHUB BODY STARTS WITH YAML FRONTMATTER');
      expect(r.stderr).toContain('gh api …/issues/14468/comments');
      expect(r.stderr).toContain('--body-file');
      expect(r.stderr).toContain('-F body=@');
      expect(r.stderr.split('\n')).toHaveLength(1);
      // The same memo PATCHed in place, and posted with -F body=@ before the frontmatter was stripped.
      const patch = [
        `BODY="$(cat ${memo})"`,
        `jq -Rsn --arg b "$BODY" '{body:$b}' | gh api repos/shader-slang/slang/issues/comments/6912480246 --method PATCH --input - --jq '{id, url: .html_url}'`,
      ].join('\n');
      expect(bash(patch).status).toBe(2);
      expect(bash(`gh api -X PATCH repos/shader-slang/slang/issues/comments/6912480246 -F body=@${memo}`).status).toBe(
        2,
      );
      // After stripping: allowed.
      const stripped = file('c14468-final.md', MEMO.split('\n').slice(7).join('\n'));
      expect(
        bash(`gh api -X PATCH repos/shader-slang/slang/issues/comments/6912480246 -F body=@${stripped}`).status,
      ).toBe(0);
    });
  });

  describe('a literal @<path> body', () => {
    it.each([
      'gh issue comment 14489 -R shader-slang/slang --body "@/tmp/issue-comment-14489-final.md"',
      'gh issue comment 14489 -b @/tmp/c.md',
      'gh pr comment 12 --body=@/tmp/c.md',
      'gh pr review 12 --comment -b "@/tmp/review.md"',
      'gh pr review 12 -a --body @/tmp/review.md',
      'gh issue create -R o/r --title t --body "@./body.md"',
      'gh pr create --title t --body "@~/pr-body.md"',
      'gh pr edit 12 --body "@/tmp/pr-body.md"',
      'gh issue edit 12 --body "@body.md"',
      'gh api repos/o/r/issues/12/comments -f body=@/tmp/c.md',
      'gh api repos/o/r/issues/12 -X PATCH -f body=@/tmp/c.md',
      'gh api repos/o/r/pulls/12 -X PATCH --raw-field body=@/tmp/c.md',
      'gh api repos/o/r/pulls/12/reviews -f event=COMMENT -f body=@/tmp/r.md',
      "gh api repos/o/r/pulls/12/comments -f 'body=@/tmp/c.md' -f path=a.cpp -F line=3",
      'gh api repos/{owner}/{repo}/issues/12/comments -f body=@/tmp/c.md',
      'F=/tmp/c.md; gh issue comment 1 --body "@$F"',
    ])('refuses %s', (command) => {
      const r = bash(command);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('GITHUB BODY IS A FILE NAME');
    });

    it('names --body-file for gh issue|pr and -F body=@ for gh api', () => {
      expect(bash('gh issue comment 1 --body "@/tmp/c.md"').stderr).toContain(
        '`gh issue comment … --body-file /tmp/c.md`',
      );
      expect(bash('gh api repos/o/r/issues/1/comments -f body=@/tmp/c.md').stderr).toContain(
        '`gh api … -F body=@/tmp/c.md`',
      );
    });

    it('refuses a relative @name only when that file exists', () => {
      expect(bash('gh issue comment 1 --body "@drafts/comment"').status).toBe(0);
      fs.mkdirSync(path.join(tmp, 'drafts'));
      file('drafts/comment', COMMENT);
      expect(bash('gh issue comment 1 --body "@drafts/comment"').status).toBe(2);
    });
  });

  describe('a body that opens with YAML frontmatter', () => {
    it('is refused from --body-file, -F body=@, $(cat …), a heredoc and --input', () => {
      const memo = file('memo.md', MEMO);
      const payload = file('payload.json', JSON.stringify({ body: MEMO }));
      for (const command of [
        `gh issue comment 1 --body-file ${memo}`,
        `gh pr comment 1 -F ${memo}`,
        `gh pr review 1 --comment --body-file ${memo}`,
        `gh issue create --title t --body-file ${memo}`,
        `gh api repos/o/r/issues/1/comments -F body=@${memo}`,
        `gh issue comment 1 --body "$(cat ${memo})"`,
        `gh issue comment 1 --body-file - <<'EOF'\n${MEMO}EOF`,
        `cat <<'EOF' | gh pr comment 1 --body-file -\n${MEMO}EOF`,
        `gh api repos/o/r/issues/1/comments -F body=@- <<'EOF'\n${MEMO}EOF`,
        `gh api -X POST repos/o/r/issues/1/comments --input ${payload}`,
        `jq -n --rawfile b ${memo} '{body: $b}' | gh api repos/o/r/issues/1/comments --input -`,
        `jq -Rs '{body: .}' ${memo} | gh api repos/o/r/issues/1/comments --input -`,
        `gh issue comment 1 --body '${MEMO}'`,
      ]) {
        const r = bash(command);
        expect(r.status, command).toBe(2);
        expect(r.stderr, command).toContain('GITHUB BODY STARTS WITH YAML FRONTMATTER');
      }
    });

    it('names the file in the strip command when the body came from one', () => {
      const memo = file('memo.md', MEMO);
      expect(bash(`gh issue comment 1 --body-file ${memo}`).stderr).toContain(`!f' ${memo} > /tmp/body.md`);
    });

    it('refuses a review whose inline comment opens with frontmatter', () => {
      const payload = file(
        'review.json',
        JSON.stringify({ event: 'COMMENT', body: 'ok', comments: [{ path: 'a.cpp', line: 1, body: MEMO }] }),
      );
      expect(bash(`gh api -X POST repos/o/r/pulls/12/reviews --input ${payload}`).status).toBe(2);
    });
  });

  describe('allowed', () => {
    it('allows --body-file and -F body=@<file> with a normal body', () => {
      const ok = file('ok.md', COMMENT);
      expect(bash(`gh issue comment 1 --body-file ${ok}`).status).toBe(0);
      expect(bash(`gh pr review 1 --approve -F ${ok}`).status).toBe(0);
      expect(bash(`gh api repos/o/r/issues/1/comments -F body=@${ok}`).status).toBe(0);
      expect(bash(`gh api repos/o/r/pulls/1/reviews -F 'body=@${ok}' -f event=COMMENT`).status).toBe(0);
    });

    it('allows a body with @mentions, and a body that is only a mention', () => {
      expect(bash(`gh issue comment 1 --body "@jkwak-work can you take a look?"`).status).toBe(0);
      expect(bash(`gh issue comment 1 --body "@jkwak-work"`).status).toBe(0);
      expect(bash(`gh pr comment 1 --body "@shader-slang/dev"`).status).toBe(0);
      expect(bash(`gh api repos/o/r/issues/1/comments -f body="@coderabbitai review"`).status).toBe(0);
    });

    it('allows a `---` rule later in the body, and a body that opens with a rule and prose', () => {
      expect(bash(`gh issue comment 1 --body-file ${file('rule.md', COMMENT)}`).status).toBe(0);
      const ruleFirst = file('rule-first.md', '---\n\nSummary of the fix below.\n\n---\n\nDetails.\n');
      expect(bash(`gh issue comment 1 --body-file ${ruleFirst}`).status).toBe(0);
      expect(bash(`gh issue comment 1 --body-file ${file('list.md', '---\n- one\n- two\n---\n')}`).status).toBe(0);
    });

    it('allows what it cannot read, reads and other commands', () => {
      expect(bash('gh issue comment 1 --body-file /nonexistent/c.md').status).toBe(0);
      expect(bash('gh issue comment 1 --body "$(generate-comment)"').status).toBe(0);
      expect(bash('gh issue comment 1 --body "$BODY"').status).toBe(0);
      expect(bash('gh api repos/o/r/issues/1/comments').status).toBe(0);
      expect(bash('gh api -X GET repos/o/r/issues/1/comments -f body=@/tmp/c.md').status).toBe(0);
      expect(bash('gh api repos/o/r/contents/README.md -f message=x -f content=@/tmp/c.md').status).toBe(0);
      expect(bash('gh issue view 1 --comments').status).toBe(0);
      expect(bash('echo "--body @/tmp/c.md"').status).toBe(0);
      expect(run('Write', { file_path: path.join(tmp, 'c.md'), content: MEMO }).status).toBe(0);
    });

    it('is off with GITHUB_COMMENT_BODY_GATE=0', () => {
      expect(bash('gh issue comment 1 --body "@/tmp/c.md"', { GITHUB_COMMENT_BODY_GATE: '0' }).status).toBe(0);
    });
  });

  describe('GitHub MCP comment tools', () => {
    it('refuses an @<path> or frontmatter body and allows a normal one', () => {
      const tool = 'mcp__github__add_issue_comment';
      const at = run(tool, { owner: 'o', repo: 'r', issue_number: 1, body: '@/tmp/c.md' });
      expect(at.status).toBe(2);
      expect(at.stderr).toContain('github add_issue_comment');
      expect(run(tool, { owner: 'o', repo: 'r', issue_number: 1, body: MEMO }).status).toBe(2);
      expect(run(tool, { owner: 'o', repo: 'r', issue_number: 1, body: COMMENT }).status).toBe(0);
      expect(
        run('mcp__github__create_and_submit_pull_request_review', {
          owner: 'o',
          repo: 'r',
          pullNumber: 1,
          body: 'ok',
          comments: [{ path: 'a.cpp', line: 1, body: '@/tmp/c.md' }],
        }).status,
      ).toBe(2);
    });
  });
});
