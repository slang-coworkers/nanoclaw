/**
 * Behavioral tests for scripts/check-nv-owned-drift.sh, run under the host
 * vitest suite so the shell logic is CI-protected (the script is not otherwise
 * covered by typecheck/lint) — same rationale as merge-train.test.ts.
 *
 * The script is verify-only: it must never modify the tree, and it must exit
 * non-zero when a nv-main-owned file has silently diverged. Each case builds a
 * throwaway git repo with a bare "origin".
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'check-nv-owned-drift.sh');

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

/**
 * base → nv-main (evolves an OWNED src file) and an overlay branch that carries
 * a STALE copy of it plus its own unowned + overlay-new-owned files. This is the
 * silent-revert shape: the overlay's stale copy differs from nv-main but never
 * textually conflicted, so no merge step would have flagged it.
 */
function buildOrigin(root: string): string {
  const seed = path.join(root, 'seed');
  fs.mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'base', '.');
  fs.mkdirSync(path.join(seed, 'src'));
  fs.mkdirSync(path.join(seed, 'groups', 'main'), { recursive: true });
  fs.writeFileSync(path.join(seed, 'src', 'owned.ts'), 'base\n');
  fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'base\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'base');
  git(seed, 'branch', 'nv-main');
  git(seed, 'branch', 'overlay');

  // nv-main owns src/** + .github/** per its own path-guard allowlist, which is
  // the single source of truth the script reads (from the ref, not the worktree).
  git(seed, 'checkout', '-q', 'nv-main');
  fs.mkdirSync(path.join(seed, '.github', 'nv-path-guard'), { recursive: true });
  fs.writeFileSync(
    path.join(seed, '.github', 'nv-path-guard', 'nv-main.txt'),
    '# owned by nv-main\n.github/**\nsrc/**\n',
  );
  fs.writeFileSync(path.join(seed, 'src', 'owned.ts'), 'MAIN-EVOLVED\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'nv-main evolves an owned file');

  // The overlay keeps the stale 'base' copy of src/owned.ts, edits an UNOWNED
  // file, and adds an owned file that does NOT exist on nv-main (its own code —
  // must be left alone, not reported as drift).
  git(seed, 'checkout', '-q', 'overlay');
  fs.writeFileSync(path.join(seed, 'groups', 'main', 'notes.txt'), 'OVERLAY\n');
  fs.writeFileSync(path.join(seed, 'src', 'overlay-only.ts'), 'overlay\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'overlay changes');

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
  // The script needs to resolve origin/nv-main; a plain clone of a bare repo
  // already has it, but be explicit so the fixture doesn't depend on that.
  git(dir, 'fetch', '-q', 'origin', 'nv-main:refs/remotes/origin/nv-main');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts', 'check-nv-owned-drift.sh'));
  return dir;
}

function run(cwd: string, ...args: string[]) {
  return spawnSync('bash', [path.join(cwd, 'scripts', 'check-nv-owned-drift.sh'), ...args], {
    cwd,
    encoding: 'utf-8',
    env: ENV,
  });
}

function withRepo(branch: string, fn: (dir: string) => void): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-drift-'));
  try {
    const origin = buildOrigin(root);
    fn(cloneOn(root, origin, 'work', branch));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('scripts/check-nv-owned-drift.sh', () => {
  it('is clean on nv-main itself', () => {
    withRepo('nv-main', (dir) => {
      const r = run(dir);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('no nv-main-owned file differs');
    });
  });

  it('reports an owned file the overlay silently reverted, and exits 1', () => {
    withRepo('overlay', (dir) => {
      const r = run(dir);
      expect(r.status).toBe(1);
      // The stale copy is the drift.
      expect(r.stdout + r.stderr).toContain('src/owned.ts');
      // Guidance names the restore command rather than performing it.
      expect(r.stdout + r.stderr).toContain('git checkout origin/nv-main -- <file>');
    });
  });

  it('ignores unowned files and overlay-new owned files', () => {
    withRepo('overlay', (dir) => {
      const out = run(dir).stdout + run(dir).stderr;
      // groups/** is not in the allowlist; src/overlay-only.ts is owned but
      // absent on nv-main, so neither is a silent revert.
      expect(out).not.toContain('groups/main/notes.txt');
      expect(out).not.toContain('src/overlay-only.ts');
    });
  });

  it('does not report the path-guard allowlists themselves', () => {
    // They are ownership metadata: each branch carries its own, and nv-main's
    // evolves as it absorbs upstream paths. Reporting that as drift would fire
    // on every overlay and drown the findings that matter.
    withRepo('overlay', (dir) => {
      const r = run(dir);
      expect(r.stdout + r.stderr).not.toContain('nv-path-guard/nv-main.txt');
    });
  });

  it('never modifies the tree', () => {
    withRepo('overlay', (dir) => {
      const before = git(dir, 'status', '--porcelain');
      const head = git(dir, 'rev-parse', 'HEAD');
      run(dir);
      expect(git(dir, 'status', '--porcelain')).toBe(before);
      expect(git(dir, 'rev-parse', 'HEAD')).toBe(head);
      // The stale content is still there — the script reports, never restores.
      expect(fs.readFileSync(path.join(dir, 'src', 'owned.ts'), 'utf-8')).toBe('base\n');
    });
  });

  it('--allow marks a deliberate local mod and goes green', () => {
    withRepo('overlay', (dir) => {
      const r = run(dir, '--allow', 'src/owned.ts');
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('Allowlisted local mods');
      expect(r.stdout).toContain('src/owned.ts');
    });
  });

  it('honours NV_DRIFT_ALLOW from the environment', () => {
    withRepo('overlay', (dir) => {
      const r = spawnSync('bash', [path.join(dir, 'scripts', 'check-nv-owned-drift.sh')], {
        cwd: dir,
        encoding: 'utf-8',
        env: { ...ENV, NV_DRIFT_ALLOW: 'src/owned.ts' },
      });
      expect(r.status).toBe(0);
    });
  });

  it('exits 0 with a message when the ref is unavailable', () => {
    withRepo('overlay', (dir) => {
      const r = run(dir, '--ref', 'origin/no-such-branch');
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('not available locally');
    });
  });

  it('exits 2 on bad usage', () => {
    withRepo('overlay', (dir) => {
      expect(run(dir, '--bogus').status).toBe(2);
      expect(run(dir, '--ref').status).toBe(2);
    });
  });
});
