/**
 * Contract tests for scripts/check-runtime-resolvable.mjs.
 *
 * The point of this gate is to catch a dependency that LOOKS fine. So the only
 * thing worth testing is that it goes red in each of the ways a dependency can
 * be broken, and that it names the right cause — a gate that fails with the
 * wrong diagnosis sends someone to edit the wrong branch, which is worse than
 * no gate at all.
 *
 * Each case builds a throwaway checkout with a hand-made node_modules, drops in
 * a copy of the real script with a rewritten REQUIRED list, and runs it. Nothing
 * is mocked: the script's own resolver logic is what executes.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(repoRoot, 'scripts', 'check-runtime-resolvable.mjs');

let sandbox: string;

beforeAll(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-resolvable-'));
});
afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

interface Case {
  /** files to create, relative to the fake checkout root */
  files?: Record<string, string>;
  /** symlinks to create: link path -> target (may be nonexistent, for dangling) */
  links?: Record<string, string>;
  specifier: string;
  smoke?: string[];
}

/** Build an isolated fake checkout and run the real script inside it. */
function run(name: string, c: Case): { status: number; out: string } {
  const root = path.join(sandbox, name);
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });

  for (const [rel, body] of Object.entries(c.files ?? {})) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  for (const [rel, target] of Object.entries(c.links ?? {})) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.symlinkSync(target, p);
  }

  // The real script, with only its REQUIRED list swapped for this case.
  const src = fs.readFileSync(SCRIPT, 'utf8');
  const entry =
    `{ specifier: ${JSON.stringify(c.specifier)}, why: 'test', ` +
    (c.smoke ? `smoke: ${JSON.stringify(c.smoke)} }` : '}');
  const patched = src.replace(
    /const REQUIRED = \[[\s\S]*?\n\];/,
    `const REQUIRED = [\n  ${entry},\n];`,
  );
  expect(patched, 'REQUIRED list should have been replaced').not.toBe(src);
  fs.writeFileSync(path.join(root, 'scripts', 'check.mjs'), patched);

  try {
    const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'check.mjs')], {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: root,
    });
    return { status: 0, out };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/** Minimal installed package: node_modules/<name>/{package.json,<file>} */
function pkgFiles(name: string, rel: string, body: string): Record<string, string> {
  return {
    [`node_modules/${name}/package.json`]: JSON.stringify({ name, version: '1.0.0' }),
    [`node_modules/${name}/${rel}`]: body,
  };
}

/**
 * Everything below this block swaps REQUIRED for a synthetic entry, which tests
 * the ENGINE. That leaves the CONTRACT untested: the engine stays green if
 * someone deletes the ccusage entry, points it at some other resolvable module,
 * drops its smoke, or empties the list — and the workflow would then cheerfully
 * verify nothing at all. These first tests pin the real list.
 */
describe('check-runtime-resolvable — the production contract', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8');

  it('still requires ccusage/src/cli.js, with a smoke command', () => {
    const block = source.match(/const REQUIRED = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block, 'REQUIRED must not be empty — an empty list verifies nothing').not.toMatch(
      /^\s*$/,
    );
    expect(block).toContain('ccusage/src/cli.js');
    // Resolution alone never proved ccusage RUNS; the native binary is optional.
    expect(block, 'the ccusage entry must keep its smoke command').toMatch(/smoke:\s*\['--version'\]/);
  });

  it('goes green against this checkout as it actually stands', () => {
    // The positive end-to-end case. If the composed tree ever loses ccusage,
    // this is the test that turns red — the synthetic-entry tests below cannot.
    const out = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8', stdio: 'pipe' });
    expect(out).toContain('ccusage/src/cli.js');
    expect(out).toContain('belong to this checkout');
  });
});

describe('merge-train validation chain', () => {
  it('runs the runtime-deps check, because canonicalization is where deps vanish silently', () => {
    // merge-train.sh overwrites the entire nv-main-owned set after every merge,
    // so a leaf's root-manifest dependency is discarded there — install still
    // green, build still green, consumer silently unavailable. Every merge-train
    // unit test sets MERGE_TRAIN_NO_INSTALL=1 and so skips this chain entirely,
    // which is exactly why the chain's CONTENTS need pinning here.
    const sh = fs.readFileSync(path.join(repoRoot, 'setup', 'merge-train.sh'), 'utf8');
    const chain = sh.match(/if ! \(pnpm install --frozen-lockfile[\s\S]*?\); then/)?.[0] ?? '';
    expect(chain, 'validation chain not found — did merge-train.sh change shape?').not.toBe('');
    expect(chain).toContain('check:runtime-deps');
    expect(chain.indexOf('check:runtime-deps')).toBeLessThan(chain.indexOf('pnpm run build'));
  });
});

describe('check-runtime-resolvable', () => {
  it('passes when the specifier resolves inside the checkout', () => {
    const r = run('healthy', {
      files: pkgFiles('demo', 'src/cli.js', 'process.exit(0);'),
      specifier: 'demo/src/cli.js',
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain('belong to this checkout');
  });

  it('reports MISSING DEPENDENCY when the package is absent entirely', () => {
    const r = run('missing', { specifier: 'nope-not-real/src/cli.js' });
    expect(r.status).toBe(1);
    expect(r.out).toContain('MISSING DEPENDENCY');
  });

  it('reports UNEXPORTED SUBPATH when the package exists but the entry point does not', () => {
    const r = run('subpath', {
      files: pkgFiles('demo', 'src/other.js', ''),
      specifier: 'demo/src/cli.js',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('UNEXPORTED SUBPATH');
  });

  it('reports UNDECLARED TRANSITIVE for a package only in pnpm’s virtual store', () => {
    // pnpm keeps transitive deps at .pnpm/<name>@<ver>/node_modules/<name> and
    // does NOT link them at the root. An earlier implementation called this
    // "not installed", which would have sent someone to edit the manifest.
    const r = run('transitive', {
      files: {
        'node_modules/.pnpm/demo@1.0.0/node_modules/demo/package.json': JSON.stringify({
          name: 'demo',
          version: '1.0.0',
        }),
        'node_modules/.pnpm/demo@1.0.0/node_modules/demo/src/cli.js': '',
      },
      specifier: 'demo/src/cli.js',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('UNDECLARED TRANSITIVE');
  });

  it('reports DAMAGED INSTALL for a dangling symlink rather than blaming the manifest', () => {
    const r = run('dangling', {
      links: { 'node_modules/demo': path.join(sandbox, 'does-not-exist-anywhere') },
      specifier: 'demo/src/cli.js',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('DAMAGED INSTALL');
  });

  it('reports DAMAGED INSTALL when the package directory has no manifest at all', () => {
    // The directory is there and the deep file is there, but package.json is
    // gone. An earlier version recognised a package only BY its package.json,
    // so this read as "not installed" and sent you to edit the manifest on
    // nv-main — when the actual fix is a reinstall.
    const r = run('no-manifest', {
      files: { 'node_modules/demo/src/cli.js': '' },
      specifier: 'demo/src/cli.js',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('DAMAGED INSTALL');
  });

  it('reports DAMAGED INSTALL when package metadata is unparseable', () => {
    const r = run('corrupt', {
      files: {
        'node_modules/demo/package.json': '{ this is not json',
        'node_modules/demo/src/cli.js': '',
      },
      specifier: 'demo/src/cli.js',
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('DAMAGED INSTALL');
  });

  it('rejects a package satisfied from OUTSIDE the checkout instead of passing', () => {
    // The false-green this gate exists to prevent: require.resolve searches
    // node_modules directories ABOVE the root, so a parent install can satisfy
    // a package this checkout never installed.
    const parent = path.join(sandbox, 'outside-parent');
    fs.mkdirSync(path.join(parent, 'node_modules', 'demo', 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(parent, 'node_modules', 'demo', 'package.json'),
      JSON.stringify({ name: 'demo', version: '1.0.0' }),
    );
    fs.writeFileSync(path.join(parent, 'node_modules', 'demo', 'src', 'cli.js'), '');

    // the fake checkout is a CHILD of that parent, and installs nothing itself
    const root = path.join(parent, 'child');
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    const patched = fs
      .readFileSync(SCRIPT, 'utf8')
      .replace(
        /const REQUIRED = \[[\s\S]*?\n\];/,
        `const REQUIRED = [\n  { specifier: 'demo/src/cli.js', why: 'test' },\n];`,
      );
    fs.writeFileSync(path.join(root, 'scripts', 'check.mjs'), patched);

    let status = 0;
    let out = '';
    try {
      out = execFileSync(process.execPath, [path.join(root, 'scripts', 'check.mjs')], {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (err: unknown) {
      const e = err as { status?: number; stdout?: string; stderr?: string };
      status = e.status ?? -1;
      out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    expect(status, 'a package from a parent install must not satisfy the gate').toBe(1);
    expect(out).toContain('RESOLVED OUTSIDE THIS CHECKOUT');
  });

  it('reports RESOLVES BUT DOES NOT RUN when the smoke command fails', () => {
    // Resolution succeeding while the thing cannot actually execute is exactly
    // ccusage's shape: cli.js is a launcher for an optional native binary.
    const r = run('smoke-fail', {
      files: pkgFiles('demo', 'src/cli.js', 'process.exit(3);'),
      specifier: 'demo/src/cli.js',
      smoke: ['--version'],
    });
    expect(r.status).toBe(1);
    expect(r.out).toContain('RESOLVES BUT DOES NOT RUN');
  });

  it('passes the smoke command when the entry point runs', () => {
    const r = run('smoke-ok', {
      files: pkgFiles('demo', 'src/cli.js', 'process.exit(0);'),
      specifier: 'demo/src/cli.js',
      smoke: ['--version'],
    });
    expect(r.status).toBe(0);
    expect(r.out).toContain('exit 0');
  });
});
