/**
 * Claude Code loads a CLAUDE.md up to 4 MiB and SKIPS a larger one. Over the
 * cliff the agent receives no instructions at all — no persona, no invariants,
 * no gate protocol — silently. A group that quietly stops following its own
 * safety rules is worse than one that refuses to start.
 *
 * Reachability is measured, not assumed: the persona (`instructions.prepend.md`)
 * lives in the group directory, mounted READ-WRITE at `/workspace/agent`, so an
 * agent editing its own standing instructions can cross the cliff by itself.
 *
 * The divergence from upstream's `fitToCap` is the interesting part, so it is
 * pinned here: upstream evicts the largest droppable section repeatedly, which
 * works only when droppable sections hold the bulk. On this fork they hold
 * nothing, and the one section that IS large in the overflow case is the persona,
 * which must never be evicted. See the module docstring.
 */
import { describe, expect, it, vi } from 'vitest';

import { PROJECT_DOC_MAX_BYTES, ProjectDocTooLargeError, assertWithinDocSizeCap } from './doc-size-cap.js';

vi.mock('../log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

const doc = (bytes: number): string => 'x'.repeat(bytes);

describe('the cap value', () => {
  // Not a policy knob: it is a property of the consumer. A configurable cap would
  // only let someone raise it past the point where the CLI stops reading at all.
  it('is Claude Code’s documented 4 MiB', () => {
    expect(PROJECT_DOC_MAX_BYTES).toBe(4 * 1024 * 1024);
  });
});

describe('within the cap', () => {
  it('accepts a document at the limit exactly', () => {
    expect(() => assertWithinDocSizeCap(doc(PROJECT_DOC_MAX_BYTES), 'g')).not.toThrow();
  });

  it('accepts a typical document', () => {
    expect(() => assertWithinDocSizeCap('# Coworker\n\n## Identity\n\nHi.\n', 'g')).not.toThrow();
  });
});

describe('over the cap', () => {
  it('throws one byte over', () => {
    expect(() => assertWithinDocSizeCap(doc(PROJECT_DOC_MAX_BYTES + 1), 'g')).toThrow(ProjectDocTooLargeError);
  });

  it('reports the actual and permitted sizes', () => {
    try {
      assertWithinDocSizeCap(doc(PROJECT_DOC_MAX_BYTES + 10), 'g');
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as ProjectDocTooLargeError;
      expect(e.bytes).toBe(PROJECT_DOC_MAX_BYTES + 10);
      expect(e.maxBytes).toBe(PROJECT_DOC_MAX_BYTES);
    }
  });

  // The operator has to know WHICH section blew the budget, or the only remedy is
  // guesswork against a 4 MB file.
  it('names the largest sections', () => {
    const content = `## Small\n\ntiny\n\n## Huge\n\n${'y'.repeat(PROJECT_DOC_MAX_BYTES)}\n`;

    try {
      assertWithinDocSizeCap(content, 'g');
      expect.unreachable('should have thrown');
    } catch (err) {
      const e = err as ProjectDocTooLargeError;
      expect(e.sections[0].section).toBe('Huge');
      expect(e.message).toContain('Huge');
    }
  });

  // Bytes, not characters: a multi-byte document would otherwise pass a
  // character-length check and still be skipped by the consumer.
  it('measures UTF-8 bytes, not string length', () => {
    // Each 'é' is 2 bytes, so half the cap in chars is exactly the cap in bytes.
    const atCap = 'é'.repeat(PROJECT_DOC_MAX_BYTES / 2);
    expect(atCap.length).toBeLessThan(PROJECT_DOC_MAX_BYTES);

    expect(() => assertWithinDocSizeCap(atCap + 'é', 'g')).toThrow(ProjectDocTooLargeError);
  });
});

describe('refusing rather than degrading', () => {
  // Upstream's fitToCap returns a shortened document. This throws, so the caller's
  // catch reaches `assertComposedDocUsable`: an existing group keeps spawning on
  // its previous document, and a fresh group with none is refused loudly.
  //
  // Silently returning a document with the persona evicted would relocate the
  // failure rather than fix it — the agent would run without its own
  // instructions, which is exactly what the cap exists to prevent.
  it('never returns a shortened document', () => {
    const huge = doc(PROJECT_DOC_MAX_BYTES + 1);

    // Signature is void: there is no shortened value to return by construction.
    expect(() => assertWithinDocSizeCap(huge, 'g')).toThrow();
  });
});

describe('warning before it is fatal', () => {
  it('warns within an eighth of the cap', async () => {
    const { log } = await import('../log.js');
    vi.mocked(log.warn).mockClear();

    assertWithinDocSizeCap(doc(PROJECT_DOC_MAX_BYTES - 1000), 'g');

    expect(log.warn).toHaveBeenCalledOnce();
  });

  it('stays quiet with headroom', async () => {
    const { log } = await import('../log.js');
    vi.mocked(log.warn).mockClear();

    assertWithinDocSizeCap(doc(1000), 'g');

    expect(log.warn).not.toHaveBeenCalled();
  });

  it('logs at error level when it refuses', async () => {
    const { log } = await import('../log.js');
    vi.mocked(log.error).mockClear();

    expect(() => assertWithinDocSizeCap(doc(PROJECT_DOC_MAX_BYTES + 1), 'gname')).toThrow();

    expect(log.error).toHaveBeenCalledOnce();
    expect(vi.mocked(log.error).mock.calls[0][1]).toMatchObject({ folder: 'gname' });
  });
});

describe('purity', () => {
  // The staleness sweep and spawn both hash the composed string through
  // `renderComposedDocument`. A size decision that varied between those two calls
  // would make the digests disagree forever and respawn the container every 60s.
  it('is a pure function of the content', () => {
    const content = doc(1000);

    for (let i = 0; i < 3; i++) expect(() => assertWithinDocSizeCap(content, 'g')).not.toThrow();
    for (let i = 0; i < 3; i++) expect(() => assertWithinDocSizeCap(doc(PROJECT_DOC_MAX_BYTES + 1), 'g')).toThrow();
  });
});
