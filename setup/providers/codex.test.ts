import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

// Imports ONLY the barrel, like src/providers/barrel-registration.test.ts: the
// `import './codex.js'` line in index.ts is the load-bearing wiring, and a test
// that imported codex.js directly would stay green after someone deleted it.
import './index.js';
import { getSetupProvider, listSetupProviders } from './registry.js';

const ROOT = process.cwd();

describe('setup provider barrel', () => {
  it('registers codex via the barrel (guards the import line)', () => {
    expect(listSetupProviders().map((e) => e.value)).toContain('codex');
  });

  it('exposes the three hooks the setup flow dispatches on', () => {
    const entry = getSetupProvider('codex');

    // Without runAuth, `--step provider-auth codex` exits 1 with "did not
    // register" — the failure this file exists to prevent.
    expect(typeof entry?.runAuth).toBe('function');
    expect(typeof entry?.runInstallCheck).toBe('function');
    expect(typeof entry?.offerFailureAssist).toBe('function');
  });

  it('resolves case-insensitively, matching how resolveProviderName normalizes', () => {
    expect(getSetupProvider('CODEX')?.value).toBe('codex');
  });
});

describe('verifyCodexInstall', () => {
  it('passes on this fork tree', async () => {
    const { verifyCodexInstall } = await import('./codex.js');
    const result = verifyCodexInstall();

    // The assertion upstream's copy fails: it requires
    // src/providers/codex-agents-md.ts, which this fork deliberately does not
    // carry (AGENTS.md is a symlink from group-init, not a composed file).
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('does not require the AGENTS.md composer this fork omits', async () => {
    const { verifyCodexInstall } = await import('./codex.js');

    expect(fs.existsSync(path.join(ROOT, 'src/providers/codex-agents-md.ts'))).toBe(false);
    expect(verifyCodexInstall().ok).toBe(true);
  });
});

/**
 * The armed silent revert this file exists to disarm.
 *
 * `/add-codex` used to carry an `nc:copy from-branch:providers` fence listing 18
 * files. Its §27 prose said not to re-copy them; the engine executes directives,
 * not prose, so the prose lost. Two ways it fires:
 *
 *   - `selfStatus` returns `apply` UNCONDITIONALLY for `copy` in refresh mode,
 *     and `detectInstalledSkills` reads `src/providers/index.ts` — so
 *     `/update-skills` refreshes add-codex and overwrites the destinations even
 *     though they are all present.
 *   - Our codex files are FORKS, not copies: codex-app-server.ts +578/−343,
 *     container codex.ts +307/−246, src/providers/codex.ts +28/−113. Overwriting
 *     them is a revert, and tsc stays green because the upstream versions
 *     compile fine.
 *
 * So the invariant is not "the fence omits the bad paths" — it is "there is no
 * copy fence". A pruned fence listing only the forked files would still revert
 * them on the next `/update-skills`.
 */
describe('add-codex carries no copy fence', () => {
  const skill = fs.readFileSync(path.join(ROOT, '.claude/skills/add-codex/SKILL.md'), 'utf-8');
  const fences = [...skill.matchAll(/```nc:copy[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]);

  it('has no nc:copy directive at all', () => {
    expect(fences).toEqual([]);
  });

  it('still carries the barrel appends that make registration self-heal', () => {
    for (const barrel of [
      'src/providers/index.ts',
      'container/agent-runner/src/providers/index.ts',
      'setup/providers/index.ts',
    ]) {
      expect(skill).toContain(`nc:append to:${barrel}`);
    }
  });

  it('vitest-runs only test paths that exist', () => {
    const runs = [...skill.matchAll(/```nc:run[^\n]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n'));
    const targets = runs
      .filter((l) => /\bvitest run\b/.test(l))
      .flatMap((l) => l.split(/\s+/))
      .filter((tok) => tok.endsWith('.test.ts') || tok.endsWith('/'));

    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((t) => !fs.existsSync(path.join(ROOT, t)))).toEqual([]);
  });
});
