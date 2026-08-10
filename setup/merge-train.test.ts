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
  // is_owned() derives the owned set from nv-main's path-guard allowlist (the
  // same file .github/nv-path-guard/check.py enforces), matched with git's own
  // gitignore engine. src/** + the shared config are owned; groups/** is not.
  fs.mkdirSync(path.join(seed, '.github', 'nv-path-guard'), { recursive: true });
  fs.writeFileSync(
    path.join(seed, '.github', 'nv-path-guard', 'nv-main.txt'),
    '.github/**\nsrc/**\npackage.json\npnpm-lock.yaml\n',
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
