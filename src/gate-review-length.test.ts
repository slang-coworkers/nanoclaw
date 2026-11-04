// Integration tests for container/hooks/gate-review-length.sh (+ lib/review_length.py).
//
// A posted or delivered review stays under the cap (default 4,000 characters of
// review text: summary or body plus every inline comment). The hook is inert
// unless `<OVERLAY_MARKER_DIR>/.overlay-review-length` exists or
// REVIEW_LENGTH_GATE_ACTIVE=1; when active it measures the review text of the
// call (gh pr review / comment, gh api …/reviews, an answer.json write, the
// GitHub MCP pending-review flow) and refuses with one line on stderr.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { REVIEW_LENGTH_GATE_MATCHER, ensureReviewLengthGate } from './container-runner.js';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-review-length.sh');
const hasPython = spawnSync('python3', ['--version']).status === 0;
const hasJq = spawnSync('jq', ['--version']).status === 0;

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-review-length-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(toolName: string, toolInput: object, env: Record<string, string> = {}, active = true) {
  if (active) fs.writeFileSync(path.join(tmp, '.overlay-review-length'), 'review-length\n');
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: tmp }),
    env: { PATH: process.env.PATH || '', HOME: tmp, OVERLAY_MARKER_DIR: tmp, ...env },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: (proc.stderr ?? '').trim() };
}

const bash = (command: string, env: Record<string, string> = {}, active = true) =>
  run('Bash', { command }, env, active);

const text = (n: number) => 'x'.repeat(n);
const answer = (summaryLen: number, findings: number[]) =>
  JSON.stringify({
    summary: text(summaryLen),
    findings: findings.map((n, i) => ({ file: `source/a${i}.cpp`, line: 10 + i, comment: text(n) })),
  });

describe.skipIf(!hasPython || !hasJq)('gate-review-length.sh', () => {
  it('is inert without the marker and without REVIEW_LENGTH_GATE_ACTIVE', () => {
    expect(bash(`gh pr review 12 --body "${text(5000)}"`, {}, false).status).toBe(0);
    expect(bash(`gh pr review 12 --body "${text(5000)}"`, { REVIEW_LENGTH_GATE_ACTIVE: '0' }, true).status).toBe(0);
  });

  it('activates on REVIEW_LENGTH_GATE_ACTIVE=1 without the marker, and REVIEW_LENGTH_GATE=0 disables it', () => {
    expect(bash(`gh pr review 12 --body "${text(5000)}"`, { REVIEW_LENGTH_GATE_ACTIVE: '1' }, false).status).toBe(2);
    expect(bash(`gh pr review 12 --body "${text(5000)}"`, { REVIEW_LENGTH_GATE: '0' }).status).toBe(0);
  });

  it('refuses a gh pr review body over the cap and says the count and the cap', () => {
    const r = bash(`gh pr review 12 -R shader-slang/slang --comment --body "${text(4100)}"`);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('REVIEW TOO LONG');
    expect(r.stderr).toContain('gh pr review');
    expect(r.stderr).toContain('4,100');
    expect(r.stderr).toContain('4,000');
    expect(r.stderr.split('\n')).toHaveLength(1);
    expect(bash(`gh pr review 12 --approve --body "${text(3900)}"`).status).toBe(0);
  });

  it('reads --body-file for gh pr review and gh pr comment', () => {
    const long = path.join(tmp, 'review.md');
    const short = path.join(tmp, 'short.md');
    fs.writeFileSync(long, text(4200));
    fs.writeFileSync(short, text(300));
    expect(bash(`gh pr review 12 --body-file ${long}`).status).toBe(2);
    expect(bash(`gh pr comment 12 --body-file ${long}`).status).toBe(2);
    expect(bash(`gh pr review 12 --body-file ${short}`).status).toBe(0);
    expect(bash(`gh pr comment 12 -F ${short}`).status).toBe(0);
  });

  it('honours REVIEW_LENGTH_CAP_CHARS', () => {
    expect(bash(`gh pr comment 12 --body "${text(150)}"`, { REVIEW_LENGTH_CAP_CHARS: '100' }).status).toBe(2);
    expect(bash(`gh pr comment 12 --body "${text(90)}"`, { REVIEW_LENGTH_CAP_CHARS: '100' }).status).toBe(0);
  });

  it('counts body plus every inline comment of a gh api …/reviews payload', () => {
    const over = path.join(tmp, 'over.json');
    const under = path.join(tmp, 'under.json');
    const payload = (n: number) =>
      JSON.stringify({
        commit_id: 'abc',
        event: 'COMMENT',
        body: text(1000),
        comments: Array.from({ length: n }, (_, i) => ({ path: 'a.cpp', line: i + 1, body: text(900) })),
      });
    fs.writeFileSync(over, payload(4)); // 1,000 + 3,600
    fs.writeFileSync(under, payload(3)); // 1,000 + 2,700
    const r = bash(`gh api -X POST repos/shader-slang/slang/pulls/12/reviews --input ${over}`);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('4,600');
    expect(r.stderr).toContain('4 comments');
    expect(bash(`gh api -X POST repos/shader-slang/slang/pulls/12/reviews --input ${under}`).status).toBe(0);
    expect(bash(`gh api repos/shader-slang/slang/pulls/12/reviews`).status).toBe(0);
    expect(
      bash(`gh api -X POST repos/o/r/pulls/12/comments -f body="${text(4500)}" -f path=a.cpp -F line=3`).status,
    ).toBe(2);
    expect(bash(`gh api -X POST repos/o/r/issues/12/comments -f body="${text(500)}"`).status).toBe(0);
  });

  it('measures an evaluation answer.json written by heredoc, tee, echo or the Write tool', () => {
    const dir = path.join(tmp, 'eval', 'slang-pr-1-abc', 'r1');
    fs.mkdirSync(dir, { recursive: true });
    const over = answer(800, [1500, 1500, 1500]); // 5,300
    const under = answer(800, [1000, 1000, 1000]); // 3,800
    const r = bash(`mkdir -p ${dir} && cat > ${dir}/answer.json <<'EOF'\n${over}\nEOF`);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('answer.json');
    expect(r.stderr).toContain('5,300');
    expect(r.stderr).toContain('3 findings');
    expect(bash(`cat > ${dir}/answer.json <<'EOF'\n${under}\nEOF`).status).toBe(0);
    expect(bash(`cat <<'EOF' | tee ${dir}/answer.json\n${over}\nEOF`).status).toBe(2);
    expect(bash(`echo '${over}' > ${dir}/answer.json`).status).toBe(2);
    expect(bash(`printf '%s' '${under}' > ${dir}/answer.json`).status).toBe(0);
    expect(run('Write', { file_path: `${dir}/answer.json`, content: over }).status).toBe(2);
    expect(run('Write', { file_path: `${dir}/answer.json`, content: under }).status).toBe(0);
    // Not a review: an error answer, a non-JSON file, another file name.
    expect(run('Write', { file_path: `${dir}/answer.json`, content: '{"error": "no build"}' }).status).toBe(0);
    expect(run('Write', { file_path: `${dir}/answer.json`, content: text(6000) }).status).toBe(0);
    expect(run('Write', { file_path: `${dir}/notes.md`, content: text(6000) }).status).toBe(0);
  });

  it('measures an Edit of answer.json after the edit is applied', () => {
    const dir = path.join(tmp, 'eval', 't', 'r2');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'answer.json');
    fs.writeFileSync(file, answer(500, [500]));
    const grow = run('Edit', {
      file_path: file,
      old_string: '"findings":[',
      new_string: `"findings":[{"comment":"${text(3200)}"},`,
    });
    expect(grow.status).toBe(2);
    expect(grow.stderr).toContain('4,200');
    const shrink = run('Edit', { file_path: file, old_string: text(500), new_string: 'short', replace_all: true });
    expect(shrink.status).toBe(0);
    const multi = run('MultiEdit', {
      file_path: file,
      edits: [
        { old_string: '"summary":"', new_string: `"summary":"${text(2000)}` },
        { old_string: '"comment":"', new_string: `"comment":"${text(2000)}` },
      ],
    });
    expect(multi.status).toBe(2);
  });

  it('keeps a running total over the GitHub MCP pending-review flow and resets it on submit or delete', () => {
    const pr = { owner: 'shader-slang', repo: 'slang', pullNumber: 12 };
    const env = { REVIEW_LENGTH_STATE_DIR: tmp };
    expect(run('mcp__github__create_pending_pull_request_review', { ...pr, body: text(1000) }, env).status).toBe(0);
    expect(
      run('mcp__github__add_comment_to_pending_review', { ...pr, path: 'a.cpp', line: 1, body: text(2000) }, env)
        .status,
    ).toBe(0);
    const third = run(
      'mcp__github__add_comment_to_pending_review',
      { ...pr, path: 'b.cpp', line: 2, body: text(1500) },
      env,
    );
    expect(third.status).toBe(2);
    expect(third.stderr).toContain('pending review');
    expect(third.stderr).toContain('4,500');
    // A refused comment does not count; a smaller one still fits.
    expect(
      run('mcp__github__add_comment_to_pending_review', { ...pr, path: 'b.cpp', line: 2, body: text(500) }, env).status,
    ).toBe(0);
    expect(
      run('mcp__github__submit_pending_pull_request_review', { ...pr, event: 'COMMENT', body: text(600) }, env).status,
    ).toBe(2);
    expect(
      run('mcp__github__submit_pending_pull_request_review', { ...pr, event: 'COMMENT', body: text(400) }, env).status,
    ).toBe(0);
    // Submitted: the next review on the same PR starts from zero.
    expect(run('mcp__github__create_pending_pull_request_review', { ...pr, body: text(3900) }, env).status).toBe(0);
    expect(run('mcp__github__delete_pending_pull_request_review', pr, env).status).toBe(0);
    expect(
      run('mcp__github__add_comment_to_pending_review', { ...pr, path: 'a.cpp', line: 1, body: text(3900) }, env)
        .status,
    ).toBe(0);
    // Another PR has its own total.
    expect(
      run(
        'mcp__github__add_comment_to_pending_review',
        { ...pr, pullNumber: 13, path: 'a.cpp', line: 1, body: text(3900) },
        env,
      ).status,
    ).toBe(0);
  });

  it('measures single-shot MCP posts and leaves read tools alone', () => {
    const pr = { owner: 'o', repo: 'r', pullNumber: 1 };
    const over = run('mcp__github__create_and_submit_pull_request_review', {
      ...pr,
      event: 'COMMENT',
      body: text(1000),
      comments: [{ path: 'a.cpp', line: 1, body: text(3500) }],
    });
    expect(over.status).toBe(2);
    expect(over.stderr).toContain('4,500');
    expect(
      run('mcp__github__add_issue_comment', { owner: 'o', repo: 'r', issue_number: 1, body: text(4001) }).status,
    ).toBe(2);
    expect(
      run('mcp__github__add_issue_comment', { owner: 'o', repo: 'r', issue_number: 1, body: text(4000) }).status,
    ).toBe(0);
    expect(run('mcp__github__get_pull_request', pr).status).toBe(0);
  });

  it('allows review text it cannot read rather than guessing', () => {
    expect(bash(`gh pr review 12 --body "$(python3 gen.py)"`).status).toBe(0);
    expect(bash(`python3 make_answer.py > ${tmp}/answer.json`).status).toBe(0);
  });
});

describe('ensureReviewLengthGate', () => {
  it('registers the hook once with the review-tool matcher, idempotently', () => {
    const settingsFile = path.join(tmp, 'settings.json');
    fs.writeFileSync(settingsFile, '{}');
    ensureReviewLengthGate(settingsFile);
    ensureReviewLengthGate(settingsFile);
    const hooks = JSON.parse(fs.readFileSync(settingsFile, 'utf-8')).hooks as {
      PreToolUse: Array<{ matcher?: string; hooks?: Array<{ command?: string }> }>;
    };
    const entries = hooks.PreToolUse.filter((e) => e.hooks?.some((h) => h.command?.includes('gate-review-length.sh')));
    expect(entries).toHaveLength(1);
    expect(entries[0].matcher).toBe(REVIEW_LENGTH_GATE_MATCHER);
    expect(entries[0].matcher).toContain('Write');
    expect(entries[0].matcher).toContain('mcp__github__add_comment_to_pending_review');
  });
});
