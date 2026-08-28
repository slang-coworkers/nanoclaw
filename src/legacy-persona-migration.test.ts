/**
 * A legacy untyped group has a hand-written `CLAUDE.md` and no
 * `instructions.prepend.md`. On its next spawn the composer adopts that document
 * as the group's persona and writes a composed document in its place.
 *
 * That migration used to `renameSync` the file — BEFORE composition ran. So a
 * compose failure on this path left `assertComposedDocUsable` looking at nothing:
 *
 *   1. rename CLAUDE.md → instructions.prepend.md   (document gone)
 *   2. compose throws
 *   3. assertComposedDocUsable sees 0 bytes → throws → refuses to spawn
 *
 * The group is bricked despite having had a perfectly good document one step
 * earlier, and `wakeContainer`'s transient-retry contract means host-sweep
 * retries every 60s forever. Copy-then-publish closes the window: the legacy file
 * survives until `writeComposedDocument` renames over it.
 *
 * This matters more now than it did: the size cap adds a new way for composition
 * to fail, so the fallback has to actually work.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertComposedDocUsable } from './container-runner.js';
import { PERSONA_PREPEND_FILE, writeComposedDocument } from './group-persona.js';
import type { AgentGroup } from './types.js';

vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

const GROUP = { folder: 'legacy', name: 'Legacy' } as AgentGroup;
const HAND_WRITTEN = '# My agent\n\nBe terse.\n';

let dir: string;
let claudeMd: string;
let persona: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-persona-'));
  claudeMd = path.join(dir, 'CLAUDE.md');
  persona = path.join(dir, PERSONA_PREPEND_FILE);
  fs.writeFileSync(claudeMd, HAND_WRITTEN);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** The migration step as the composer performs it: copy, never rename. */
function migrate(): void {
  fs.copyFileSync(claudeMd, persona, fs.constants.COPYFILE_EXCL);
}

describe('migration then a FAILED composition', () => {
  it('leaves a usable document to fall back on', () => {
    migrate();

    // Composition threw here. The old document must still be readable.
    expect(() => assertComposedDocUsable(claudeMd, GROUP, new Error('compose failed'))).not.toThrow();
  });

  it('keeps the document intact, not truncated', () => {
    migrate();

    expect(fs.readFileSync(claudeMd, 'utf-8')).toBe(HAND_WRITTEN);
  });

  it('still captures the persona, so the next spawn composes with it', () => {
    migrate();

    expect(fs.readFileSync(persona, 'utf-8')).toBe(HAND_WRITTEN);
  });

  // The pre-fix behaviour, asserted directly against the primitive it broke:
  // with a rename there is nothing left to fall back on.
  it('is exactly what a rename would have destroyed', () => {
    fs.renameSync(claudeMd, persona);

    expect(() => assertComposedDocUsable(claudeMd, GROUP, new Error('compose failed'))).toThrow(
      /no usable document exists/,
    );
  });
});

describe('migration then a SUCCESSFUL composition', () => {
  it('replaces the legacy document — publication renames over it', () => {
    migrate();

    writeComposedDocument(claudeMd, '<!-- Composed at spawn -->\n\n# Composed\n');

    const after = fs.readFileSync(claudeMd, 'utf-8');
    expect(after).toContain('# Composed');
    expect(after).not.toContain('Be terse.');
  });

  it('leaves no duplicate copy behind', () => {
    migrate();
    writeComposedDocument(claudeMd, '<!-- Composed at spawn -->\n\n# Composed\n');

    expect(fs.readdirSync(dir).sort()).toEqual(['CLAUDE.md', PERSONA_PREPEND_FILE]);
  });
});

/**
 * The cases above exercise the primitives; the defect lived in
 * `composeCoworkerClaudeMd`, which is not exported. Without this, reintroducing
 * the rename at the real call site would leave every test above green.
 */
describe('the call site itself', () => {
  const SOURCE = fs.readFileSync(new URL('./container-runner.ts', import.meta.url), 'utf-8');
  const migration = SOURCE.slice(
    SOURCE.indexOf('async function composeCoworkerClaudeMd'),
    SOURCE.indexOf('/** Resolve the coworker manifest once'),
  );

  it('copies the legacy document instead of renaming it', () => {
    expect(migration).toMatch(/copyFileSync\(claudeMdPath, personaPath, fs\.constants\.COPYFILE_EXCL\)/);
  });

  it('no longer renames CLAUDE.md out from under composition', () => {
    expect(migration).not.toMatch(/renameSync\(claudeMdPath/);
  });

  // Ordering is the whole fix: the copy has to precede composition, and the
  // fallback has to come after it.
  it('migrates before composing and asserts usability after', () => {
    const copyAt = migration.indexOf('copyFileSync(claudeMdPath');
    const composeAt = migration.indexOf('await renderComposedDocument(agentGroup)');
    // The CALL, not the mention: this function's comments name
    // `assertComposedDocUsable` above the copy, so a bare substring search finds
    // the prose and reports the wrong order.
    const assertAt = migration.indexOf('assertComposedDocUsable(claudeMdPath, agentGroup, err)');

    expect(copyAt).toBeGreaterThan(-1);
    expect(copyAt).toBeLessThan(composeAt);
    expect(composeAt).toBeLessThan(assertAt);
  });
});

describe('COPYFILE_EXCL', () => {
  // The composer checks `!existsSync(personaPath)` before migrating. EXCL closes
  // the gap between that check and this write: an existing persona is a file
  // someone else authored, and overwriting it would lose their instructions.
  it('refuses to overwrite an existing persona', () => {
    fs.writeFileSync(persona, 'authored elsewhere\n');

    expect(() => migrate()).toThrow(/EEXIST/);
    expect(fs.readFileSync(persona, 'utf-8')).toBe('authored elsewhere\n');
  });
});
