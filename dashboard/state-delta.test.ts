import { describe, expect, it } from 'vitest';

import { __dashPerfTestHooks } from './server.js';

// dash-perf round 2: the live channel broadcasts revisioned `state-delta`
// frames computed by diffing the previous published snapshot against the
// current one. These pure-function tests pin the diff semantics the client's
// applyStateDelta() relies on: only the changed keyed objects travel, removals
// are reported by key, and an unchanged snapshot yields an empty delta (which
// the broadcaster sends as nothing).
const { diffStable, isEmptyDelta } = __dashPerfTestHooks;

function cw(folder: string, extra: Record<string, unknown> = {}): any {
  return { folder, name: folder, status: 'idle', ...extra };
}
function grp(id: string, extra: Record<string, unknown> = {}): any {
  return { id, folder: id, name: id, ...extra };
}

describe('state-delta diff (dash-perf round 2)', () => {
  it('emits an empty delta when nothing changed', () => {
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [grp('g1')], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('a'), cw('b')], registeredGroups: [grp('g1')], maxConcurrentContainers: 4 };
    const d = diffStable(prev, next);
    expect(isEmptyDelta(d)).toBe(true);
    expect(d.coworkers.upsert).toEqual([]);
    expect(d.coworkers.remove).toEqual([]);
    expect(d.fields).toEqual({});
  });

  it('upserts only the changed coworker, keyed by folder', () => {
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = {
      coworkers: [cw('a'), cw('b', { status: 'working' })],
      registeredGroups: [],
      maxConcurrentContainers: 4,
    };
    const d = diffStable(prev, next);
    expect(isEmptyDelta(d)).toBe(false);
    expect(d.coworkers.upsert.map((c: any) => c.folder)).toEqual(['b']);
    expect(d.coworkers.upsert[0].status).toBe('working');
    expect(d.coworkers.remove).toEqual([]);
  });

  it('reports a removed coworker by folder and a newly added one as an upsert', () => {
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('a'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    const d = diffStable(prev, next);
    expect(d.coworkers.remove).toEqual(['b']);
    expect(d.coworkers.upsert.map((c: any) => c.folder)).toEqual(['c']);
  });

  it('diffs registered groups by id and surfaces changed scalar fields', () => {
    const prev = { coworkers: [], registeredGroups: [grp('g1'), grp('g2')], maxConcurrentContainers: 4 };
    const next = { coworkers: [], registeredGroups: [grp('g1', { name: 'renamed' })], maxConcurrentContainers: 6 };
    const d = diffStable(prev, next);
    expect(d.registeredGroups.upsert.map((g: any) => g.id)).toEqual(['g1']);
    expect(d.registeredGroups.remove).toEqual(['g2']);
    expect(d.fields).toEqual({ maxConcurrentContainers: 6 });
  });
});
