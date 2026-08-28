/**
 * `CLAUDE.md` is the OUTPUT of composition; `instructions.prepend.md` is one
 * INPUT to it. Conflating them compounds the document on every spawn: a composed
 * CLAUDE.md migrated into the persona slot gets re-composed into the next
 * CLAUDE.md, which is then itself migratable.
 *
 * The marker is what makes the two distinguishable, so these tests pin the
 * marker's presence, its stability across spawns (it feeds a sha256 staleness
 * hash), and the classifier that reads it.
 */
import { describe, it, expect } from 'vitest';

import { composeCoworkerSpine } from './claude-composer.js';
import { COMPOSED_DOC_MARKER, isComposedDocument } from './group-persona.js';

describe('composed-document marker', () => {
  it('opens every composed document', () => {
    const doc = composeCoworkerSpine({ coworkerType: 'default' });

    expect(doc.startsWith(COMPOSED_DOC_MARKER)).toBe(true);
    expect(isComposedDocument(doc)).toBe(true);
  });

  // `main` is `flat: true` and does not extend base-common, so it renders down a
  // different path — the marker must not be lost there.
  it('opens a flat coworker type too', () => {
    const doc = composeCoworkerSpine({ coworkerType: 'main' });

    expect(isComposedDocument(doc)).toBe(true);
  });

  // recomposeAndUpdateHash / detectStaleContainers sha256 the composer's output.
  // A timestamp in the marker would make every sweep see drift and restart the
  // container forever.
  it('is byte-stable across successive composes', () => {
    const a = composeCoworkerSpine({ coworkerType: 'default' });
    const b = composeCoworkerSpine({ coworkerType: 'default' });

    expect(a).toBe(b);
  });

  it('survives operator standing instructions being folded in', () => {
    const doc = composeCoworkerSpine({
      coworkerType: 'default',
      extraInstructions: 'You are a terse reporter.',
    });

    expect(isComposedDocument(doc)).toBe(true);
    expect(doc).toContain('You are a terse reporter.');
  });
});

describe('isComposedDocument', () => {
  it('rejects a hand-written persona', () => {
    expect(isComposedDocument('# My agent\n\nBe helpful and concise.\n')).toBe(false);
    expect(isComposedDocument('')).toBe(false);
  });

  // Only the head is inspected: a persona may legitimately *discuss* the marker
  // (this repo's own docs do) without being generated.
  it('ignores the marker when it appears deep in the body', () => {
    const persona = '# Persona\n\n' + 'filler\n'.repeat(200) + `${COMPOSED_DOC_MARKER} -->\n`;

    expect(isComposedDocument(persona)).toBe(false);
  });
});
