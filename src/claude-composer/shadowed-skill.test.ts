/**
 * A skill name a stamped template owns must not be DESCRIBED by the composed
 * document from the catalog's copy of that name.
 *
 * Two dirs can hold the same skill name: the catalog mirror under
 * `groups/<folder>/skills/` and the template's own copy in the group-private
 * overlay. `group-init` leaves the template's in place and skips mirroring the
 * catalog one, so the template's body is what `/<name>` executes — while the
 * composed document goes on describing the catalog's, because it renders from
 * the catalog regardless of what was mirrored. The prompt and the executable
 * body then disagree, and the agent trusts the prompt.
 *
 * Only DESCRIBED names are affected. A mirror-floor skill such as `welcome` is
 * copied into every group but never rendered, so a template shipping `welcome`
 * (two published ones do) produces no disagreement and needs no handling. The
 * names that matter are the ones the document actually names — and `onecli-gateway`
 * most of all, since its entire body is inlined resident: the prompt would carry
 * the real credential-handling rules while a template-authored body ran.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { renderCoworkerSpine } from './spine.js';

const ROOT = process.cwd();

/** Names the document describes, one line each, under `## Skills`. */
function describedNames(doc: string): string[] {
  return [...doc.matchAll(/^- `\/([a-z][a-z0-9-]*)` —/gm)].map((m) => m[1]);
}

/** Names whose whole `instructions.md` is inlined under Resident Skill Instructions. */
function residentNames(doc: string): string[] {
  return [...doc.matchAll(/^### `\/([a-z][a-z0-9-]*)`/gm)].map((m) => m[1]);
}

describe('a template-owned skill name is not described from the catalog', () => {
  // Read off the real registry rather than hardcoded: if a skill stops being
  // described (or starts), this test follows instead of going quietly vacuous.
  const baseline = renderCoworkerSpine(ROOT, 'default', null, {});
  const described = describedNames(baseline);
  const resident = residentNames(baseline);

  it('has something to hide — nothing below may pass vacuously', () => {
    expect(described.length).toBeGreaterThan(0);
    expect(resident.length).toBeGreaterThan(0);
  });

  it('drops a shadowed name from the Skills index and leaves the rest', () => {
    const victim = described[0];
    const doc = renderCoworkerSpine(ROOT, 'default', null, { pluginOwnedSkills: [victim] });

    expect(describedNames(doc)).not.toContain(victim);
    for (const other of described.filter((n) => n !== victim)) {
      expect(describedNames(doc)).toContain(other);
    }
  });

  it('drops a shadowed name from the resident prose, so the prompt stops carrying it', () => {
    const victim = resident[0];
    const doc = renderCoworkerSpine(ROOT, 'default', null, { pluginOwnedSkills: [victim] });

    expect(residentNames(doc)).not.toContain(victim);
    // The prose itself is gone, not merely its heading.
    const block = baseline.slice(baseline.indexOf(`### \`/${victim}\``));
    const proseLine = block
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .find((l) => l.length > 40 && !l.startsWith('#') && !l.startsWith('```'));
    expect(proseLine, 'fixture needs a substantial prose line to assert on').toBeTruthy();
    expect(doc).not.toContain(proseLine!);
  });

  it('still treats the shadowed name as a real slash command', () => {
    // The template's skill IS invokable — only its DESCRIPTION was wrong. Dropping
    // the name from the index must not turn `/<name>` refs in surviving prose into
    // unknown-ref rewrites, which is what would happen if the name were removed
    // from the manifest wholesale instead of from these two renderings.
    const victim = described[0];
    const doc = renderCoworkerSpine(ROOT, 'default', null, { pluginOwnedSkills: [victim] });
    expect(doc).not.toMatch(new RegExp(`Unknown slash ref /${victim}`, 'i'));
  });

  it('is a no-op when the group carries no template skills', () => {
    expect(renderCoworkerSpine(ROOT, 'default', null, { pluginOwnedSkills: [] })).toBe(baseline);
    expect(renderCoworkerSpine(ROOT, 'default', null, {})).toBe(baseline);
  });

  it('ignores a name the catalog does not describe', () => {
    // A template shipping `welcome` (mirror-floor, never rendered) changes nothing.
    expect(renderCoworkerSpine(ROOT, 'default', null, { pluginOwnedSkills: ['welcome'] })).toBe(baseline);
  });
});

/**
 * The option is only worth having if the spawn path actually supplies it. An
 * unwired option is the worst failure shape available here — it type-checks, its
 * unit tests pass, and it silently does nothing forever.
 */
describe('the spawn path supplies the group its template-owned names', () => {
  const runner = fs.readFileSync(path.join(ROOT, 'src/container-runner.ts'), 'utf-8');

  it('sources them from the same function group-init skips mirroring by', () => {
    expect(runner).toMatch(/pluginOwnedSkills: \[\.\.\.pluginOwnedSkillNames\(agentGroup\.folder\)\]/);
    expect(runner).toMatch(/import \{[^}]*pluginOwnedSkillNames[^}]*\} from '\.\/group-init\.js'/);
  });

  it('forwards them into the composition rather than dropping them', () => {
    expect(runner).toMatch(/pluginOwnedSkills: opts\.pluginOwnedSkills/);
  });
});
