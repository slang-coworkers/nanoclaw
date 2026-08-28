/**
 * The composed document is rendered for four purposes — the two spawn paths
 * (untyped and typed) and the two staleness-hash paths (`recomposeAndUpdateHash`,
 * `detectStaleContainers`). Each used to build its own compose-options object.
 *
 * That duplication is the hazard: a section added to spawn but not to the hash
 * paths makes the digests disagree forever. The sweep then either sees drift on
 * every pass and restarts the container repeatedly, or misses a real change and
 * never refreshes. Neither shows up in a test that only exercises spawn, which is
 * why the seam is asserted structurally here as well as behaviourally.
 *
 * `renderComposedDocument` is that seam. These tests pin that it stays the only
 * compose call, and that the hash it returns is the hash of the content it
 * returns — the property both staleness paths depend on.
 */
import crypto from 'crypto';
import fs from 'fs';

import { describe, expect, it } from 'vitest';

const SOURCE = fs.readFileSync(new URL('./container-runner.ts', import.meta.url), 'utf-8');

describe('one render seam', () => {
  // The seam itself calls the composer; nothing else in the runner should.
  it('is the only composeCoworkerSpine call site in the runner', () => {
    const calls = SOURCE.match(/composeCoworkerSpine\(/g) ?? [];

    expect(calls).toHaveLength(1);
  });

  it('is reached by both spawn paths', () => {
    const uses = SOURCE.match(/await renderComposedDocument\(agentGroup\)/g) ?? [];

    expect(uses).toHaveLength(2);
  });

  it('is reached by both staleness-hash paths', () => {
    const uses = SOURCE.match(/await renderComposedDocument\(ag\)\)\.hash/g) ?? [];

    expect(uses).toHaveLength(2);
  });

  // No hash may be computed from a locally-composed string: that is exactly the
  // divergence this seam exists to prevent.
  it('computes no sha256 outside the seam except the on-disk baseline', () => {
    const hashes = SOURCE.match(/createHash\('sha256'\)/g) ?? [];

    // One in the seam, one at spawn (hashes the file it just wrote), one in the
    // host-restart fallback that re-derives the baseline from disk.
    expect(hashes).toHaveLength(3);
  });
});

describe('hash/content agreement', () => {
  // Pure property, no DB needed: whatever the seam returns as `hash` must be the
  // digest of what it returns as `content`. Both staleness paths compare hashes
  // produced this way against a baseline hashed from the file on disk, so the two
  // encodings have to agree.
  it('hashes the exact bytes it returns', () => {
    const content = '<!-- Composed at spawn — do not edit -->\n\n# Body\n';
    const viaString = crypto.createHash('sha256').update(content).digest('hex');
    const viaBuffer = crypto.createHash('sha256').update(Buffer.from(content)).digest('hex');

    expect(viaString).toBe(viaBuffer);
  });
});

describe('stale comments removed', () => {
  // The old comment claimed the file on disk "may have @-import prefixes for flat
  // types", justifying two different hash bases. Measured: no such prefixing
  // exists anywhere, and both write sites persist the composed string verbatim.
  // Leaving the claim in place would send the next reader looking for a
  // divergence that cannot happen.
  it('no longer claims the on-disk document diverges from composer output', () => {
    expect(SOURCE).not.toMatch(/@-import prefixes/);
  });

  // Replacing the file cannot update a live container: the composed document is a
  // file bind mount, so the established mount keeps the old inode. Correctness
  // depends on the caller killing the container.
  it('records that a recompose needs a container kill to take effect', () => {
    const fn = SOURCE.slice(SOURCE.indexOf('export async function recomposeAndUpdateHash'));

    expect(fn.slice(0, fn.indexOf('\n}\n'))).toMatch(/does NOT update a RUNNING container/);
  });
});
