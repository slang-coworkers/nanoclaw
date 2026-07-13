import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { discoverAdditionalDirectories } from './index.js';

/**
 * Regression guard for the autocompaction thrash root cause: a writer tier
 * accumulates many git worktrees of the same repo under CWD, each carrying an
 * identical `.claude/`. Adding every worktree to additionalDirectories made the
 * SDK re-register the repo's subagents + CLAUDE.md once per worktree, every turn
 * (50+ dup copies → context refills → thrash). Worktrees must be skipped;
 * primary clones and plain `.claude/` dirs must still be included.
 */
function mkClaude(dir: string) {
  fs.mkdirSync(path.join(dir, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\n');
}

describe('discoverAdditionalDirectories', () => {
  it('skips linked worktrees (.git is a file) but keeps primary clones (.git is a dir)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-adddirs-'));
    try {
      // Primary clone: .git is a directory
      const clone = path.join(cwd, 'slang');
      mkClaude(clone);
      fs.mkdirSync(path.join(clone, '.git'));

      // Two linked worktrees: .git is a file (gitdir pointer), identical .claude/
      for (const wt of ['wt-slang-1', 'wt-slang-2']) {
        const d = path.join(cwd, wt);
        mkClaude(d);
        fs.writeFileSync(path.join(d, '.git'), `gitdir: ${clone}/.git/worktrees/${wt}\n`);
      }

      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).toContain(clone);
      expect(out).not.toContain(path.join(cwd, 'wt-slang-1'));
      expect(out).not.toContain(path.join(cwd, 'wt-slang-2'));
      expect(out.length).toBe(1);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('includes a CWD subdir with .claude/ and no .git (plain cloned config)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-adddirs-'));
    try {
      const d = path.join(cwd, 'toolkit');
      mkClaude(d); // no .git at all
      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).toContain(d);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('excludes CWD subdirs without a .claude/ dir', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-adddirs-'));
    try {
      fs.mkdirSync(path.join(cwd, 'notes')); // plain dir, no .claude
      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).not.toContain(path.join(cwd, 'notes'));
      expect(out.length).toBe(0);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('includes ALL immediate subdirs of a non-CWD base (e.g. /workspace/extra) regardless of .claude/.git', () => {
    const extra = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-extra-'));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-cwd-'));
    try {
      const ext = path.join(extra, 'ephemeral');
      fs.mkdirSync(ext); // no .claude, no .git — still included for non-CWD base
      const out = discoverAdditionalDirectories([extra, cwd], cwd);
      expect(out).toContain(ext);
    } finally {
      fs.rmSync(extra, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('collapses the real-world shape: 1 clone + N worktrees → just the clone', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-adddirs-'));
    try {
      const clone = path.join(cwd, 'slang');
      mkClaude(clone);
      fs.mkdirSync(path.join(clone, '.git'));
      for (let i = 0; i < 54; i++) {
        const d = path.join(cwd, `wt-slang-${i}`);
        mkClaude(d);
        fs.writeFileSync(path.join(d, '.git'), 'gitdir: /somewhere\n');
      }
      const out = discoverAdditionalDirectories([cwd], cwd);
      expect(out).toEqual([clone]);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});
