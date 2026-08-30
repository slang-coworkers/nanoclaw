import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { applyProviderSkill } from './install.js';

/**
 * Runs the REAL `/add-codex` SKILL.md, but against a scratch root holding only
 * the files its directives touch. Never the repo checkout: a regression that
 * reintroduces a copy fence would otherwise write into the working tree and
 * shell out to `git fetch`.
 */
const ROOT = process.cwd();
const scratches: string[] = [];

function scratchRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'provider-install-'));
  scratches.push(root);

  mkdirSync(join(root, '.claude/skills'), { recursive: true });
  cpSync(join(ROOT, '.claude/skills/add-codex'), join(root, '.claude/skills/add-codex'), { recursive: true });
  cpSync(join(ROOT, 'container/cli-tools.json'), join(root, 'container/cli-tools.json'));

  for (const barrel of [
    'src/providers/index.ts',
    'container/agent-runner/src/providers/index.ts',
    'setup/providers/index.ts',
  ]) {
    mkdirSync(join(root, barrel, '..'), { recursive: true });
    writeFileSync(join(root, barrel), "import './codex.js';\n");
  }
  // No setup/lib/channels-remote.sh: a copy-fence regression fails loudly on the
  // missing resolver instead of reaching a real remote.
  return root;
}

/** Scratch root carrying the REAL barrels and CLI manifest, not synthesized ones. */
function mirrorOfRealWiring(): string {
  const root = scratchRoot();
  for (const barrel of [
    'src/providers/index.ts',
    'container/agent-runner/src/providers/index.ts',
    'setup/providers/index.ts',
  ]) {
    cpSync(join(ROOT, barrel), join(root, barrel));
  }
  return root;
}

afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

describe('applyProviderSkill on an already-installed provider', () => {
  it('reports no change, so the caller skips the image rebuild', async () => {
    const { changed, blockers, apply } = await applyProviderSkill('.claude/skills/add-codex', scratchRoot());

    expect(blockers).toEqual([]);
    // `applied` is non-empty here: the engine counts the build/test/auth runs
    // that isFlowOwnedCommand no-ops. Reading it as "changed" made
    // `--step provider-auth codex` rebuild the image on every run, and exit 1
    // wherever the build cannot run. The journal is the honest record.
    expect(apply.applied.length).toBeGreaterThan(0);
    expect(changed).toBe(false);
  });

  it('mutates nothing — every real directive self-skips', async () => {
    const root = scratchRoot();
    const before = readFileSync(join(root, 'container/cli-tools.json'), 'utf-8');

    const { apply } = await applyProviderSkill('.claude/skills/add-codex', root);

    expect(apply.journal.filter((e) => e.op !== 'ran')).toEqual([]);
    expect(readFileSync(join(root, 'container/cli-tools.json'), 'utf-8')).toBe(before);
    expect(apply.skipped.length).toBeGreaterThanOrEqual(4);
  });

  it('reports a change when a barrel line is missing, so the caller rebuilds', async () => {
    const root = scratchRoot();
    writeFileSync(join(root, 'setup/providers/index.ts'), '// no codex line\n');

    const { changed, apply } = await applyProviderSkill('.claude/skills/add-codex', root);

    expect(changed).toBe(true);
    expect(apply.journal).toContainEqual({
      op: 'appended',
      path: 'setup/providers/index.ts',
      line: "import './codex.js';",
    });
  });
});

describe('the real repo tree satisfies the skill', () => {
  // The state the setup flow actually meets on trunk: nothing left to mutate, so
  // `--step provider-auth codex` reaches auth without rebuilding the image. Run
  // against a mirror of the REAL barrels and manifest — a drifted barrel line or
  // manifest pin fails here instead of surprising the operator mid-setup.
  it('needs no mutation, so provider-auth skips the image rebuild', async () => {
    const root = mirrorOfRealWiring();

    const { changed, blockers } = await applyProviderSkill('.claude/skills/add-codex', root);

    expect(blockers).toEqual([]);
    expect(changed).toBe(false);
  });
});
