/**
 * A skill's `instructions.md` must reach the agents that can invoke that skill.
 *
 * A skill dir holds two files with different lifetimes: `SKILL.md` is fetched on
 * demand once the agent decides it needs the skill, and `instructions.md` has to
 * be resident, because what it states is typically a prohibition and an agent
 * cannot know to load the rule it is about to break.
 *
 * The assertion runs from the FILES ON DISK inward — inventory the dirs, then
 * demand each one's prose appear — rather than iterating a list in our code and
 * confirming that list still renders. Only the first direction can fail for a
 * skill nobody registered anywhere.
 *
 * Scope comes from `resolveAllowedSkillNames`, the same function that decides which
 * skill dirs get mirrored. Two surfaces (what an agent may invoke, what prose it
 * holds resident) have to agree, and a private notion of scope here would be a
 * third list to keep in step.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterAll, describe, expect, it } from 'vitest';

import { readCoworkerTypes, readSkillCatalog } from './registry.js';
import { MIRROR_FLOOR_SKILLS, residentSkillInstructions, resolveAllowedSkillNames } from './skill-scope.js';
import { renderCoworkerSpine } from './spine.js';
import type { CoworkerManifest, CoworkerTypeEntry, SkillMeta } from './types.js';

const ROOT = process.cwd();
const RESIDENT_SECTION = '## Resident Skill Instructions';

/** Every skill dir on disk that ships a non-empty `instructions.md`. */
function shippedInstructions(): { skillDir: string; proseLines: string[] }[] {
  const skillsRoot = path.join(ROOT, 'container', 'skills');
  const out: { skillDir: string; proseLines: string[] }[] = [];
  for (const dir of fs.readdirSync(skillsRoot)) {
    const file = path.join(skillsRoot, dir, 'instructions.md');
    if (!fs.existsSync(file)) continue;
    const body = fs.readFileSync(file, 'utf-8').trim();
    if (!body) continue;
    // EVERY prose line, not a sample: a partial body is the failure mode that
    // matters, since the one line a spot-check happened to pick could be the only
    // one that survived. Headings are excluded because the composer re-levels
    // them; their leveling is bounded in `anchor-retarget.test.ts` instead.
    const proseLines = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));
    out.push({ skillDir: dir, proseLines });
  }
  return out;
}

/** Declared skill name for a dir — the composer resolves refs by name, not path. */
function nameForDir(skillDir: string): string | null {
  const catalog = readSkillCatalog(ROOT);
  const want = path.join(ROOT, 'container', 'skills', skillDir);
  for (const meta of Object.values(catalog)) {
    if (path.dirname(meta.path) === want) return meta.name;
  }
  return null;
}

/**
 * One skill's rendered block from inside `## Resident Skill Instructions`, or null
 * when that section does not carry the skill.
 *
 * Bounded twice — to the section, then to the skill's heading — so neither an
 * identical `### /<skill>` block under a later section nor prose belonging to the
 * next skill can stand in for text that never landed here.
 *
 * Fence-aware at both levels: instruction prose may legitimately show a markdown
 * heading inside an example, and treating that as a boundary would cut the block
 * short and fail a document that is in fact complete.
 */
function residentBlock(doc: string, skillName: string): string | null {
  const lines = doc.split('\n');
  const sectionAt = findHeading(lines, RESIDENT_SECTION);
  if (sectionAt < 0) return null;

  const section = takeUntilHeading(lines, sectionAt + 1, /^## /);
  const start = findHeading(section, `### \`/${skillName}\``);
  if (start < 0) return null;

  return [section[start], ...takeUntilHeading(section, start + 1, /^#{2,3} /)].join('\n');
}

/**
 * Index of the first line that IS `heading`, outside a code fence, or -1.
 *
 * Both ends of both ranges have to agree about what counts as structure: a
 * heading quoted inside an example is text, so finding one as a start would
 * report a block the document does not actually have.
 */
function findHeading(lines: string[], heading: string): number {
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && lines[i] === heading) return i;
  }
  return -1;
}

/** Lines from `from` up to the first line matching `heading` outside a code fence. */
function takeUntilHeading(lines: string[], from: number, heading: RegExp): string[] {
  const out: string[] = [];
  let inFence = false;
  for (let i = from; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) inFence = !inFence;
    if (!inFence && heading.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

describe('resident skill instructions', () => {
  const shipped = shippedInstructions();

  it('finds at least one shipped instructions.md — nothing below may pass vacuously', () => {
    // If the last one is ever legitimately removed, retire this file on purpose
    // rather than letting the suite go quietly green over an empty inventory.
    expect(shipped.length).toBeGreaterThan(0);
    for (const s of shipped) {
      expect(s.proseLines.length, `${s.skillDir}/instructions.md has no prose to check for`).toBeGreaterThan(0);
    }
  });

  it('resolves every one to a catalog skill name', () => {
    for (const s of shipped) {
      expect(
        nameForDir(s.skillDir),
        `container/skills/${s.skillDir} ships instructions.md but is not in the catalog`,
      ).toBeTruthy();
    }
  });

  it('lands in the composed document of every coworker type that can invoke the skill', () => {
    const types = readCoworkerTypes(ROOT);
    const typeNames = Object.keys(types);
    expect(typeNames.length).toBeGreaterThan(1);

    for (const typeName of typeNames) {
      const doc = renderCoworkerSpine(ROOT, typeName, null, {});
      // `null` == flat type: no manifest allow-list, every mirrored skill reachable.
      const allowed = resolveAllowedSkillNames(ROOT, typeName);
      for (const s of shipped) {
        const name = nameForDir(s.skillDir);
        if (!name) continue;
        if (allowed !== null && !allowed.has(name) && !allowed.has(s.skillDir)) continue;

        // Search the skill's OWN block, not the whole document: identical prose
        // elsewhere would otherwise stand in for prose that never landed.
        const block = residentBlock(doc, name);
        expect(
          block,
          `'${typeName}' can invoke /${name} but its composed CLAUDE.md has no ` +
            `'### \`/${name}\`' block under ${RESIDENT_SECTION}. That prose is ` +
            `resident-or-nothing: unlike SKILL.md it is never fetched on demand.`,
        ).toBeTruthy();

        const missing = s.proseLines.filter((line) => !(block ?? '').includes(line));
        expect(
          missing,
          `'${typeName}' carries /${name}'s block but is missing ${missing.length}/` +
            `${s.proseLines.length} line(s) of container/skills/${s.skillDir}/instructions.md`,
        ).toEqual([]);
      }
    }
  });

  it('does not end a block at a heading inside a fenced example', () => {
    // The composer's own fragments contain fenced markdown, so instruction prose
    // eventually will too; a boundary scan that ignored fences would cut the block
    // short and fail a document that carries every required line.
    const doc = [
      'preamble',
      '',
      RESIDENT_SECTION,
      '',
      '### `/demo`',
      '',
      '```md',
      '## Not a boundary',
      '```',
      '',
      'closing rule.',
      '',
      '## After',
    ].join('\n');

    const block = residentBlock(doc, 'demo');
    expect(block).toContain('## Not a boundary');
    expect(block).toContain('closing rule.');
    expect(block).not.toContain('## After');
  });

  it("does not accept a skill heading quoted inside another skill's example", () => {
    // A heading inside a fence is text, not structure. Treating it as a start would
    // report a block for a skill whose prose is nowhere in the document.
    const doc = [
      RESIDENT_SECTION,
      '',
      '### `/other`',
      '',
      'a rule, illustrated with:',
      '',
      '```md',
      '### `/demo`',
      '',
      'example prose.',
      '```',
    ].join('\n');

    expect(residentBlock(doc, 'demo')).toBeNull();
    expect(residentBlock(doc, 'other')).toContain('example prose.');
  });

  it('reports absent when the only matching block sits under a later section', () => {
    // The case that makes the section bound load-bearing: the resident section does
    // NOT carry this skill, and a coincidentally identical heading further down must
    // not vouch for prose that never became resident.
    const doc = [
      RESIDENT_SECTION,
      '',
      '### `/other`',
      '',
      'someone else’s rule.',
      '',
      '## After',
      '',
      '### `/demo`',
      '',
      'an impostor rule.',
    ].join('\n');

    expect(residentBlock(doc, 'demo')).toBeNull();
    expect(residentBlock(doc, 'other')).toContain('someone else’s rule.');
  });

  it('places the section after the Skills index and before operator instructions', () => {
    // Ordering is the intent, so it is asserted rather than left to review: prose
    // about a skill belongs next to the skill list, and the operator's persona
    // keeps the last word.
    const doc = renderCoworkerSpine(ROOT, 'default', '# Persona\n\nBe terse.', {
      mcpInstructions: { demo: 'Use it.' },
    });
    const at = (h: string): number => {
      const i = doc.indexOf(h);
      expect(i, `${h} missing from the composed document`).toBeGreaterThan(-1);
      return i;
    };
    expect(at('## Skills')).toBeLessThan(at(RESIDENT_SECTION));
    expect(at(RESIDENT_SECTION)).toBeLessThan(at('## MCP Servers'));
    // The operator's persona, which typed mode demotes to `###` under its own
    // wrapper. Newline-anchored because a bare 'Persona' also matches the spine's
    // '### Personality and Principles', which sits far earlier.
    expect(at('## MCP Servers')).toBeLessThan(at('\n### Persona\n'));
  });
});

/**
 * A synthetic catalog: these three properties are about the selection predicate,
 * not about any particular in-tree skill, and the in-tree skills cannot express a
 * name/dir mismatch or an unreadable file.
 */
describe('resident selection', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'resident-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  // Cloned from a real catalog entry rather than hand-built, so a new required
  // field on SkillMeta cannot make these fixtures quietly unrepresentative.
  const template = Object.values(readSkillCatalog(ROOT)).find((m) => m.type === 'capability');

  function meta(dir: string, name: string, type: SkillMeta['type'] = 'capability'): SkillMeta {
    const skillDir = path.join(tmp, dir);
    fs.mkdirSync(skillDir, { recursive: true });
    return {
      ...(template as SkillMeta),
      name,
      type,
      path: path.join(skillDir, 'SKILL.md'),
      uses: { skills: [], workflows: [] },
    };
  }

  function manifest(flat: boolean): CoworkerManifest {
    return {
      typeName: 't',
      title: 'T',
      identity: '',
      invariants: [],
      context: [],
      workflows: [],
      skills: [],
      tools: [],
      bindings: {},
      customizations: [],
      vars: {},
      mcpServers: {},
      flat,
    } as CoworkerManifest;
  }

  it('includes a floor skill whose declared name differs from its directory', () => {
    // The floor names DIRECTORIES, and `mirrorDirsFor` matches either the declared
    // name or the dir — so a mismatch must not drop mandatory prose that the mirror
    // still ships.
    const dir = MIRROR_FLOOR_SKILLS[0];
    const m = meta(dir, `${dir}-renamed-in-frontmatter`);
    fs.writeFileSync(path.join(tmp, dir, 'instructions.md'), 'Never do the forbidden thing.');

    // Claimed by a type, so the dynamic unclaimed tier does NOT cover it and the
    // floor's directory entry is the only thing that can: without the dir half of
    // the predicate this returns nothing.
    const types = { other: { skills: [m.name] } } as unknown as Record<string, CoworkerTypeEntry>;
    const out = residentSkillInstructions(types, { [m.name]: m }, manifest(false));

    expect(out.map((r) => r.name)).toEqual([m.name]);
  });

  it('skips workflow and overlay entries even in flat mode', () => {
    // Flat mode has no allow-list to filter by, so the type filter is the only thing
    // keeping a non-capability's sibling file out of every flat document. Both
    // non-capability kinds are asserted: excluding one and admitting the other is a
    // reachable implementation.
    const wf = meta('some-workflow', 'some-workflow', 'workflow');
    fs.writeFileSync(path.join(tmp, 'some-workflow', 'instructions.md'), 'Not a capability.');
    const ov = meta('some-overlay', 'some-overlay', 'overlay');
    fs.writeFileSync(path.join(tmp, 'some-overlay', 'instructions.md'), 'Also not a capability.');

    expect(residentSkillInstructions({}, { [wf.name]: wf, [ov.name]: ov }, manifest(true))).toEqual([]);
  });

  it('propagates a read failure that is not a missing file', () => {
    // Failing closed matters here: silently continuing would publish a document
    // missing a prohibition, and nothing downstream would know.
    const m = meta('unreadable', 'unreadable');
    // A directory where the file is expected yields EISDIR, not ENOENT.
    fs.mkdirSync(path.join(tmp, 'unreadable', 'instructions.md'), { recursive: true });

    expect(() => residentSkillInstructions({}, { [m.name]: m }, manifest(true))).toThrow();
  });
});
