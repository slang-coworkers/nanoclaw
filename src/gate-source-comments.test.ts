// Integration tests for container/hooks/gate-source-comments.sh (+ lib/source_comments.py).
//
// A `git commit` may not add a source comment that carries process or history (issue
// and PR numbers, "before this change", "fixes #N") or the deprecated `ConstRef` term.
// The hook reads the lines the commit would add (staged, or the working tree for -a)
// and refuses with one line on stderr naming file:line and the rule.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SOURCE_COMMENT_GATE_CMD, ensureSourceCommentGate } from './container-runner.js';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-source-comments.sh');
const hasPython = spawnSync('python3', ['--version']).status === 0;
const hasJq = spawnSync('jq', ['--version']).status === 0;
const hasGit = spawnSync('git', ['--version']).status === 0;

let repo: string;

function git(...args: string[]) {
  const r = spawnSync('git', ['-C', repo, ...args], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@x',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@x',
    },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

beforeEach(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-source-comments-'));
  git('init', '-q');
  fs.writeFileSync(path.join(repo, 'a.cpp'), 'int f() { return 1; }\n');
  fs.writeFileSync(path.join(repo, 'notes.md'), 'see #1234\n');
  git('add', '.');
  git('commit', '-q', '-m', 'base');
});

afterEach(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

function hook(command: string, env: Record<string, string> = {}, cwd = repo) {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd }),
    env: { PATH: process.env.PATH || '', HOME: repo, ...env },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: (proc.stderr ?? '').trim() };
}

function stage(file: string, content: string) {
  fs.writeFileSync(path.join(repo, file), content);
  git('add', file);
}

describe.skipIf(!hasPython || !hasJq || !hasGit)('gate-source-comments.sh', () => {
  it('ignores commands that are not a git commit', () => {
    stage('a.cpp', '// Fixes #11774\nint f() { return 1; }\n');
    expect(hook('git status').status).toBe(0);
    expect(hook('gh pr create --title x --body "Fixes #11774"').status).toBe(0);
  });

  it('allows a commit whose added comments carry no process, history or deprecated term', () => {
    stage('a.cpp', '// We return the identity so the caller can fold it away.\nint f() { return 1; }\n');
    expect(hook('git commit -m "ok"').status).toBe(0);
  });

  it('refuses an added comment with an issue or PR number, naming file:line and the rule', () => {
    stage('a.cpp', 'int f() { return 1; }\n// See #11774 for the slow path this replaces.\n');
    const r = hook('git commit -m "ref"');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('a.cpp:2 (issue or PR reference)');
    expect(r.stderr).toContain('commit message');
  });

  it('refuses history and the deprecated ConstRef term, in line and block comments', () => {
    stage(
      'a.cpp',
      '/* Before this change the value was copied.\n * The ConstRef parameter is loaded here. */\nint f() { return 1; }\n',
    );
    const r = hook('git commit -m "hist"');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('a.cpp:1 (history)');
    expect(r.stderr).toContain('a.cpp:2 (deprecated term)');
  });

  it('does not read references inside code or strings as comments', () => {
    stage('a.cpp', 'const char* s = "see #1234"; int issue1234 = 0; // keep\n');
    expect(hook('git commit -m "code"').status).toBe(0);
  });

  it('ignores files that are not source files', () => {
    stage('notes.md', 'see #1234 and #5678, before this change\n');
    expect(hook('git commit -m "docs"').status).toBe(0);
  });

  it('reads the working tree for git commit -a and -am, and honours git -C', () => {
    fs.writeFileSync(path.join(repo, 'a.cpp'), '// fixes #99999\nint f() { return 1; }\n');
    expect(hook('git commit -am "all"').status).toBe(2);
    expect(hook('git commit -m "staged only"').status).toBe(0);
    expect(hook(`git -C ${repo} commit -a -m "all"`, {}, os.tmpdir()).status).toBe(2);
  });

  it('is disabled by SOURCE_COMMENT_GATE=0 and allows when git cannot answer', () => {
    stage('a.cpp', '// Fixes #11774\n');
    expect(hook('git commit -m "x"', { SOURCE_COMMENT_GATE: '0' }).status).toBe(0);
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
    expect(hook('git commit -m "x"', {}, empty).status).toBe(0);
    fs.rmSync(empty, { recursive: true, force: true });
  });
});

describe('ensureSourceCommentGate', () => {
  it('registers the hook once and keeps it on repeat', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-'));
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ hooks: { PreToolUse: [] } }));
    ensureSourceCommentGate(file);
    ensureSourceCommentGate(file);
    const hooks = JSON.parse(fs.readFileSync(file, 'utf-8')).hooks.PreToolUse as Array<{
      matcher: string;
      hooks: Array<{ command: string }>;
    }>;
    const mine = hooks.filter((h) => h.hooks.some((i) => i.command === SOURCE_COMMENT_GATE_CMD));
    expect(mine).toHaveLength(1);
    expect(mine[0].matcher).toBe('Bash');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
