/**
 * Behavioral tests for setup.sh's compose_fork() — the fork-bootstrap step that
 * merges nv-main on a fork clone. Run under host vitest so the shell logic is
 * CI-protected. Each case copies the REAL setup.sh into a synthetic repo (so its
 * self-derived PROJECT_ROOT points at the throwaway clone, and the re-exec finds
 * a setup.sh), then runs it with NANOCLAW_COMPOSE_ONLY=1 to stop after
 * composition without the pnpm install/build tail.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SETUP_SH = path.resolve(HERE, '..', 'setup.sh');

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
  NANOCLAW_COMPOSE_ONLY: '1',
};

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}

/** Seed a bare origin (base → nv-main + work branches); setup.sh is committed so
 *  the clone has it and compose_fork's re-exec target exists. */
function buildOrigin(root: string, withNvMain = true): string {
  const seed = path.join(root, withNvMain ? 'seed' : 'vseed');
  fs.mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'base', '.');
  fs.mkdirSync(path.join(seed, 'src'));
  fs.mkdirSync(path.join(seed, 'groups', 'main'), { recursive: true });
  fs.writeFileSync(path.join(seed, 'src', 'foo.ts'), 'base\n');
  fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'base\n');
  fs.writeFileSync(
    path.join(seed, 'package.json'),
    JSON.stringify({ dependencies: { a: '1.0.0', z: '1.0.0' } }, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(seed, 'pnpm-lock.yaml'), 'lock: base\n');
  fs.copyFileSync(SETUP_SH, path.join(seed, 'setup.sh'));
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'base');

  if (withNvMain) {
    git(seed, 'branch', 'nv-main');
    git(seed, 'branch', 'work-owned');
    git(seed, 'branch', 'work-unowned');
    git(seed, 'branch', 'work-deps');
    git(seed, 'checkout', '-q', 'nv-main');
    // Ownership comes from nv-main's path-guard allowlist (the same file
    // .github/nv-path-guard/check.py enforces), evaluated by nv-main's own
    // matcher — BOTH taken from origin/nv-main: src/** + shared config are
    // owned, groups/** is not. The matcher has to be committed here because
    // compose_fork extracts it from the ref rather than reading the worktree.
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
    git(seed, 'commit', '-qam', 'nv-main');
    git(seed, 'checkout', '-q', 'work-owned');
    fs.writeFileSync(path.join(seed, 'src', 'foo.ts'), 'WORK\n');
    git(seed, 'commit', '-qam', 'owned');
    git(seed, 'checkout', '-q', 'work-unowned');
    fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'WORK\n');
    git(seed, 'commit', '-qam', 'unowned');
    // work-deps adds a dep nv-main lacks — package.json auto-merges to a state
    // inconsistent with nv-main's lockfile.
    git(seed, 'checkout', '-q', 'work-deps');
    fs.writeFileSync(
      path.join(seed, 'package.json'),
      JSON.stringify({ dependencies: { a: '1.0.0', extra: '9.9.9', z: '1.0.0' } }, null, 2) + '\n',
    );
    git(seed, 'commit', '-qam', 'work adds a dep');
    git(seed, 'checkout', '-q', 'base');
  }
  const origin = path.join(root, withNvMain ? 'origin.git' : 'vanilla.git');
  git(root, 'clone', '-q', '--bare', seed, origin);
  return origin;
}

function cloneOn(root: string, origin: string, branch: string): string {
  const dir = path.join(root, 'clone');
  git(root, 'clone', '-q', origin, dir);
  git(dir, 'config', 'user.name', 't');
  git(dir, 'config', 'user.email', 't@t');
  git(dir, 'checkout', '-q', branch);
  return dir;
}

function runSetup(repo: string) {
  return spawnSync('bash', [path.join(repo, 'setup.sh')], { cwd: repo, encoding: 'utf-8', env: ENV });
}

function withRepo(prefix: string, fn: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('setup.sh compose_fork', () => {
  it('is a no-op on a stock clone (no nv-main on origin)', () => {
    withRepo('cf-vanilla-', (root) => {
      const origin = buildOrigin(root, false);
      const repo = cloneOn(root, origin, 'base');
      const before = git(repo, 'rev-parse', 'HEAD').trim();
      const res = runSetup(repo);
      expect(res.status).toBe(0);
      expect(git(repo, 'rev-parse', 'HEAD').trim()).toBe(before); // nothing merged
    });
  });

  it('skips when nv-main is already merged (idempotent)', () => {
    withRepo('cf-idem-', (root) => {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'nv-main'); // HEAD already == nv-main
      const before = git(repo, 'rev-parse', 'HEAD').trim();
      const res = runSetup(repo);
      expect(res.status).toBe(0);
      expect(git(repo, 'rev-parse', 'HEAD').trim()).toBe(before);
    });
  });

  it('pins package.json + pnpm-lock.yaml to nv-main when package.json auto-merges', () => {
    withRepo('cf-pin-', (root) => {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'work-deps'); // adds a dep nv-main lacks
      const res = runSetup(repo);
      expect(res.status).toBe(0);
      // Both dep files match nv-main exactly → frozen install would be consistent.
      const diff = spawnSync('git', ['diff', 'origin/nv-main', '--', 'package.json', 'pnpm-lock.yaml'], {
        cwd: repo,
        encoding: 'utf-8',
        env: ENV,
      });
      expect(diff.stdout.trim()).toBe('');
      expect(fs.readFileSync(path.join(repo, 'pnpm-lock.yaml'), 'utf-8')).toBe('lock: nv-main\n');
    });
  });

  it('merges nv-main and resolves an OWNED conflict to nv-main on a fork clone', () => {
    withRepo('cf-owned-', (root) => {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'work-owned');
      const res = runSetup(repo);
      expect(res.status).toBe(0);
      expect(fs.readFileSync(path.join(repo, 'src', 'foo.ts'), 'utf-8')).toBe('MAIN\n');
      // nv-main is now an ancestor of HEAD (the merge landed).
      const anc = spawnSync('git', ['merge-base', '--is-ancestor', 'origin/nv-main', 'HEAD'], {
        cwd: repo,
        env: ENV,
      });
      expect(anc.status).toBe(0);
    });
  });

  it('aborts on an UNOWNED conflict (exit 1, clean tree)', () => {
    withRepo('cf-unowned-', (root) => {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'work-unowned');
      const res = runSetup(repo);
      expect(res.status).toBe(1);
      // Merge fully aborted: no staged/modified tracked files (ignore the
      // untracked logs/ dir setup.sh creates for its own bootstrap log).
      expect(git(repo, 'status', '--porcelain', '--untracked-files=no').trim()).toBe('');
      expect(res.stderr).toMatch(/owned set/);
    });
  });

  it('an ambient .gitignore cannot make compose_fork overwrite an unowned file', () => {
    // compose_fork used to answer this with `git check-ignore` run IN THIS REPO,
    // so the repo's own .gitignore contributed patterns. The real nanoclaw
    // .gitignore contains `groups/*`, `data/`, `logs/`, `coworkers/*.yaml` and
    // `repos/` — none of them in nv-main.txt — so nv-main "owned" a user's group
    // config and setup.sh would resolve the conflict by overwriting it.
    // One line here reproduces that; the shared matcher sees the allowlist only.
    withRepo('cf-ignore-', (root) => {
      const origin = buildOrigin(root);
      const repo = cloneOn(root, origin, 'work-unowned');
      fs.writeFileSync(path.join(repo, '.gitignore'), 'groups/\n');

      const res = runSetup(repo);
      // Still refuses: groups/** is not nv-main's, whatever .gitignore says.
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/owned set/);
      // And the user's file was NOT overwritten with nv-main's copy.
      expect(fs.readFileSync(path.join(repo, 'groups', 'main', 'notes.txt'), 'utf-8')).toBe('WORK\n');
    });
  });
});
