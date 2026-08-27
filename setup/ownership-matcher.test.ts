/**
 * Behavioral tests for .github/nv-path-guard/ownership.py — the single matcher
 * that decides which paths a branch owns.
 *
 * This runs under the host vitest suite (like nv-owned-drift.test.ts) so a
 * Python file that no TypeScript gate can see is still CI-protected. It needs
 * python3 and git and nothing else: no package install, which is the whole
 * point of the implementation it covers.
 *
 * The expectations below are GOLDEN — written out by hand, not generated from
 * the implementation. That is deliberate. The matcher's history is two readers
 * of one allowlist quietly disagreeing, so the test has to encode what the
 * answer should BE, not what the code currently says it is.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GUARD_DIR = path.join(HERE, '..', '.github', 'nv-path-guard');
const MATCHER = path.join(GUARD_DIR, 'ownership.py');
const CHECK = path.join(GUARD_DIR, 'check.py');

const PYTHON = (() => {
  const r = spawnSync('sh', ['-c', 'command -v python3'], { encoding: 'utf-8' });
  return r.stdout.trim() || 'python3';
})();

const NUL = '\0';

interface RunOpts {
  /** Working directory — used to prove an ambient repo cannot leak in. */
  cwd?: string;
  /** Extra environment (HOME redirection for the global-excludes case). */
  env?: NodeJS.ProcessEnv;
  /** Feed candidates newline-delimited instead of NUL-delimited. */
  lineMode?: boolean;
}

function withTmp<T>(fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-own-'));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Run the matcher CLI over an allowlist, returning status + the owned set. */
function match(
  patterns: string,
  candidates: string[],
  opts: RunOpts = {},
): { status: number | null; owned: string[]; stdout: string; stderr: string } {
  return withTmp((dir) => {
    const allowlist = path.join(dir, 'allowlist.txt');
    fs.writeFileSync(allowlist, patterns);
    const sep = opts.lineMode ? '\n' : NUL;
    const args = opts.lineMode ? [MATCHER, allowlist] : [MATCHER, '-0', allowlist];
    const r = spawnSync(PYTHON, args, {
      input: candidates.length ? candidates.join(sep) + sep : '',
      encoding: 'utf-8',
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
    });
    const owned = (r.stdout ?? '').split(sep).filter((x) => x.length > 0);
    return { status: r.status, owned, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  });
}

/**
 * GOLDEN pattern corpus. The real allowlists are ~114 lines of `dir/**` and
 * exercise almost none of gitignore's syntax, so a corpus built from tracked
 * paths proves very little. These are the corners where a matcher is actually
 * likely to be wrong.
 */
const GOLDEN: Array<{ name: string; patterns: string[]; candidates: string[]; owned: string[] }> = [
  {
    name: 'directory glob does not leak to a sibling prefix',
    patterns: ['src/**'],
    candidates: ['src/a.ts', 'src/deep/b.ts', 'srcx/a.ts', 'src'],
    owned: ['src/a.ts', 'src/deep/b.ts'],
  },
  {
    name: 'rooted patterns anchor, unrooted ones float',
    patterns: ['/top.txt', 'nested.txt'],
    candidates: ['top.txt', 'a/top.txt', 'nested.txt', 'a/nested.txt'],
    owned: ['top.txt', 'nested.txt', 'a/nested.txt'],
  },
  {
    name: 'trailing slash means directory-only, and matches without touching disk',
    patterns: ['build/'],
    candidates: ['build', 'build/x.o', 'a/build/x.o', 'build.txt'],
    owned: ['build/x.o', 'a/build/x.o'],
  },
  {
    name: 'a rooted directory-only pattern does not float',
    patterns: ['/build/'],
    candidates: ['build/x.o', 'a/build/x.o'],
    owned: ['build/x.o'],
  },
  {
    name: 'escaped ! is a literal filename, not a negation',
    patterns: ['\\!lit.txt'],
    candidates: ['!lit.txt', 'lit.txt'],
    owned: ['!lit.txt'],
  },
  {
    name: 'escaped # is a literal filename, not a comment',
    patterns: ['\\#lit.txt'],
    candidates: ['#lit.txt', 'lit.txt'],
    owned: ['#lit.txt'],
  },
  {
    name: 'character classes, including negated ones',
    patterns: ['f[oO]o.txt', 'n[!0-9].txt'],
    candidates: ['foo.txt', 'fOo.txt', 'fXo.txt', 'na.txt', 'n1.txt'],
    owned: ['foo.txt', 'fOo.txt', 'na.txt'],
  },
  {
    name: '? matches exactly one character and never a separator',
    patterns: ['a?c.txt'],
    candidates: ['abc.txt', 'ac.txt', 'abbc.txt'],
    owned: ['abc.txt'],
  },
  {
    name: 'leading ** spans any number of directories',
    patterns: ['**/target/**'],
    candidates: ['target/x', 'a/target/x', 'a/b/target/x'],
    owned: ['target/x', 'a/target/x', 'a/b/target/x'],
  },
  {
    name: 'middle ** matches zero directories too',
    patterns: ['a/**/z.txt'],
    candidates: ['a/z.txt', 'a/b/z.txt', 'a/b/c/z.txt'],
    owned: ['a/z.txt', 'a/b/z.txt', 'a/b/c/z.txt'],
  },
  {
    name: 'dir/* still matches deeper paths, because the directory itself matches',
    patterns: ['two/*'],
    candidates: ['two/x', 'two/a/x'],
    owned: ['two/x', 'two/a/x'],
  },
  {
    name: 'unescaped trailing whitespace on a pattern is not part of it',
    patterns: ['sp.txt   '],
    candidates: ['sp.txt', 'sp.txt   '],
    owned: ['sp.txt'],
  },
  {
    name: 'backslash-escaped trailing space IS part of the pattern',
    patterns: ['sp2.txt\\ '],
    candidates: ['sp2.txt ', 'sp2.txt'],
    owned: ['sp2.txt '],
  },
  {
    name: 'a backslash-escaped star is a literal star',
    patterns: ['lit\\*.txt'],
    candidates: ['lit*.txt', 'litX.txt'],
    owned: ['lit*.txt'],
  },
  {
    name: 'a single * does not cross a separator',
    patterns: ['x**y'],
    candidates: ['xy', 'xABy', 'x/y'],
    owned: ['xy', 'xABy'],
  },
  {
    name: 'dotfiles are matched like any other name',
    patterns: ['.hidden/**', '*.env'],
    candidates: ['.hidden/x', '.env', 'a/.env'],
    owned: ['.hidden/x', '.env', 'a/.env'],
  },
  {
    name: 'later negation re-includes when no parent directory was excluded',
    patterns: ['*.log', '!keep.log'],
    candidates: ['a.log', 'keep.log'],
    owned: ['a.log'],
  },
  {
    // The ONE place git and the `pathspec` package this replaced disagree, and
    // git is the correct side: gitignore documents that "it is not possible to
    // re-include a file if a parent directory of that file is excluded", and
    // `docs/**` matches the DIRECTORY docs/private. pathspec has no such rule
    // and would report these as NOT owned. No allowlist uses negation today, so
    // nothing changes in practice — this pins which semantics are the contract.
    name: 'negation cannot re-include under an already-excluded parent directory',
    patterns: ['docs/**', '!docs/private/**'],
    candidates: ['docs/a.md', 'docs/private/s.md', 'docs/private/deep/s.md'],
    owned: ['docs/a.md', 'docs/private/s.md', 'docs/private/deep/s.md'],
  },
  {
    // LOAD-BEARING. `git init` writes core.ignoreCase=true on a case-insensitive
    // filesystem (macOS), which would make this own `case/x` as well — the same
    // matcher answering differently on a developer's laptop than in Linux CI.
    // ownership.py pins core.ignoreCase=false to make that impossible.
    name: 'matching is case-sensitive regardless of the host filesystem',
    patterns: ['Case/**'],
    candidates: ['Case/x', 'case/x', 'CASE/x'],
    owned: ['Case/x'],
  },
  {
    name: 'comments and blank lines carry no patterns',
    patterns: ['# a comment', '', '   ', 'real/**'],
    candidates: ['real/x', '# a comment', 'a comment'],
    owned: ['real/x'],
  },
];

describe('ownership.py — golden gitwildmatch corpus', () => {
  for (const c of GOLDEN) {
    it(c.name, () => {
      const r = match(c.patterns.join('\n') + '\n', c.candidates);
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      expect(r.owned.sort()).toEqual([...c.owned].sort());
    });
  }
});

describe('ownership.py — exit-code contract', () => {
  it('exits 0 with empty output when nothing matches', () => {
    // `git check-ignore` exits 1 for "nothing matched". That is an ANSWER, not a
    // failure, and leaking it would make every clean tree look like a broken one.
    const r = match('src/**\n', ['docs/a.md', 'other/b.md']);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
  });

  it('exits 0 with empty output when there are no candidates at all', () => {
    const r = match('src/**\n', []);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });

  it('exits 2 when the allowlist is missing', () => {
    const r = spawnSync(PYTHON, [MATCHER, '-0', '/nonexistent/allowlist.txt'], {
      input: 'src/a.ts\0',
      encoding: 'utf-8',
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('not found');
  });

  it('exits 2 when the allowlist carries no patterns', () => {
    // Comments-only is the same as empty: nothing would be owned, and "nothing
    // is owned" is indistinguishable from a clean result at every call site.
    const r = match('# nothing here\n\n', ['src/a.ts']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('no patterns');
  });

  it('exits 2 with a real message when git is unavailable', () => {
    // Shadow PATH so `git` cannot be found; python is invoked by absolute path
    // so the interpreter itself still starts.
    const r = withTmp((dir) => {
      const allowlist = path.join(dir, 'allowlist.txt');
      fs.writeFileSync(allowlist, 'src/**\n');
      const emptyBin = path.join(dir, 'bin');
      fs.mkdirSync(emptyBin);
      return spawnSync(PYTHON, [MATCHER, '-0', allowlist], {
        input: 'src/a.ts\0',
        encoding: 'utf-8',
        env: { ...process.env, PATH: emptyBin },
      });
    });
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('cannot run git');
  });

  it('exits 2 rather than reporting nothing when a candidate escapes the repo', () => {
    // git answers 128 here, not "not ignored". Folding that into an empty result
    // is the silent-failure class this whole module exists to remove.
    const r = match('src/**\n', ['../outside.txt']);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('outside repository');
  });

  it('rejects bad usage', () => {
    const r = spawnSync(PYTHON, [MATCHER], { input: '', encoding: 'utf-8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('usage:');
  });
});

describe('ownership.py — NUL-delimited end to end', () => {
  it('round-trips paths containing spaces, tabs and newlines', () => {
    const weird = ['ws/two words.txt', 'ws/tab\there.txt', 'ws/new\nline.txt', 'ws/back\\slash.txt'];
    const r = match('ws/**\n', weird);
    expect(r.status).toBe(0);
    expect(r.owned.sort()).toEqual([...weird].sort());
  });

  it('preserves input order and de-duplicates', () => {
    const r = match('src/**\n', ['src/b.ts', 'src/a.ts', 'src/b.ts']);
    expect(r.owned).toEqual(['src/b.ts', 'src/a.ts']);
  });

  it('still accepts newline-delimited input without -0, for older callers', () => {
    // A caller composed from a branch that predates -0 must keep working. If it
    // silently got NUL semantics, its whole newline-joined list would arrive as
    // ONE path, match nothing, and read as "nothing is owned" — fail-open.
    const r = match('src/**\n', ['src/a.ts', 'docs/b.md'], { lineMode: true });
    expect(r.status).toBe(0);
    expect(r.owned).toEqual(['src/a.ts']);
  });
});

/**
 * The original bug: the drift checker ran `git check-ignore` inside the PROJECT
 * repo, so the repo's own .gitignore, .git/info/exclude and the user's global
 * excludes all contributed patterns — a broader owned set than CI's, from the
 * same allowlist. Each case here plants a rule that WOULD widen ownership and
 * asserts it does not.
 */
describe('ownership.py — ownership comes from the allowlist and nothing else', () => {
  const ALLOWLIST = 'src/**\n';
  const CANDIDATES = ['src/a.ts', 'groups/main/notes.txt'];
  const EXPECTED = ['src/a.ts'];

  function repoWith(dir: string, gitignore?: string, exclude?: string): string {
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(repo);
    spawnSync('git', ['init', '-q', repo]);
    if (gitignore !== undefined) fs.writeFileSync(path.join(repo, '.gitignore'), gitignore);
    if (exclude !== undefined) {
      fs.mkdirSync(path.join(repo, '.git', 'info'), { recursive: true });
      fs.writeFileSync(path.join(repo, '.git', 'info', 'exclude'), exclude);
    }
    return repo;
  }

  it('a repo .gitignore in the working directory does not widen ownership', () => {
    withTmp((dir) => {
      const repo = repoWith(dir, 'groups/\n');
      const r = match(ALLOWLIST, CANDIDATES, { cwd: repo });
      expect(r.status).toBe(0);
      expect(r.owned).toEqual(EXPECTED);
    });
  });

  it('a .git/info/exclude entry does not widen ownership', () => {
    withTmp((dir) => {
      const repo = repoWith(dir, undefined, 'groups/**\n');
      const r = match(ALLOWLIST, CANDIDATES, { cwd: repo });
      expect(r.status).toBe(0);
      expect(r.owned).toEqual(EXPECTED);
    });
  });

  it('a global core.excludesFile does not widen ownership', () => {
    withTmp((dir) => {
      // Per-user config is the worst of the three: untracked, invisible in
      // review, and different on every machine that runs the check.
      const home = path.join(dir, 'home');
      fs.mkdirSync(home);
      fs.writeFileSync(path.join(home, 'global-excludes'), 'groups/**\n');
      fs.writeFileSync(
        path.join(home, '.gitconfig'),
        `[core]\n\texcludesFile = ${path.join(home, 'global-excludes')}\n`,
      );
      const r = match(ALLOWLIST, CANDIDATES, {
        cwd: repoWith(dir),
        env: { HOME: home, XDG_CONFIG_HOME: home, GIT_CONFIG_GLOBAL: undefined },
      });
      expect(r.status).toBe(0);
      expect(r.owned).toEqual(EXPECTED);
    });
  });

  it('an inherited GIT_DIR cannot redirect the matcher into a real repo', () => {
    withTmp((dir) => {
      const repo = repoWith(dir, 'groups/\n');
      const r = match(ALLOWLIST, CANDIDATES, {
        env: { GIT_DIR: path.join(repo, '.git'), GIT_WORK_TREE: repo },
      });
      expect(r.status).toBe(0);
      expect(r.owned).toEqual(EXPECTED);
    });
  });
});

/**
 * A ratchet, not a behavior test. The guard that decides what a branch may
 * change must not fetch code from a package registry at the moment it runs, and
 * that property is easy to reintroduce accidentally while "just fixing" an
 * import error.
 */
describe('ownership.py — carries no third-party dependency', () => {
  const source = fs.readFileSync(MATCHER, 'utf-8');

  // Code markers, not words: the module's own docstring explains the bootstrap
  // it replaced, and that history should stay readable without tripping a gate.
  for (const forbidden of ['pip install', 'import venv', 'venv.create', 'NV_PATH_GUARD_NO_BOOTSTRAP']) {
    it(`does not reintroduce \`${forbidden}\``, () => {
      expect(source).not.toContain(forbidden);
    });
  }

  it('never imports pathspec', () => {
    expect(source).not.toMatch(/^\s*import\s+pathspec/m);
    expect(source).not.toMatch(/^\s*from\s+pathspec/m);
  });

  it('works even when importing pathspec would raise', () => {
    // Stronger than reading the source: shadow `pathspec` with a module that
    // explodes on import. If anything still reached for it, this would fail.
    withTmp((dir) => {
      fs.writeFileSync(
        path.join(dir, 'pathspec.py'),
        'raise ImportError("pathspec must not be used by the ownership matcher")\n',
      );
      const allowlist = path.join(dir, 'allowlist.txt');
      fs.writeFileSync(allowlist, 'src/**\n');
      const r = spawnSync(PYTHON, [MATCHER, '-0', allowlist], {
        input: 'src/a.ts\0docs/b.md\0',
        encoding: 'utf-8',
        env: { ...process.env, PYTHONPATH: dir },
      });
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('src/a.ts\0');
    });
  });

  it('the real allowlists stay flush-left with no trailing whitespace', () => {
    // load_patterns is faithful: it does NOT strip, because in gitignore syntax
    // leading whitespace is part of the pattern and `foo\\ ` means "foo ".
    // That is only safe while no allowlist relies on being tidied up first.
    for (const f of fs.readdirSync(GUARD_DIR).filter((n) => n.endsWith('.txt'))) {
      const lines = fs.readFileSync(path.join(GUARD_DIR, f), 'utf-8').split('\n');
      for (const [i, line] of lines.entries()) {
        if (line === '' || line.startsWith('#')) continue;
        expect(`${f}:${i + 1}:${JSON.stringify(line)}`).toBe(`${f}:${i + 1}:${JSON.stringify(line.trim())}`);
      }
    }
  });
});

describe('check.py — shares the matcher and fails closed', () => {
  it('exits 2 when the allowlist exists but carries no patterns', () => {
    // Previously a warning + exit 0. An emptied allowlist would then wave
    // through the very PR that emptied it.
    withTmp((dir) => {
      spawnSync('git', ['init', '-q', dir]);
      const guard = path.join(dir, '.github', 'nv-path-guard');
      fs.mkdirSync(guard, { recursive: true });
      fs.copyFileSync(MATCHER, path.join(guard, 'ownership.py'));
      fs.copyFileSync(CHECK, path.join(guard, 'check.py'));
      fs.writeFileSync(path.join(guard, 'nv-main.txt'), '# emptied\n\n');
      const r = spawnSync(PYTHON, [path.join(guard, 'check.py'), 'nv-main', 'HEAD'], {
        cwd: dir,
        encoding: 'utf-8',
      });
      expect(r.status).toBe(2);
      expect(r.stdout + r.stderr).toContain('no patterns');
    });
  });
});
