import { describe, expect, it } from 'vitest';

import { __dashPerfTestHooks } from './server.js';

// dash-perf round 2: the live channel broadcasts revisioned `state-delta`
// frames computed by diffing the previous published snapshot against the
// current one. These pure-function tests pin the diff semantics the client's
// applyStateDelta() relies on: only the changed keyed objects travel, removals
// are reported by key, the server's key ORDER travels so the client can
// reproduce the array exactly, and an unchanged snapshot yields an empty delta
// (which the broadcaster sends as nothing).
const { diffStable, isEmptyDelta, stateEpoch } = __dashPerfTestHooks;

function cw(folder: string, extra: Record<string, unknown> = {}): any {
  return { folder, name: folder, status: 'idle', ...extra };
}
function grp(id: string, extra: Record<string, unknown> = {}): any {
  return { id, folder: id, name: id, ...extra };
}

/**
 * Reference implementation of the CLIENT half of the protocol, mirroring
 * applyStateDelta / adoptSnapshot / drainBufferedDeltas in
 * `dashboard/public/app.js` and `dashboard/public/mobile.js`. Those are browser
 * scripts with no module boundary vitest can import, so this stands in as the
 * executable spec: any server-side change that breaks reconciliation (dropping
 * the key order, forgetting the epoch, bumping revs the client can't chain)
 * fails here.
 */
class ClientState {
  state: { coworkers: any[]; registeredGroups: any[]; maxConcurrentContainers?: number } = {
    coworkers: [],
    registeredGroups: [],
  };
  rev = 0;
  epoch: string | null = null;
  barrier = false;
  buffered: any[] = [];
  resyncs = 0;

  private mergeKeyed(current: any[], change: any, keyOf: (x: any) => string): any[] | null {
    const map = new Map<string, any>((current || []).map((item) => [keyOf(item), item]));
    for (const item of change.upsert || []) map.set(keyOf(item), item);
    for (const key of change.remove || []) map.delete(String(key));
    if (!Array.isArray(change.order)) return Array.from(map.values());
    const ordered: any[] = [];
    for (const key of change.order) {
      const item = map.get(String(key));
      if (item !== undefined) ordered.push(item);
    }
    if (ordered.length !== map.size || ordered.length !== change.order.length) return null;
    return ordered;
  }

  private applyPatch(delta: any): boolean {
    const nextCoworkers = delta.coworkers
      ? this.mergeKeyed(this.state.coworkers, delta.coworkers, (c) => String(c.folder))
      : this.state.coworkers;
    if (nextCoworkers === null) return false;
    const nextGroups = delta.registeredGroups
      ? this.mergeKeyed(this.state.registeredGroups, delta.registeredGroups, (g) => String(g.id))
      : this.state.registeredGroups;
    if (nextGroups === null) return false;
    this.state = { ...this.state, ...delta.fields, coworkers: nextCoworkers, registeredGroups: nextGroups };
    this.rev = delta.rev;
    if (typeof delta.stateEpoch === 'string') this.epoch = delta.stateEpoch;
    return true;
  }

  applyDelta(delta: any): void {
    if (this.barrier) {
      this.buffered.push(delta);
      return;
    }
    const epochMismatch = typeof delta.stateEpoch === 'string' && delta.stateEpoch !== this.epoch;
    if (epochMismatch || delta.baseRev !== this.rev || !this.applyPatch(delta)) {
      this.buffered.push(delta);
      this.startResync();
    }
  }

  startResync(): void {
    this.barrier = true;
    this.resyncs += 1;
  }

  /** Adopt a full snapshot and drain whatever queued behind the barrier. */
  adoptSnapshot(snapshot: any): void {
    const epoch = typeof snapshot.stateEpoch === 'string' ? snapshot.stateEpoch : null;
    const rev = typeof snapshot.stateRev === 'number' ? snapshot.stateRev : null;
    // A delayed response that would rewind us is discarded, not applied.
    if (!(epoch !== null && epoch === this.epoch && rev !== null && rev < this.rev)) {
      this.state = {
        coworkers: snapshot.coworkers,
        registeredGroups: snapshot.registeredGroups,
        maxConcurrentContainers: snapshot.maxConcurrentContainers,
      };
      this.rev = rev ?? this.rev;
      this.epoch = epoch ?? this.epoch;
    }
    this.barrier = false;
    const pending = this.buffered.slice().sort((a, b) => a.rev - b.rev);
    this.buffered = [];
    let gap = false;
    for (const delta of pending) {
      if (typeof delta.stateEpoch === 'string' && delta.stateEpoch !== this.epoch) {
        gap = true;
        continue;
      }
      if (delta.rev <= this.rev) continue;
      if (delta.baseRev !== this.rev || !this.applyPatch(delta)) {
        gap = true;
        break;
      }
    }
    if (gap) this.startResync();
  }
}

/** Wrap a diff as the frame the server actually broadcasts. */
function frame(delta: any, baseRev: number, rev: number, epoch = stateEpoch()): any {
  return { type: 'state-delta', stateEpoch: epoch, baseRev, rev, ...delta };
}

describe('state-delta diff (dash-perf round 2)', () => {
  it('emits an empty delta when nothing changed', () => {
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [grp('g1')], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('a'), cw('b')], registeredGroups: [grp('g1')], maxConcurrentContainers: 4 };
    const d = diffStable(prev, next);
    expect(isEmptyDelta(d)).toBe(true);
    expect(d.coworkers.upsert).toEqual([]);
    expect(d.coworkers.remove).toEqual([]);
    expect(d.coworkers.orderChanged).toBe(false);
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

describe('state-delta ordering (codex round-2 #4)', () => {
  it('a pure reorder is NOT an empty delta and carries the new key order', () => {
    const prev = { coworkers: [cw('a'), cw('b'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('c'), cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const d = diffStable(prev, next);
    // No item changed, so upsert/remove are empty — order is the only signal.
    expect(d.coworkers.upsert).toEqual([]);
    expect(d.coworkers.remove).toEqual([]);
    expect(d.coworkers.orderChanged).toBe(true);
    expect(d.coworkers.order).toEqual(['c', 'a', 'b']);
    expect(isEmptyDelta(d)).toBe(false);
  });

  it('client reconstruction matches the server array exactly when an item is inserted mid-array', () => {
    // The round-2 regression: [A,B] → [A,C,B] ships only an upsert for C. A
    // key-merge alone yields [A,B,C] — same contents, wrong desks.
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('a'), cw('c'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const client = new ClientState();
    client.adoptSnapshot({ ...prev, stateEpoch: stateEpoch(), stateRev: 1 });

    client.applyDelta(frame(diffStable(prev, next), 1, 2));

    expect(client.rev).toBe(2);
    expect(client.resyncs).toBe(0);
    expect(client.state.coworkers.map((c: any) => c.folder)).toEqual(['a', 'c', 'b']);
    expect(client.state.coworkers).toEqual(next.coworkers);
  });
});

describe('state-delta epoch gating (codex round-2 #1)', () => {
  it('exposes a non-empty per-process epoch', () => {
    expect(typeof stateEpoch()).toBe('string');
    expect(stateEpoch().length).toBeGreaterThan(0);
    expect(stateEpoch()).toBe(stateEpoch()); // stable within the process
  });

  it('rejects a delta from a different server instance even when the revs chain', () => {
    // Old process left the client at rev 1 holding coworker A. The new process
    // starts its own baseline (also rev 1) WITHOUT A, then broadcasts
    // {baseRev:1, rev:2} for an unrelated coworker B. Without epoch gating the
    // numbers match, the client accepts it, and A is pinned forever — the new
    // server's deltas can never remove a row its baseline never had.
    const client = new ClientState();
    client.adoptSnapshot({
      coworkers: [cw('a')],
      registeredGroups: [],
      maxConcurrentContainers: 4,
      stateEpoch: 'epoch-old',
      stateRev: 1,
    });

    const newPrev = { coworkers: [], registeredGroups: [], maxConcurrentContainers: 4 };
    const newNext = { coworkers: [cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(newPrev, newNext), 1, 2, 'epoch-new'));

    // Not applied; a resync was requested instead.
    expect(client.resyncs).toBe(1);
    expect(client.barrier).toBe(true);
    expect(client.state.coworkers.map((c: any) => c.folder)).toEqual(['a']);

    // The resync's snapshot is what removes the stale coworker.
    client.adoptSnapshot({ ...newNext, stateEpoch: 'epoch-new', stateRev: 2 });
    expect(client.state.coworkers.map((c: any) => c.folder)).toEqual(['b']);
    expect(client.epoch).toBe('epoch-new');
    expect(client.rev).toBe(2);
  });
});

describe('resync barrier (codex round-2 #2)', () => {
  const base = { coworkers: [cw('a')], registeredGroups: [], maxConcurrentContainers: 4 };

  it('replays a delta that arrived while the snapshot was in flight', () => {
    const client = new ClientState();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 5 });

    // Client misses 5→6, so 6→7 cannot be applied: barrier goes up, and the
    // delta is BUFFERED rather than dropped (dropping it is how the old code
    // stranded the client — the rev-6 snapshot hides the fact that 7 exists).
    const s6 = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const s7 = { coworkers: [cw('a'), cw('b'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(s6, s7), 6, 7));
    expect(client.barrier).toBe(true);
    expect(client.buffered).toHaveLength(1);

    // The (delayed) snapshot lands at rev 6; the buffered 6→7 now chains.
    client.adoptSnapshot({ ...s6, stateEpoch: stateEpoch(), stateRev: 6 });
    expect(client.rev).toBe(7);
    expect(client.state.coworkers.map((c: any) => c.folder)).toEqual(['a', 'b', 'c']);
    expect(client.barrier).toBe(false);
  });

  it('discards a buffered delta the snapshot already covers', () => {
    const client = new ClientState();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 5 });
    const s6 = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(base, s6), 5, 6));
    expect(client.rev).toBe(6);

    // Force a barrier and let a stale rev-6 delta queue behind it.
    client.startResync();
    client.applyDelta(frame(diffStable(base, s6), 5, 6));
    client.adoptSnapshot({ ...s6, stateEpoch: stateEpoch(), stateRev: 7 });
    expect(client.rev).toBe(7);
    expect(client.buffered).toHaveLength(0);
  });

  it('never rewinds when a delayed snapshot is older than the applied revision', () => {
    const client = new ClientState();
    const s6 = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.adoptSnapshot({ ...s6, stateEpoch: stateEpoch(), stateRev: 6 });
    const s7 = { coworkers: [cw('a'), cw('b'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(s6, s7), 6, 7));
    expect(client.rev).toBe(7);

    // An /api/state response captured at rev 6 finally arrives.
    client.adoptSnapshot({ ...s6, stateEpoch: stateEpoch(), stateRev: 6 });
    expect(client.rev).toBe(7);
    expect(client.state.coworkers.map((c: any) => c.folder)).toEqual(['a', 'b', 'c']);
  });

  it('requests another resync when the buffered deltas still leave a hole', () => {
    const client = new ClientState();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 5 });
    const s7 = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const s8 = { coworkers: [cw('a'), cw('b'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(s7, s8), 7, 8)); // baseRev 7 ≠ 5 → barrier
    const before = client.resyncs;
    // Snapshot lands at rev 6, so the buffered 7→8 still doesn't chain.
    client.adoptSnapshot({ ...s7, stateEpoch: stateEpoch(), stateRev: 6 });
    expect(client.resyncs).toBe(before + 1);
    expect(client.barrier).toBe(true);
  });
});
