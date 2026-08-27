/**
 * Tests for the two primitives composeMergeViaClaude validates and rolls back with.
 *
 * Both encode a bug that shipped:
 *   - `git diff --quiet` was used as the clean-tree test. It ignores staged AND
 *     untracked files, so an assist that committed its merge and left residue
 *     behind returned success, and the next setup step consumed uncommitted agent
 *     output as if it had landed.
 *   - `git reset --hard <start>` was the rollback. It restores tracked files and
 *     leaves untracked ones exactly where they are, so a "rolled back" tree still
 *     carried whatever the assist created.
 *
 * The cases below are therefore mostly the residue-only shapes neither old check
 * could see.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  evaluateComposition,
  isAncestor,
  removeRecordedFiles,
  worktreeResidue,
  type CompositionFacts,
} from './claude-assist.js';

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
};

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

/** `git diff --quiet` — the old clean-tree test — as a boolean. */
function diffQuietSaysClean(cwd: string): boolean {
  return spawnSync('git', ['diff', '--quiet'], { cwd, env: ENV }).status === 0;
}

function withRepo(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assist-'));
  try {
    git(dir, 'init', '-q', '-b', 'main', '.');
    fs.writeFileSync(path.join(dir, 'tracked.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n.env\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', 'base');
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('worktreeResidue', () => {
  it('is empty on a clean tree', () => {
    withRepo((dir) => {
      expect(worktreeResidue(dir)).toEqual([]);
    });
  });

  it('sees an UNTRACKED file that `git diff --quiet` calls clean', () => {
    withRepo((dir) => {
      // The finding's shape: Claude committed its merge, then left a scratch file.
      fs.writeFileSync(path.join(dir, 'scratch.ts'), 'half a thought\n');

      expect(diffQuietSaysClean(dir)).toBe(true); // the old test: "clean"
      expect(worktreeResidue(dir)).toEqual([{ code: '??', path: 'scratch.ts' }]);
    });
  });

  it('sees a STAGED change that `git diff --quiet` calls clean', () => {
    withRepo((dir) => {
      fs.writeFileSync(path.join(dir, 'tracked.ts'), 'export const a = 2;\n');
      git(dir, 'add', 'tracked.ts');

      // `git diff` compares the worktree to the INDEX, and staging made them
      // match again — so the old check went green on a modified tree.
      expect(diffQuietSaysClean(dir)).toBe(true);
      expect(worktreeResidue(dir).map((e) => e.path)).toEqual(['tracked.ts']);
    });
  });

  it('lists untracked files individually, including inside new directories', () => {
    withRepo((dir) => {
      fs.mkdirSync(path.join(dir, 'gen', 'deep'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'gen', 'deep', 'a.ts'), 'a\n');
      fs.writeFileSync(path.join(dir, 'gen', 'b.ts'), 'b\n');

      // --untracked-files=all, not the default that collapses to `gen/`; the
      // rollback needs concrete paths to delete, never a directory to wipe.
      expect(
        worktreeResidue(dir)
          .map((e) => e.path)
          .sort(),
      ).toEqual(['gen/b.ts', 'gen/deep/a.ts']);
    });
  });

  it('handles paths with spaces and a rename without desyncing', () => {
    withRepo((dir) => {
      fs.writeFileSync(path.join(dir, 'two words.ts'), 'x\n');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'add spaced file');
      git(dir, 'mv', 'two words.ts', 'renamed file.ts');
      fs.writeFileSync(path.join(dir, 'later.ts'), 'y\n');

      // A rename entry carries a second NUL field (the original path). Miscounting
      // it would shift every later entry — including the untracked ones we delete.
      const entries = worktreeResidue(dir);
      expect(entries.map((e) => e.path).sort()).toEqual(['later.ts', 'renamed file.ts']);
      expect(entries.find((e) => e.path === 'later.ts')?.code).toBe('??');
    });
  });

  it('reports non-empty when git status cannot run', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
    try {
      // No answer must never read as "clean" — that is the whole failure mode.
      expect(worktreeResidue(dir).length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('removeRecordedFiles', () => {
  it('cleans up what `git reset --hard` leaves behind', () => {
    withRepo((dir) => {
      const start = git(dir, 'rev-parse', 'HEAD').trim();

      // An assist that committed once and left a file behind.
      fs.writeFileSync(path.join(dir, 'tracked.ts'), 'export const a = 2;\n');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'claude commit');
      fs.writeFileSync(path.join(dir, 'scratch.ts'), 'residue\n');

      const residue = worktreeResidue(dir).filter((e) => e.code === '??');
      git(dir, 'reset', '--hard', start);
      expect(fs.existsSync(path.join(dir, 'scratch.ts'))).toBe(true); // reset left it

      removeRecordedFiles(
        dir,
        residue.map((e) => e.path),
      );
      expect(fs.existsSync(path.join(dir, 'scratch.ts'))).toBe(false);
      expect(worktreeResidue(dir)).toEqual([]);
    });
  });

  it('removes only the recorded paths — never a broad clean', () => {
    withRepo((dir) => {
      // Gitignored, so `git clean -fdx` would delete both. They are the developer's,
      // not the assist's, and losing them is worse than the residue.
      fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'node_modules', 'dep.js'), 'dep\n');
      fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=keep-me\n');
      fs.writeFileSync(path.join(dir, 'scratch.ts'), 'residue\n');

      removeRecordedFiles(dir, ['scratch.ts']);

      expect(fs.existsSync(path.join(dir, 'scratch.ts'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'node_modules', 'dep.js'))).toBe(true);
      expect(fs.readFileSync(path.join(dir, '.env'), 'utf-8')).toBe('TOKEN=keep-me\n');
    });
  });

  it('prunes directories the removals emptied, but keeps ones still in use', () => {
    withRepo((dir) => {
      fs.mkdirSync(path.join(dir, 'gen', 'deep'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'gen', 'deep', 'a.ts'), 'a\n');
      fs.mkdirSync(path.join(dir, 'keep'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'keep', 'mine.ts'), 'mine\n');
      fs.writeFileSync(path.join(dir, 'keep', 'theirs.ts'), 'theirs\n');

      removeRecordedFiles(dir, ['gen/deep/a.ts', 'keep/theirs.ts']);

      expect(fs.existsSync(path.join(dir, 'gen'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'keep', 'mine.ts'))).toBe(true);
    });
  });

  it('refuses paths that escape the project root', () => {
    withRepo((dir) => {
      const outside = path.join(path.dirname(dir), 'outside.ts');
      fs.writeFileSync(outside, 'not yours\n');
      try {
        removeRecordedFiles(dir, ['../outside.ts', '/etc/hosts']);
        expect(fs.existsSync(outside)).toBe(true);
      } finally {
        fs.rmSync(outside, { force: true });
      }
    });
  });

  it('tolerates a path that is already gone', () => {
    withRepo((dir) => {
      expect(() => removeRecordedFiles(dir, ['never-existed.ts'])).not.toThrow();
    });
  });
});

describe('evaluateComposition', () => {
  const OK: CompositionFacts = {
    built: true,
    branchNow: 'nv-coworkers',
    branchBefore: 'nv-coworkers',
    headBefore: 'aaa',
    headNow: 'bbb',
    overlayLanded: true,
    descendsFromStart: true,
    residueCount: 0,
  };

  it('accepts a real composition', () => {
    expect(evaluateComposition(OK)).toBeNull();
  });

  // The two defects. Both of these used to return SUCCESS: the old predicate was
  // `built && HEAD !== startHead && residue.length === 0`, and each of these
  // satisfies all three while the requested overlay is nowhere in the tree.
  it('rejects an unrelated commit that never brought the overlay in', () => {
    expect(evaluateComposition({ ...OK, overlayLanded: false })).toBe('overlay-not-in-history');
  });

  it('rejects a composition that landed on a different branch', () => {
    expect(evaluateComposition({ ...OK, branchNow: 'some-other-branch' })).toBe('branch-switched');
  });

  it('rejects a detached HEAD rather than reading it as a branch name', () => {
    // `git rev-parse --abbrev-ref HEAD` prints the literal "HEAD" when detached,
    // so a naive string compare against a branch called HEAD would pass.
    expect(evaluateComposition({ ...OK, branchNow: 'HEAD', branchBefore: 'HEAD' })).toBe('detached-head');
  });

  it('rejects a reset/rewrite that dropped the starting commit', () => {
    expect(evaluateComposition({ ...OK, descendsFromStart: false })).toBe('history-rewritten');
  });

  it('rejects a run that committed nothing', () => {
    expect(evaluateComposition({ ...OK, headNow: OK.headBefore })).toBe('no-new-commit');
  });

  it('rejects a tree that does not build', () => {
    expect(evaluateComposition({ ...OK, built: false })).toBe('build-failed');
  });

  it('reports uncommitted residue ahead of everything else', () => {
    // Residue is the one failure whose message carries a file list, and a green
    // build over uncommitted files is exactly how unreviewed output leaked
    // through before. It outranks the rest.
    expect(evaluateComposition({ ...OK, residueCount: 3, built: false })).toBe('uncommitted-residue');
  });

  it('reports a rewritten history rather than blaming the overlay', () => {
    // A reset also makes the overlay unreachable; reporting "overlay missing"
    // would send someone to re-run the merge instead of looking at the reflog.
    expect(evaluateComposition({ ...OK, descendsFromStart: false, overlayLanded: false })).toBe('history-rewritten');
  });
});

describe('isAncestor', () => {
  it('is true for a real ancestor and false for an unrelated commit', () => {
    withRepo((dir) => {
      const base = git(dir, 'rev-parse', 'HEAD').trim();
      fs.writeFileSync(path.join(dir, 'next.ts'), 'export const b = 2;\n');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'next');
      const head = git(dir, 'rev-parse', 'HEAD').trim();
      expect(isAncestor(dir, base, head)).toBe(true);
      expect(isAncestor(dir, head, base)).toBe(false);
    });
  });

  it('is false — never true — when the ref does not exist', () => {
    // "Could not verify" must read as NOT verified: this gates whether a
    // composition is called successful.
    withRepo((dir) => {
      const head = git(dir, 'rev-parse', 'HEAD').trim();
      expect(isAncestor(dir, 'origin/does-not-exist', head)).toBe(false);
    });
  });
});
