/**
 * Behavioral tests for setup/merge-train.sh's conflict resolver, run under the
 * host vitest suite so the shell logic is CI-protected (the script is not
 * otherwise covered by typecheck/lint). Each case builds a throwaway git repo
 * with a bare "origin" and asserts the merge/resolve/abort behavior.
 *
 * MERGE_TRAIN_NO_INSTALL=1 skips the pnpm install/build tail so the merge logic
 * runs without the Node toolchain.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MERGE_TRAIN = path.join(HERE, 'merge-train.sh');

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  MERGE_TRAIN_NO_INSTALL: '1',
};

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

/**
 * Build a bare origin with: base → nv-main (edits an OWNED src file + an
 * UNOWNED groups file) and two work branches that diverge on each, so a merge
 * of nv-main conflicts on exactly one file per branch. Returns the origin path.
 */
function buildOrigin(root: string): string {
  const seed = path.join(root, 'seed');
  fs.mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'base', '.');
  fs.mkdirSync(path.join(seed, 'src'));
  fs.mkdirSync(path.join(seed, 'groups', 'main'), { recursive: true });
  fs.writeFileSync(path.join(seed, 'src', 'foo.ts'), 'base\n');
  fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'base\n');
  // package.json + lockfile so the pin (package.json/pnpm-lock.yaml → nv-main)
  // has something to reconcile.
  fs.writeFileSync(
    path.join(seed, 'package.json'),
    JSON.stringify({ dependencies: { a: '1.0.0', z: '1.0.0' } }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(seed, 'pnpm-lock.yaml'), 'lock: base\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'base');
  git(seed, 'branch', 'nv-main');
  git(seed, 'branch', 'work-owned');
  git(seed, 'branch', 'work-unowned');
  git(seed, 'branch', 'work-deps');

  git(seed, 'checkout', '-q', 'nv-main');
  // Ownership comes from nv-main's path-guard allowlist (the same file
  // .github/nv-path-guard/check.py enforces), evaluated by nv-main's own matcher
  // — BOTH taken from origin/nv-main. src/** + the shared config are owned;
  // groups/** is not. The matcher has to be committed here because the script
  // extracts it from the ref rather than reading the worktree.
  fs.mkdirSync(path.join(seed, '.github', 'nv-path-guard'), { recursive: true });
  fs.writeFileSync(
    path.join(seed, '.github', 'nv-path-guard', 'nv-main.txt'),
    '.github/**\nsrc/**\npackage.json\npnpm-lock.yaml\n',
  );
  fs.copyFileSync(
    path.join(HERE, '..', '.github', 'nv-path-guard', 'ownership.py'),
    path.join(seed, '.github', 'nv-path-guard', 'ownership.py'),
  );
  fs.writeFileSync(path.join(seed, 'src', 'foo.ts'), 'MAIN\n');
  fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'MAIN\n');
  fs.writeFileSync(
    path.join(seed, 'package.json'),
    JSON.stringify({ dependencies: { a: '2.0.0', z: '1.0.0' } }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(seed, 'pnpm-lock.yaml'), 'lock: nv-main\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qam', 'nv-main changes');

  git(seed, 'checkout', '-q', 'work-owned'); // diverges on src/ (owned)
  fs.writeFileSync(path.join(seed, 'src', 'foo.ts'), 'WORK\n');
  git(seed, 'commit', '-qam', 'work owned');

  git(seed, 'checkout', '-q', 'work-unowned'); // diverges on groups/ (unowned)
  fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'WORK\n');
  git(seed, 'commit', '-qam', 'work unowned');

  // work-deps: package.json adds a dep nv-main lacks — it auto-merges (no textual
  // conflict) to {a, extra, z}, which DIFFERS from nv-main's owned package.json,
  // exercising the general owned-canonical overwrite. src/overlay-only.ts is a
  // NEW owned file absent on nv-main that must be KEPT.
  git(seed, 'checkout', '-q', 'work-deps');
  fs.writeFileSync(
    path.join(seed, 'package.json'),
    JSON.stringify({ dependencies: { a: '1.0.0', extra: '9.9.9', z: '1.0.0' } }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(seed, 'src', 'overlay-only.ts'), 'overlay\n');
  git(seed, 'add', '-A'); // -am below won't stage the new file
  git(seed, 'commit', '-qam', 'work adds a dep + a new owned file');

  git(seed, 'checkout', '-q', 'base');
  const origin = path.join(root, 'origin.git');
  git(root, 'clone', '-q', '--bare', seed, origin);
  return origin;
}

function cloneOn(root: string, origin: string, name: string, branch: string): string {
  const dir = path.join(root, name);
  git(root, 'clone', '-q', origin, dir);
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'checkout', '-q', branch);
  return dir;
}

function runMergeTrain(cwd: string, branch: string) {
  return spawnSync('bash', [MERGE_TRAIN, branch], { cwd, encoding: 'utf-8', env: ENV });
}

describe('merge-train.sh resolver', () => {
  it('auto-resolves an OWNED (src/) conflict to nv-main and succeeds', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-owned-'));
    try {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'c', 'work-owned');
      const res = runMergeTrain(repo, 'nv-main');
      expect(res.status).toBe(0);
      expect(fs.readFileSync(path.join(repo, 'src', 'foo.ts'), 'utf-8')).toBe('MAIN\n');
      expect(git(repo, 'diff', '--name-only', '--diff-filter=U').trim()).toBe('');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('canonicalizes the owned set to nv-main (overwriting auto-merged copies) while keeping overlay-new owned files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-owned-canon-'));
    try {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'c', 'work-deps'); // adds a dep + a new owned file
      const res = runMergeTrain(repo, 'nv-main');
      expect(res.status).toBe(0);
      // Every owned file that exists on nv-main now matches nv-main exactly —
      // the auto-merged package.json (which kept the stale dep) is corrected.
      expect(git(repo, 'diff', 'origin/nv-main', '--', 'package.json', 'pnpm-lock.yaml', 'src/foo.ts').trim()).toBe('');
      expect(fs.readFileSync(path.join(repo, 'pnpm-lock.yaml'), 'utf-8')).toBe('lock: nv-main\n');
      // ...but the overlay's NEW owned file (absent on nv-main) is kept.
      expect(fs.readFileSync(path.join(repo, 'src', 'overlay-only.ts'), 'utf-8')).toBe('overlay\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('aborts on an UNOWNED (groups/) conflict, leaving a clean tree', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-unowned-'));
    try {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'c', 'work-unowned');
      const res = runMergeTrain(repo, 'nv-main');
      expect(res.status).toBe(1);
      expect(git(repo, 'status', '--porcelain').trim()).toBe('');
      expect(res.stderr).toMatch(/owned set/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('an ambient .gitignore cannot widen what nv-main owns', () => {
    // is_owned() used to be `git check-ignore` run IN THIS REPO, which also reads
    // the repo's .gitignore. The real nanoclaw .gitignore lists `groups/*`,
    // `data/`, `logs/`, `dist/`, `repos/` and `coworkers/*.yaml` — none of them
    // in nv-main.txt — so a conflict in any of those was silently auto-resolved
    // toward nv-main, dropping the sibling's content. That is the exact class of
    // regression this abort exists to catch, so the leak disabled the guard.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-ignore-'));
    try {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'c', 'work-unowned');
      fs.writeFileSync(path.join(repo, '.gitignore'), 'groups/\n');

      const res = runMergeTrain(repo, 'nv-main');
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/owned set/);
      // The sibling's content survived; nothing was resolved toward nv-main.
      expect(fs.readFileSync(path.join(repo, 'groups', 'main', 'notes.txt'), 'utf-8')).toBe('WORK\n');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('is a no-op when the branch is already merged (idempotent)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-idem-'));
    try {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'c', 'nv-main'); // HEAD already == nv-main
      const res = runMergeTrain(repo, 'nv-main');
      expect(res.status).toBe(0);
      expect(res.stdout).toMatch(/already merged/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rolls back the merge and fails when the composed tree does not build', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-rollback-'));
    try {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'c', 'work-owned');
      const before = git(repo, 'rev-parse', 'HEAD').trim();
      // MERGE_TRAIN_FAIL_VALIDATE=1 simulates the post-merge build failing (as
      // when is_owned drops an overlay's edits, leaving a non-building tree).
      const res = spawnSync('bash', [MERGE_TRAIN, 'nv-main'], {
        cwd: repo,
        encoding: 'utf-8',
        env: { ...ENV, MERGE_TRAIN_FAIL_VALIDATE: '1' },
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/rolling back/);
      // Fully rolled back — no broken merge commit left for a re-run to skip.
      expect(git(repo, 'rev-parse', 'HEAD').trim()).toBe(before);
      expect(git(repo, 'status', '--porcelain', '--untracked-files=no').trim()).toBe('');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
