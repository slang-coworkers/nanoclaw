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

/**
 * A two-region file whose region A (line 1) and region B (line 5) are far enough
 * apart to MERGE CLEANLY when two branches each change a different region — the
 * canonical way a stale base silently contaminates an auto-merged file.
 */
function twoRegion(a: string, b: string): string {
  return [`A: ${a}`, 'ctx1', 'ctx2', 'ctx3', `B: ${b}`, ''].join('\n');
}

/**
 * Build a bare origin modeling a PROD UPDATE off a deeply-stale base — the case
 * --reconcile-stale exists for. Branches off a shared `root`:
 *
 *   nv-main    — owns src/**, scripts/**, setup/**, container/agent-runner/**,
 *                .github/**, package.json, pnpm-lock.yaml (its path-guard
 *                allowlist). Adds getShutdownCallbacks to the owned
 *                src/response-registry.ts; bumps the manifest. dashboard/** is
 *                deliberately NOT owned.
 *   nv-overlay — a STALE overlay: keeps the pre-upgrade region of
 *                response-registry (so the auto-merge contaminates it), ADDS an
 *                adapter (src/channels/dashboard.ts, absent on nv-main), ADDS a
 *                dead module nv-main removed (src/host-lifecycle.ts + test), and
 *                carries the real cost-dashboard frontend (dashboard/public/app.js).
 *   base       — the stale prod HEAD we run on: ADDS an orphan test on no branch
 *                (src/legacy.test.ts) and changes region A of app.js, so the
 *                overlay merge produces a Frankenstein app.js.
 *
 * Nothing conflicts (every divergence is in a distinct region or a new file), so
 * the merges complete and the reconcile step is what the assertions probe.
 */
function buildStaleOrigin(root: string): string {
  const seed = path.join(root, 'seed');
  fs.mkdirSync(seed);
  git(seed, 'init', '-q', '-b', 'base', '.');
  const w = (rel: string, body: string) => {
    const abs = path.join(seed, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  };

  // root (the shared merge-base)
  w('src/response-registry.ts', twoRegion('none', 'tail0'));
  w('src/keep.ts', 'keep\n');
  w('dashboard/public/app.js', twoRegion('0', '0'));
  w('package.json', JSON.stringify({ dependencies: { a: '1.0.0' } }, null, 2) + '\n');
  w('pnpm-lock.yaml', 'lock: base\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qm', 'root');
  git(seed, 'branch', 'nv-main');
  git(seed, 'branch', 'nv-overlay');

  // nv-main: the canonical infra. Ownership comes from nv-main's own allowlist +
  // matcher, both read from origin/nv-main by the script.
  git(seed, 'checkout', '-q', 'nv-main');
  w(
    '.github/nv-path-guard/nv-main.txt',
    '.github/**\nsrc/**\nscripts/**\nsetup/**\ncontainer/agent-runner/**\npackage.json\npnpm-lock.yaml\n',
  );
  fs.copyFileSync(
    path.join(HERE, '..', '.github', 'nv-path-guard', 'ownership.py'),
    path.join(seed, '.github', 'nv-path-guard', 'ownership.py'),
  );
  w('src/response-registry.ts', twoRegion('getShutdownCallbacks', 'tail0'));
  w('package.json', JSON.stringify({ dependencies: { a: '2.0.0' } }, null, 2) + '\n');
  w('pnpm-lock.yaml', 'lock: nv-main\n');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qam', 'nv-main: getShutdownCallbacks + manifest');

  // nv-overlay: stale copy of the owned file (contaminates the auto-merge), plus
  // an added adapter, an added dead module, and the authoritative frontend.
  git(seed, 'checkout', '-q', 'nv-overlay');
  w('src/response-registry.ts', twoRegion('none', 'tailOVERLAY'));
  w('src/channels/dashboard.ts', 'adapter\n');
  w('src/host-lifecycle.ts', 'export const dead = 1;\n');
  w('src/host-lifecycle.test.ts', 'test dead\n');
  w('dashboard/public/app.js', twoRegion('0', '1'));
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qam', 'nv-overlay: stale infra + adapter + dead module + frontend');

  // base: the deeply-stale prod HEAD. An orphan test on no branch and a
  // region-A edit to app.js that contaminates the overlay merge.
  git(seed, 'checkout', '-q', 'base');
  w('src/legacy.test.ts', 'legacy orphan\n');
  w('dashboard/public/app.js', twoRegion('1', '0'));
  git(seed, 'add', '-A');
  git(seed, 'commit', '-qam', 'stale base drift');

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

/** Run the merge train with an explicit argv (flags + branches, in order). */
function runMergeTrainArgs(cwd: string, args: string[]) {
  return spawnSync('bash', [MERGE_TRAIN, ...args], { cwd, encoding: 'utf-8', env: ENV });
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

/**
 * --reconcile-stale: the opt-in PROD-UPDATE reconciliation. These build a base
 * that is deeply stale relative to nv-main + an overlay, run the train with the
 * flag, and assert each reconcile class. A companion block runs the SAME origin
 * WITHOUT the flag and asserts the reconcile classes are NOT applied — that is
 * the gate proof: /setup (no flag) keeps its behavior unchanged.
 */
describe('merge-train.sh --reconcile-stale (prod update)', () => {
  function reconcile(): { root: string; repo: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-reconcile-'));
    const origin = buildStaleOrigin(root);
    const repo = cloneOn(root, origin, 'c', 'base');
    return { root, repo };
  }

  it('restores a downgraded OWNED file, drops a base-only stale test + dead module, keeps the overlay adapter, and takes app.js from the overlay', () => {
    const { root, repo } = reconcile();
    try {
      const res = runMergeTrainArgs(repo, ['--reconcile-stale', 'nv-main', 'nv-overlay']);
      expect(res.status, res.stderr).toBe(0);

      // Downgrade restored: the owned file is byte-identical to nv-main again
      // (the overlay's stale region is gone).
      const registry = fs.readFileSync(path.join(repo, 'src', 'response-registry.ts'), 'utf-8');
      expect(registry).toBe(git(repo, 'show', 'origin/nv-main:src/response-registry.ts'));
      expect(registry).toContain('getShutdownCallbacks');
      expect(registry).not.toContain('tailOVERLAY');

      // Base-only stale test (on no composing branch) removed.
      expect(fs.existsSync(path.join(repo, 'src', 'legacy.test.ts'))).toBe(false);

      // nv-main-deleted dead module + its test removed (nothing imports it).
      expect(fs.existsSync(path.join(repo, 'src', 'host-lifecycle.ts'))).toBe(false);
      expect(fs.existsSync(path.join(repo, 'src', 'host-lifecycle.test.ts'))).toBe(false);

      // Overlay-ADDED adapter (absent on nv-main) survives the blanket checkout.
      expect(fs.readFileSync(path.join(repo, 'src', 'channels', 'dashboard.ts'), 'utf-8')).toBe('adapter\n');

      // app.js forced to the overlay's authoritative copy, not the contaminated
      // auto-merge — region A came back from the overlay (0), not the base (1).
      expect(fs.readFileSync(path.join(repo, 'dashboard', 'public', 'app.js'), 'utf-8')).toBe(twoRegion('0', '1'));

      // A tracked, committed tree — no dangling stage from the reconcile.
      expect(git(repo, 'status', '--porcelain', '--untracked-files=no').trim()).toBe('');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('is idempotent — a second --reconcile-stale run makes no further change', () => {
    const { root, repo } = reconcile();
    try {
      expect(runMergeTrainArgs(repo, ['--reconcile-stale', 'nv-main', 'nv-overlay']).status).toBe(0);
      const head = git(repo, 'rev-parse', 'HEAD').trim();
      // Branches are now ancestors → nothing merges → reconcile does not run and
      // HEAD is unmoved.
      const res2 = runMergeTrainArgs(repo, ['--reconcile-stale', 'nv-main', 'nv-overlay']);
      expect(res2.status).toBe(0);
      expect(res2.stdout).toMatch(/already merged|nothing to merge/);
      expect(git(repo, 'rev-parse', 'HEAD').trim()).toBe(head);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('WITHOUT the flag leaves the stale drift in place (the /setup path is unchanged)', () => {
    const { root, repo } = reconcile();
    try {
      const res = runMergeTrainArgs(repo, ['nv-main', 'nv-overlay']);
      expect(res.status, res.stderr).toBe(0);

      // The reconcile classes are NOT applied: the orphan test and dead module
      // stay, and app.js keeps the contaminated auto-merge (region A from base).
      expect(fs.existsSync(path.join(repo, 'src', 'legacy.test.ts'))).toBe(true);
      expect(fs.existsSync(path.join(repo, 'src', 'host-lifecycle.ts'))).toBe(true);
      expect(fs.readFileSync(path.join(repo, 'dashboard', 'public', 'app.js'), 'utf-8')).toBe(twoRegion('1', '1'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The validation tail cannot be exercised by the tests above: they all set
 * MERGE_TRAIN_NO_INSTALL=1, which returns before it, and running it for real
 * needs the full Node toolchain plus a GitHub token. So pin its SHAPE — that is
 * honestly less than executing it, and it is what caught the gap in the first
 * place. CI ran fetch-skills + validate:templates; this path ran neither, and
 * the two silently disagreed about what a deployable tree is.
 */
describe('merge-train.sh validation tail', () => {
  const raw = fs.readFileSync(MERGE_TRAIN, 'utf-8');
  // COMMENTS STRIPPED FIRST. The first version of these tests sliced the raw
  // file between `fetch-skills.sh` and `validate:templates` — and both strings
  // appear in the comment block ABOVE the code explaining the design, so the
  // slice covered prose and nothing else. It passed happily while the fetch was
  // made fatal. A structural test that reads its own documentation instead of
  // its subject is worse than no test.
  const sh = raw
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');

  it('validates templates, so a tree with unresolvable coworkers cannot pass', () => {
    expect(sh).toContain('pnpm run validate:templates');
  });

  it('fetches external skills before validating them', () => {
    expect(sh.indexOf('fetch-skills.sh')).toBeGreaterThan(-1);
    expect(sh.indexOf('fetch-skills.sh')).toBeLessThan(sh.indexOf('pnpm run validate:templates'));
  });

  it('treats a failed FETCH as soft and a failed VALIDATION as fatal', () => {
    // The split is the point. `gh` throttling is transient and common; rolling
    // back a five-branch merge over a rate limit would be a self-inflicted
    // outage. But the cached skills are only good enough if every coworker type
    // still resolves — which is the question validate:templates answers. If
    // this inverts, a throttled deploy either dies needlessly or ships blind.
    const fetchBlock = sh.slice(sh.indexOf('scripts/fetch-skills.sh'), sh.indexOf('validate:templates'));
    expect(fetchBlock, 'a throttled fetch must not roll back').not.toContain('rollback_and_fail');

    const validateBlock = sh.slice(sh.indexOf('if ! pnpm run validate:templates'));
    expect(validateBlock.slice(0, 400), 'unresolvable templates must roll back').toContain('rollback_and_fail');
  });

  it('runs the runtime-deps gate before the build', () => {
    const chain = sh.match(/if ! \(pnpm install --frozen-lockfile[\s\S]*?\); then/)?.[0] ?? '';
    expect(chain).not.toBe('');
    expect(chain).toContain('check:runtime-deps');
    expect(chain.indexOf('check:runtime-deps')).toBeLessThan(chain.indexOf('pnpm run build'));
  });
});
