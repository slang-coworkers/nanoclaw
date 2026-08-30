import { describe, expect, it } from 'vitest';

import { applyProviderSkill } from './install.js';

/**
 * Drives the real `/add-codex` SKILL.md against the real tree. Hermetic on a
 * healthy checkout: every mutating directive self-skips (barrels wired, CLI pin
 * present), and the build/test/auth runs are flow-owned so `exec` no-ops them —
 * so nothing is written and nothing shells out.
 *
 * That is exactly the case the `changed` flag used to get wrong.
 */
describe('applyProviderSkill on an already-installed provider', () => {
  it('reports no change, so the caller skips the image rebuild', async () => {
    const { changed, blockers, apply } = await applyProviderSkill('.claude/skills/add-codex', process.cwd());

    expect(blockers).toEqual([]);
    // `applied` is non-empty here — the engine counts the flow-owned build/test/
    // auth runs it never actually executed. Reading it as "changed" made
    // `--step provider-auth codex` rebuild the image unconditionally, and exit 1
    // wherever the build can't run. The journal is the honest record.
    expect(apply.applied.length).toBeGreaterThan(0);
    expect(changed).toBe(false);
  });

  it('mutates nothing on disk — every real directive self-skips', async () => {
    const { apply } = await applyProviderSkill('.claude/skills/add-codex', process.cwd());
    const writes = apply.journal.filter((e) => e.op !== 'ran');

    // A copy fence returning to add-codex lands 'wrote' entries here — and would
    // overwrite this fork's divergence in codex-app-server.ts. See
    // setup/providers/codex.test.ts.
    expect(writes).toEqual([]);
    expect(apply.skipped.length).toBeGreaterThanOrEqual(4);
  });
});
