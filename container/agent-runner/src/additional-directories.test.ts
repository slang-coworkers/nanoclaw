import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { discoverAdditionalDirectories, isLinkedGitWorktree } from './additional-directories.js';

/**
 * Regression guard for the autocompaction thrash root cause: a writer tier
 * accumulates many git worktrees of the same repo under CWD, each carrying an
 * identical `.claude/`. Adding every worktree made the SDK re-register the
 * repo's subagents + CLAUDE.md once per worktree, every turn → context refills
 * → thrash. Linked worktrees must be skipped; primary clones, submodules,
 * `--separate-git-dir` checkouts, and plain `.claude/` dirs must still be
 * included (they are legitimately-distinct "cloned repo brings its skills").
 */
function mkClaude(dir: string) {
  fs.mkdirSync(path.join(dir, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\n');
}
function mkGitFile(dir: string, gitdir: string) {
  fs.writeFileSync(path.join(dir, '.git'), `gitdir: ${gitdir}\n`);
}

describe('isLinkedGitWorktree', () => {
  it('true only when .git file gitdir points into .git/worktrees/', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-wt-'));
    try {
      const wt = path.join(base, 'wt');
      fs.mkdirSync(wt);
      mkGitFile(wt, '/repo/.git/worktrees/wt');
      expect(isLinkedGitWorktree(wt)).toBe(true);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('false for a submodule (.git file → .git/modules/…)', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-sm-'));
    try {
      const sm = path.join(base, 'sub');
      fs.mkdirSync(sm);
      mkGitFile(sm, '../.git/modules/foo');
      expect(isLinkedGitWorktree(sm)).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('false for --separate-git-dir (.git file → arbitrary path)', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-sep-'));
    try {
      const d = path.join(base, 'repo');
      fs.mkdirSync(d);
      mkGitFile(d, '/var/gitdirs/repo.git');
      expect(isLinkedGitWorktree(d)).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('false for a primary clone (.git is a directory) and for no .git', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-clone-'));
    try {
      const clone = path.join(base, 'clone');
      fs.mkdirSync(path.join(clone, '.git'), { recursive: true });
      expect(isLinkedGitWorktree(clone)).toBe(false);
      const plain = path.join(base, 'plain');
      fs.mkdirSync(plain);
      expect(isLinkedGitWorktree(plain)).toBe(false);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});

describe('discoverAdditionalDirectories', () => {
  it('skips linked worktrees but keeps primary clones', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-add-'));
    try {
      const clone = path.join(cwd, 'slang');
      mkClaude(clone);
      fs.mkdirSync(path.join(clone, '.git'));
      for (const wt of ['wt-slang-1', 'wt-slang-2']) {
        const d = path.join(cwd, wt);
        mkClaude(d);
        mkGitFile(d, `${clone}/.git/worktrees/${wt}`);
      }
      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).toEqual([clone]);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('KEEPS a submodule-style checkout that has .claude/ (cloned repo brings its skills)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-add-'));
    try {
      const sub = path.join(cwd, 'vendored');
      mkClaude(sub);
      mkGitFile(sub, '../.git/modules/vendored');
      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).toContain(sub);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('includes a plain .claude/ dir (no .git) and excludes dirs without .claude/', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-add-'));
    try {
      const toolkit = path.join(cwd, 'toolkit');
      mkClaude(toolkit); // no .git
      fs.mkdirSync(path.join(cwd, 'notes')); // no .claude
      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).toContain(toolkit);
      expect(out).not.toContain(path.join(cwd, 'notes'));
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('includes ALL immediate subdirs of a non-CWD base regardless of .claude/.git', () => {
    const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-extra-'));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-cwd-'));
    try {
      const ext = path.join(extra, 'ephemeral');
      fs.mkdirSync(ext);
      const out = discoverAdditionalDirectories([extra, cwd], cwd);
      expect(out).toContain(ext);
    } finally {
      fs.rmSync(extra, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('collapses the real shape: 1 clone + 54 worktrees → just the clone', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-add-'));
    try {
      const clone = path.join(cwd, 'slang');
      mkClaude(clone);
      fs.mkdirSync(path.join(clone, '.git'));
      for (let i = 0; i < 54; i++) {
        const d = path.join(cwd, `wt-slang-${i}`);
        mkClaude(d);
        mkGitFile(d, `${clone}/.git/worktrees/wt-slang-${i}`);
      }
      expect(discoverAdditionalDirectories([cwd], cwd)).toEqual([clone]);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
