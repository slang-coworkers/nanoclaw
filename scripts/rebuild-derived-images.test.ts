import { describe, expect, it } from 'vitest';

import {
  classifyDerivedImages,
  parseArgs,
  selectForRebuild,
  summarize,
  type DerivedImage,
  type InspectImage,
} from './rebuild-derived-images.js';

const BASE = 'nanoclaw-agent-v2-abcd1234';
const CURRENT = 'sha256:' + 'a'.repeat(64);
const OLD = 'sha256:' + 'b'.repeat(64);

/** A fake runtime: tag -> { created, derivedFrom }; unknown tags do not exist. */
function fakeInspect(images: Record<string, { created: string; derivedFrom: string }>): InspectImage {
  return (ref, format) => {
    const img = images[ref];
    if (!img) return '';
    if (format === '{{.Created}}') return img.created;
    if (format.includes('derived-from')) return img.derivedFrom;
    return '';
  };
}

const rows = [
  { agent_group_id: 'ag-fresh', image_tag: `${BASE}:ag-fresh` },
  { agent_group_id: 'ag-stale', image_tag: `${BASE}:ag-stale` },
  { agent_group_id: 'ag-missing', image_tag: `${BASE}:ag-missing` },
  { agent_group_id: 'ag-unpinned', image_tag: null },
  { agent_group_id: 'ag-foreign', image_tag: 'registry.example/custom:1' },
];

const inspect = fakeInspect({
  [`${BASE}:ag-fresh`]: { created: '2026-11-04T11:56:25.000Z', derivedFrom: CURRENT },
  [`${BASE}:ag-stale`]: { created: '2026-10-16T07:35:55.000Z', derivedFrom: OLD },
  'registry.example/custom:1': { created: '2026-01-01T00:00:00.000Z', derivedFrom: '' },
});

describe('classifyDerivedImages', () => {
  it('reports FRESH, STALE and MISSING for pinned derived images and skips the rest', () => {
    const result = classifyDerivedImages(rows, BASE, CURRENT, inspect);
    expect(result.map((r) => [r.agentGroupId, r.state])).toEqual([
      ['ag-fresh', 'FRESH'],
      ['ag-stale', 'STALE'],
      ['ag-missing', 'MISSING'],
    ]);
    expect(result[2].created).toBe('');
  });

  it('restricts to the given agent group ids', () => {
    const result = classifyDerivedImages(rows, BASE, CURRENT, inspect, new Set(['ag-stale']));
    expect(result.map((r) => r.agentGroupId)).toEqual(['ag-stale']);
  });

  it('leaves an operator-supplied pin alone even when its id is requested', () => {
    const result = classifyDerivedImages(rows, BASE, CURRENT, inspect, new Set(['ag-foreign']));
    expect(result).toEqual([]);
  });
});

describe('selectForRebuild', () => {
  const images = classifyDerivedImages(rows, BASE, CURRENT, inspect);

  it('rebuilds stale and missing images only', () => {
    expect(selectForRebuild(images, false).map((i) => i.agentGroupId)).toEqual(['ag-stale', 'ag-missing']);
  });

  it('rebuilds everything with --force', () => {
    expect(selectForRebuild(images, true).map((i) => i.agentGroupId)).toEqual(['ag-fresh', 'ag-stale', 'ag-missing']);
  });
});

describe('parseArgs', () => {
  it('separates flags from agent group ids', () => {
    const opts = parseArgs(['--dry-run', 'ag-1', '--force', 'ag-2']);
    expect(opts.dryRun).toBe(true);
    expect(opts.force).toBe(true);
    expect([...opts.only]).toEqual(['ag-1', 'ag-2']);
  });
});

describe('summarize', () => {
  it('counts each state and marks dry runs', () => {
    const images: DerivedImage[] = classifyDerivedImages(rows, BASE, CURRENT, inspect);
    expect(summarize(images, 0, 0, true)).toBe(
      'derived images: 3 pinned, 1 fresh, 1 stale, 1 missing, 0 rebuilt, 0 failed (dry run)',
    );
  });
});
