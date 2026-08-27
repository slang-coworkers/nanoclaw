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
/** The shared matcher the script (and CI's path-guard) resolve ownership with. */
const MATCHER = path.join(HERE, '..', '.github', 'nv-path-guard', 'ownership.py');
/** A matcher that answers "nothing is owned" — what a tampered tree would supply. */
const NEUTERED_MATCHER = '#!/usr/bin/env python3\nimport sys\nsys.exit(0)\n';

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
  // The matcher is TRACKED, and identical on every branch to start with. The
  // script extracts it from the trusted ref rather than the worktree, so the
  // fixture has to give the ref something to extract — and having it on `base`
  // means it is not itself a diff between nv-main and the overlay until a test
  // deliberately tampers with it.
  fs.mkdirSync(path.join(seed, '.github', 'nv-path-guard'), { recursive: true });
  fs.copyFileSync(MATCHER, path.join(seed, '.github', 'nv-path-guard', 'ownership.py'));
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'base');
  git(seed, 'branch', 'nv-main');
  git(seed, 'branch', 'overlay');

  // nv-main owns src/** + .github/** per its own path-guard allowlist, which is
  // the single source of truth the script reads (from the ref, not the worktree).
  git(seed, 'checkout', '-q', 'nv-main');
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
  // Left untracked on purpose: it survives the branch switches below and never
  // shows up in `git diff <ref> HEAD` as a candidate path. The MATCHER is not
  // copied here — it is tracked in the fixture, because the script now takes it
  // from the ref and a test needs to be able to tamper with the worktree copy.
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

  it('names the exact commit it compared against', () => {
    // `origin/nv-main` moves. Printing only the ref name leaves the reader
    // unable to tell which tree produced the verdict.
    withRepo('nv-main', (dir) => {
      const sha = git(dir, 'rev-parse', 'origin/nv-main').trim();
      expect(run(dir).stdout).toContain(sha);
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

  it('exits 2 on bad usage', () => {
    withRepo('overlay', (dir) => {
      expect(run(dir, '--bogus').status).toBe(2);
      expect(run(dir, '--ref').status).toBe(2);
    });
  });
});

/**
 * Fail-closed cases. A verify-only safety check that exits 0 when it could not
 * run is worse than no check at all — callers read the 0 as "nothing drifted".
 * Each case removes one input the check needs and asserts it refuses to answer.
 */
describe('scripts/check-nv-owned-drift.sh — fails closed on missing inputs', () => {
  it('exits 2 when the ref is unavailable instead of reporting green', () => {
    withRepo('overlay', (dir) => {
      const r = run(dir, '--ref', 'origin/no-such-branch');
      expect(r.status).toBe(2);
      expect(r.stdout + r.stderr).toContain('nothing to compare against');
    });
  });

  it('exits 2 when the ref carries no ownership allowlist', () => {
    withRepo('overlay', (dir) => {
      // Rewrite origin/nv-main without the allowlist: ownership is now
      // undeterminable, so every path would be judged unowned and the check
      // would print an unearned "ok".
      git(dir, 'checkout', '-q', '-B', 'tmp-nv-main', 'origin/nv-main');
      git(dir, 'rm', '-q', '-f', '.github/nv-path-guard/nv-main.txt');
      git(dir, 'commit', '-qm', 'drop allowlist');
      git(dir, 'update-ref', 'refs/remotes/origin/nv-main', 'HEAD');
      git(dir, 'checkout', '-q', 'overlay');

      const r = run(dir);
      expect(r.status).toBe(2);
      expect(r.stdout + r.stderr).toContain('ownership is undeterminable');
    });
  });

  it('exits 2 when the ownership allowlist is empty', () => {
    withRepo('overlay', (dir) => {
      // Comments-only is the same thing as empty: nv-main would own nothing and
      // every comparison would trivially pass.
      git(dir, 'checkout', '-q', '-B', 'tmp-nv-main', 'origin/nv-main');
      fs.writeFileSync(path.join(dir, '.github', 'nv-path-guard', 'nv-main.txt'), '# owned by nv-main\n\n');
      // Targeted add: `-A` would track the untracked helper copies, and switching
      // back to overlay would then delete them out of the worktree.
      git(dir, 'add', '--', '.github/nv-path-guard/nv-main.txt');
      git(dir, 'commit', '-qm', 'empty allowlist');
      git(dir, 'update-ref', 'refs/remotes/origin/nv-main', 'HEAD');
      git(dir, 'checkout', '-q', 'overlay');

      const r = run(dir);
      expect(r.status).toBe(2);
      expect(r.stdout + r.stderr).toContain('no patterns');
    });
  });
});

/**
 * The verifier must not be able to greenwash itself.
 *
 * It used to load `.github/nv-path-guard/ownership.py` from the CURRENT
 * worktree — the tree it is judging — while excluding all of
 * `.github/nv-path-guard/*` from the candidate list. So a stale or tampered
 * matcher could answer "nothing is owned", the check would print `ok`, and the
 * edit that caused it was never reported either. Both halves are fixed here:
 * the matcher comes from the pinned trusted commit, and only `*.txt` ownership
 * DATA is exempt from drift reporting.
 */
describe('scripts/check-nv-owned-drift.sh — the matcher comes from the trusted ref', () => {
  /** Commit a matcher that reports nothing as owned, onto the branch under test. */
  function neuterWorktreeMatcher(dir: string): void {
    fs.writeFileSync(path.join(dir, '.github', 'nv-path-guard', 'ownership.py'), NEUTERED_MATCHER);
    git(dir, 'add', '--', '.github/nv-path-guard/ownership.py');
    git(dir, 'commit', '-qm', 'neuter the matcher');
  }

  it('still finds real drift when the worktree matcher is neutered', () => {
    withRepo('overlay', (dir) => {
      neuterWorktreeMatcher(dir);
      const r = run(dir);
      const out = r.stdout + r.stderr;
      // Before the fix this printed "ok: no nv-main-owned file differs" and
      // exited 0 — a green produced by the tree being checked.
      expect(r.status).toBe(1);
      expect(out).toContain('src/owned.ts');
    });
  });

  it('reports the tampered matcher as drift in its own right', () => {
    withRepo('overlay', (dir) => {
      neuterWorktreeMatcher(dir);
      expect(run(dir).stdout + run(dir).stderr).toContain('.github/nv-path-guard/ownership.py');
    });
  });

  it('exits 2 when the ref carries no matcher, rather than falling back to the worktree', () => {
    withRepo('overlay', (dir) => {
      git(dir, 'checkout', '-q', '-B', 'tmp-nv-main', 'origin/nv-main');
      git(dir, 'rm', '-q', '-f', '.github/nv-path-guard/ownership.py');
      git(dir, 'commit', '-qm', 'drop matcher');
      git(dir, 'update-ref', 'refs/remotes/origin/nv-main', 'HEAD');
      git(dir, 'checkout', '-q', 'overlay');

      const r = run(dir);
      expect(r.status).toBe(2);
      expect(r.stdout + r.stderr).toContain('no trusted matcher');
    });
  });

  it('exempts only *.txt ownership data, not the executables beside it', () => {
    withRepo('overlay', (dir) => {
      // A check.py that differs from the ref is a stale copy of the CI guard —
      // exactly the silent-revert class this tool exists to surface.
      fs.writeFileSync(path.join(dir, '.github', 'nv-path-guard', 'check.py'), '# stale\n');
      git(dir, 'add', '--', '.github/nv-path-guard/check.py');
      git(dir, 'commit', '-qm', 'stale check.py');
      // Give the ref a copy so the "exists on the ref" test can classify it.
      git(dir, 'checkout', '-q', '-B', 'tmp-nv-main', 'origin/nv-main');
      fs.writeFileSync(path.join(dir, '.github', 'nv-path-guard', 'check.py'), '# canonical\n');
      git(dir, 'add', '--', '.github/nv-path-guard/check.py');
      git(dir, 'commit', '-qm', 'canonical check.py');
      git(dir, 'update-ref', 'refs/remotes/origin/nv-main', 'HEAD');
      git(dir, 'checkout', '-q', 'overlay');

      const out = run(dir).stdout + run(dir).stderr;
      expect(out).toContain('.github/nv-path-guard/check.py');
      // …while the branch-specific allowlist DATA is still exempt.
      expect(out).not.toContain('nv-path-guard/nv-main.txt');
    });
  });
});

describe('scripts/check-nv-owned-drift.sh — ownership comes only from the allowlist', () => {
  it('does not call a path owned because an ambient .gitignore matches it', () => {
    withRepo('overlay', (dir) => {
      // groups/** is absent from nv-main.txt, so nv-main does not own it, and
      // CI's path-guard (the same matcher over the allowlist alone) agrees. The
      // original matcher ran `git -c core.excludesFile=<allowlist> check-ignore`
      // IN THIS REPO, which ALSO consults its .gitignore — so this one line was
      // enough to classify an unowned overlay file as nv-main-owned drift,
      // giving the verifier a broader owned set than CI's from the same source
      // of truth. Running git in an empty isolated repo removes the leak without
      // removing git.
      fs.writeFileSync(path.join(dir, '.gitignore'), 'groups/\n');

      const r = run(dir);
      const out = r.stdout + r.stderr;
      expect(out).not.toContain('groups/main/notes.txt');
      // …and the check has not gone blind: the real silent revert still fires.
      expect(r.status).toBe(1);
      expect(out).toContain('src/owned.ts');
    });
  });

  it('ignores .git/info/exclude too', () => {
    withRepo('overlay', (dir) => {
      // The other ambient source the old `check-ignore` call consulted. Per-clone
      // and untracked, so it differed developer to developer — the drift check
      // could disagree with CI *and* with the next machine that ran it.
      fs.writeFileSync(path.join(dir, '.git', 'info', 'exclude'), 'groups/**\n');

      const r = run(dir);
      expect(r.stdout + r.stderr).not.toContain('groups/main/notes.txt');
      expect(r.status).toBe(1);
    });
  });

  it('ignores the user’s global core.excludesFile', () => {
    withRepo('overlay', (dir) => {
      // The third ambient source, and the least visible: per-user config that
      // never appears in review and differs on every machine.
      const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-drift-home-'));
      try {
        fs.writeFileSync(path.join(home, 'global-excludes'), 'groups/**\n');
        fs.writeFileSync(
          path.join(home, '.gitconfig'),
          `[core]\n\texcludesFile = ${path.join(home, 'global-excludes')}\n`,
        );
        const r = spawnSync('bash', [path.join(dir, 'scripts', 'check-nv-owned-drift.sh')], {
          cwd: dir,
          encoding: 'utf-8',
          env: { ...ENV, HOME: home, XDG_CONFIG_HOME: home },
        });
        expect(r.stdout + r.stderr).not.toContain('groups/main/notes.txt');
        expect(r.status).toBe(1);
      } finally {
        fs.rmSync(home, { recursive: true, force: true });
      }
    });
  });
});
