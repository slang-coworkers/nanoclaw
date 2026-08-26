import { describe, expect, it, vi } from 'vitest';

import { __dashPerfTestHooks } from './server.js';
// Side-effect import: state-sync.js is a classic browser script (no import /
// export) that installs `globalThis.NanoclawStateSync`. Importing it here means
// these tests drive the SAME reconciliation code `app.js` and `mobile.js` run —
// the previous hand-written `ClientState` copy could (and did) pass while the
// shipped clients diverged.
import './public/state-sync.js';

// dash-perf round 2: the live channel broadcasts revisioned `state-delta`
// frames computed by diffing the previous published snapshot against the
// current one. These tests pin BOTH halves of that protocol: the server diff
// (pure functions) and the client reconciliation (the shared module).
const { diffStable, isEmptyDelta, stateEpoch, createScanHandoff } = __dashPerfTestHooks;
const { createStateSync } = (globalThis as any).NanoclawStateSync;

function cw(folder: string, extra: Record<string, unknown> = {}): any {
  return { folder, name: folder, status: 'idle', ...extra };
}
function grp(id: string, extra: Record<string, unknown> = {}): any {
  return { id, folder: id, name: id, ...extra };
}

/**
 * Browser-free harness around the REAL client reconciliation module. It supplies
 * only what a page supplies — a state container, an HTTP-resync trigger and a
 * live-channel reconnect — so everything under test (epoch gating, order proof,
 * buffering, snapshot generations) is production code.
 */
class Client {
  state: any = { coworkers: [], registeredGroups: [] };
  resyncs = 0;
  reconnects = 0;
  sync: any;

  constructor() {
    this.sync = createStateSync({
      getState: () => this.state,
      applyState: (patch: any) => {
        this.state = { ...this.state, ...patch };
      },
      startResync: () => {
        this.resyncs += 1;
        this.sync.beginResync();
      },
      reconnectLive: () => {
        this.reconnects += 1;
      },
    });
  }

  get rev(): number {
    return this.sync.sync.rev;
  }
  get epoch(): string | null {
    return this.sync.sync.epoch;
  }
  get barrier(): boolean {
    return this.sync.sync.barrier;
  }
  get buffered(): any[] {
    return this.sync.sync.buffered;
  }
  get folders(): string[] {
    return (this.state.coworkers || []).map((c: any) => c.folder);
  }

  applyDelta(delta: any): void {
    this.sync.applyStateDelta(delta);
  }
  /** In-stream snapshot (WS/SSE `state` frame): no generation token. */
  adoptSnapshot(snapshot: any): void {
    this.sync.adoptSnapshot(snapshot);
  }
  /** Start an HTTP resync and get back the token its response must carry. */
  beginHttpResync(): number {
    this.resyncs += 1;
    return this.sync.beginResync();
  }
  adoptHttpSnapshot(snapshot: any, generation: number): boolean {
    return this.sync.adoptSnapshot(snapshot, generation);
  }
  startResync(): void {
    this.resyncs += 1;
    this.sync.beginResync();
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

describe('state-delta ordering (codex round-2 #4 / round-2 residual F)', () => {
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

  it('omits the O(fleet) order array when the order did not change', () => {
    // The whole point of the delta protocol is that a one-coworker status change
    // costs one object — not two full key lists of the fleet.
    const prev = {
      coworkers: [cw('a'), cw('b'), cw('c')],
      registeredGroups: [grp('g1'), grp('g2')],
      maxConcurrentContainers: 4,
    };
    const next = {
      coworkers: [cw('a'), cw('b', { status: 'working' }), cw('c')],
      registeredGroups: [grp('g1'), grp('g2')],
      maxConcurrentContainers: 4,
    };
    const d = diffStable(prev, next);
    expect(d.coworkers.orderChanged).toBe(false);
    expect(d.coworkers.order).toBeUndefined();
    expect(d.registeredGroups.order).toBeUndefined();
    expect(JSON.stringify(d)).not.toContain('"order"');
  });

  it('a membership change always carries the order (the client cannot place a new key alone)', () => {
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('a'), cw('c'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const d = diffStable(prev, next);
    expect(d.coworkers.orderChanged).toBe(true);
    expect(d.coworkers.order).toEqual(['a', 'c', 'b']);
  });

  it('client reconstruction matches the server array exactly when an item is inserted mid-array', () => {
    // The round-2 regression: [A,B] → [A,C,B] ships only an upsert for C. A
    // key-merge alone yields [A,B,C] — same contents, wrong desks.
    const prev = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = { coworkers: [cw('a'), cw('c'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    const client = new Client();
    client.adoptSnapshot({ ...prev, stateEpoch: stateEpoch(), stateRev: 1 });

    client.applyDelta(frame(diffStable(prev, next), 1, 2));

    expect(client.rev).toBe(2);
    expect(client.resyncs).toBe(0);
    expect(client.folders).toEqual(['a', 'c', 'b']);
    expect(client.state.coworkers).toEqual(next.coworkers);
  });

  it('an order-free value delta preserves the array order the snapshot established', () => {
    const prev = { coworkers: [cw('a'), cw('b'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    const next = {
      coworkers: [cw('a'), cw('b', { status: 'working' }), cw('c')],
      registeredGroups: [],
      maxConcurrentContainers: 4,
    };
    const client = new Client();
    client.adoptSnapshot({ ...prev, stateEpoch: stateEpoch(), stateRev: 1 });

    client.applyDelta(frame(diffStable(prev, next), 1, 2));

    expect(client.resyncs).toBe(0);
    expect(client.folders).toEqual(['a', 'b', 'c']);
    expect(client.state.coworkers).toEqual(next.coworkers);
  });
});

describe('protocol fails closed (codex round-2 residual G)', () => {
  const base = { coworkers: [cw('a')], registeredGroups: [], maxConcurrentContainers: 4 };
  const nextState = { coworkers: [cw('a', { status: 'working' })], registeredGroups: [], maxConcurrentContainers: 4 };

  it('refuses a keyed change that carries neither an order nor orderChanged:false', () => {
    const client = new Client();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 1 });

    const legacy = frame(diffStable(base, nextState), 1, 2);
    delete legacy.coworkers.orderChanged; // mixed-version server: no order, no proof

    client.applyDelta(legacy);
    expect(client.resyncs).toBe(1);
    expect(client.rev).toBe(1); // NOT advanced on an unverifiable frame
    expect(client.state.coworkers[0].status).toBe('idle');
  });

  it('refuses an epochless delta once an epoch-aware baseline is installed', () => {
    const client = new Client();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 1 });

    const epochless: any = frame(diffStable(base, nextState), 1, 2);
    delete epochless.stateEpoch;

    client.applyDelta(epochless);
    expect(client.resyncs).toBe(1);
    expect(client.rev).toBe(1);
  });

  it('refuses a value-only delta that would introduce a key it cannot place', () => {
    const client = new Client();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 1 });

    const forged = frame(
      { coworkers: { upsert: [cw('b')], remove: [], orderChanged: false }, fields: {} },
      1,
      2,
    );
    client.applyDelta(forged);
    expect(client.resyncs).toBe(1);
    expect(client.folders).toEqual(['a']);
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
    const client = new Client();
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
    expect(client.folders).toEqual(['a']);

    // The resync's snapshot is what removes the stale coworker.
    client.adoptSnapshot({ ...newNext, stateEpoch: 'epoch-new', stateRev: 2 });
    expect(client.folders).toEqual(['b']);
    expect(client.epoch).toBe('epoch-new');
    expect(client.rev).toBe(2);
  });
});

describe('cross-epoch snapshot generations (codex round-2 residual B)', () => {
  it('an in-stream snapshot supersedes an OLD-process /api/state response still in flight', () => {
    // The residual: the rewind guard only fires for the SAME epoch, so a delayed
    // response from the process that just died reads as a legitimate epoch change
    // and is applied over newer state. If the new process is idle, no further
    // delta ever arrives to expose it — the UI shows the dead server's fleet
    // forever.
    const client = new Client();
    client.adoptSnapshot({
      coworkers: [cw('a'), cw('b')],
      registeredGroups: [],
      maxConcurrentContainers: 4,
      stateEpoch: 'epoch-old',
      stateRev: 5,
    });

    const generation = client.beginHttpResync(); // request issued to the OLD process
    // Server restarts; the client's live channel reconnects and delivers an
    // ordered in-stream snapshot from the NEW process (coworker b is gone).
    client.adoptSnapshot({
      coworkers: [cw('a')],
      registeredGroups: [],
      maxConcurrentContainers: 4,
      stateEpoch: 'epoch-new',
      stateRev: 1,
    });
    expect(client.folders).toEqual(['a']);
    expect(client.epoch).toBe('epoch-new');

    // ...and only NOW does the old process's response land.
    const settled = client.adoptHttpSnapshot(
      {
        coworkers: [cw('a'), cw('b')],
        registeredGroups: [],
        maxConcurrentContainers: 4,
        stateEpoch: 'epoch-old',
        stateRev: 6,
      },
      generation,
    );

    expect(settled).toBe(true); // the newer snapshot already finished this resync
    expect(client.epoch).toBe('epoch-new');
    expect(client.rev).toBe(1);
    expect(client.folders).toEqual(['a']); // NOT rewound to the dead process's fleet
  });

  it('still adopts an HTTP response whose generation is current', () => {
    const client = new Client();
    const generation = client.beginHttpResync();
    const ok = client.adoptHttpSnapshot(
      { coworkers: [cw('a')], registeredGroups: [], maxConcurrentContainers: 4, stateEpoch: 'e1', stateRev: 3 },
      generation,
    );
    expect(ok).toBe(true);
    expect(client.rev).toBe(3);
    expect(client.barrier).toBe(false);
  });

  it('reports a superseded response as UNSETTLED while the barrier is still up', () => {
    const client = new Client();
    const generation = client.beginHttpResync();
    client.sync.sync.generation += 1; // a newer snapshot request superseded ours
    const ok = client.adoptHttpSnapshot(
      { coworkers: [], registeredGroups: [], maxConcurrentContainers: 4, stateEpoch: 'e1', stateRev: 9 },
      generation,
    );
    expect(ok).toBe(false); // caller must retry — nothing else lifted the barrier
    expect(client.rev).toBe(0);
    expect(client.barrier).toBe(true);
  });
});

describe('resync barrier (codex round-2 #2)', () => {
  const base = { coworkers: [cw('a')], registeredGroups: [], maxConcurrentContainers: 4 };

  it('replays a delta that arrived while the snapshot was in flight', () => {
    const client = new Client();
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
    expect(client.folders).toEqual(['a', 'b', 'c']);
    expect(client.barrier).toBe(false);
  });

  it('discards a buffered delta the snapshot already covers', () => {
    const client = new Client();
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
    const client = new Client();
    const s6 = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.adoptSnapshot({ ...s6, stateEpoch: stateEpoch(), stateRev: 6 });
    const s7 = { coworkers: [cw('a'), cw('b'), cw('c')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(s6, s7), 6, 7));
    expect(client.rev).toBe(7);

    // An /api/state response captured at rev 6 finally arrives.
    const generation = client.sync.sync.generation;
    client.adoptHttpSnapshot({ ...s6, stateEpoch: stateEpoch(), stateRev: 6 }, generation);
    expect(client.rev).toBe(7);
    expect(client.folders).toEqual(['a', 'b', 'c']);
  });

  it('requests another resync when the buffered deltas still leave a hole', () => {
    const client = new Client();
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

describe('bounded replay buffer (codex round-2 residual H)', () => {
  const base = { coworkers: [cw('a')], registeredGroups: [], maxConcurrentContainers: 4 };
  const bumped = { coworkers: [cw('a', { status: 'working' })], registeredGroups: [], maxConcurrentContainers: 4 };

  function floodDeltas(client: Client, count: number, firstRev: number): void {
    for (let i = 0; i < count; i++) {
      const rev = firstRev + i;
      client.applyDelta(frame(diffStable(base, bumped), rev - 1, rev));
    }
  }

  it('recovers in-stream instead of resyncing forever when the buffer overflows', () => {
    const client = new Client();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 1 });
    client.startResync(); // barrier up; everything below queues

    floodDeltas(client, 260, 2); // > MAX_BUFFERED_DELTAS (200)

    // Dropping the OLDEST frames (the old behavior) leaves a hole no HTTP
    // snapshot can bridge: every response lands behind the earliest retained
    // delta, so the client resyncs forever. Instead the queue is abandoned and
    // the live channel reopened for an ORDERED in-stream snapshot.
    expect(client.reconnects).toBe(1);
    expect(client.buffered).toHaveLength(0);
    expect(client.sync.sync.unreplayable).toBe(true);

    // More deltas while unreplayable must not regrow the queue.
    floodDeltas(client, 50, 262);
    expect(client.buffered).toHaveLength(0);
    expect(client.reconnects).toBe(1); // one reconnect per episode, no storm

    // The reconnect's in-stream snapshot is at/after everything we dropped.
    client.adoptSnapshot({ ...bumped, stateEpoch: stateEpoch(), stateRev: 400 });
    expect(client.sync.sync.unreplayable).toBe(false);
    expect(client.barrier).toBe(false);
    expect(client.rev).toBe(400);

    // ...and the stream is healthy again.
    const s401 = { coworkers: [cw('a'), cw('b')], registeredGroups: [], maxConcurrentContainers: 4 };
    client.applyDelta(frame(diffStable(bumped, s401), 400, 401));
    expect(client.rev).toBe(401);
    expect(client.folders).toEqual(['a', 'b']);
  });

  it('stays unreplayable when the snapshot is older than what we dropped', () => {
    const client = new Client();
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 1 });
    client.startResync();
    floodDeltas(client, 260, 2);
    expect(client.reconnects).toBe(1);

    // A stale snapshot (rev 100 < the 261 we dropped) cannot restore continuity.
    client.adoptSnapshot({ ...base, stateEpoch: stateEpoch(), stateRev: 100 });
    expect(client.sync.sync.unreplayable).toBe(true);
    expect(client.reconnects).toBe(2); // ask again rather than pretend we're in sync
  });
});

describe('scan-worker handoff (codex round-2 residual A)', () => {
  function makeHandoff(overrides: Record<string, any> = {}) {
    const calls = {
      msgTs: [] as any[],
      activity: [] as any[],
      costCaps: [] as any[],
      ready: 0,
      fatal: [] as string[],
      republish: 0,
    };
    const handoff = createScanHandoff({
      applyMsgTs: (changed: any, removed: any) => calls.msgTs.push({ changed, removed }),
      applyActivity: (buckets: any) => calls.activity.push(buckets),
      applyCostCaps: (changed: any, removed: any) => calls.costCaps.push({ changed, removed }),
      onReady: () => {
        calls.ready += 1;
      },
      onStats: () => {},
      onFatal: (m: string) => calls.fatal.push(m),
      requestRepublish: () => {
        calls.republish += 1;
      },
      ...overrides,
    });
    return { handoff, calls };
  }

  it('applies frames that arrived before `ready` instead of discarding them', () => {
    // The residual: MessagePort delivery is ordered, so a frame the host drops
    // pre-`ready` is gone for good — the worker has already recorded it as
    // published and never resends it. Every group's lastMessageTs (unread badge,
    // chat auto-refresh) then stays empty indefinitely on an idle fleet.
    const { handoff, calls } = makeHandoff();
    handoff.handle({ kind: 'msgTs', changed: [['alpha', '2026-08-19T00:00:00.000Z']], removed: [] });
    handoff.handle({ kind: 'activity', buckets: [{ hour: '2026-08-19T00', inbound: 1, outbound: 0 }] });
    expect(calls.msgTs).toHaveLength(0); // main-thread scan still owns the cache
    expect(calls.activity).toHaveLength(0);
    expect(handoff.isReady()).toBe(false);

    handoff.handle({ kind: 'ready' });

    expect(calls.ready).toBe(1);
    expect(handoff.isReady()).toBe(true);
    expect(calls.msgTs).toEqual([{ changed: [['alpha', '2026-08-19T00:00:00.000Z']], removed: [] }]);
    expect(calls.activity).toHaveLength(1);
    expect(calls.republish).toBe(0);
  });

  it('applies queued frames in arrival order (they are cumulative deltas)', () => {
    const { handoff, calls } = makeHandoff();
    handoff.handle({ kind: 'msgTs', changed: [['a', 't1']], removed: [] });
    handoff.handle({ kind: 'msgTs', changed: [['a', 't2']], removed: [] });
    handoff.handle({ kind: 'ready' });
    expect(calls.msgTs.map((c) => c.changed[0][1])).toEqual(['t1', 't2']);
  });

  it('asks the worker to republish when the pre-ready queue overflows', () => {
    const { handoff, calls } = makeHandoff({ maxPreReadyFrames: 2 });
    for (let i = 0; i < 5; i++) handoff.handle({ kind: 'msgTs', changed: [[`g${i}`, 't']], removed: [] });
    handoff.handle({ kind: 'ready' });
    expect(calls.msgTs).toHaveLength(2); // what we could keep
    expect(calls.republish).toBe(1); // ...and a full re-send for what we couldn't
  });

  it('applies frames directly once ready, and ignores a duplicate ready', () => {
    const { handoff, calls } = makeHandoff();
    handoff.handle({ kind: 'ready' });
    handoff.handle({ kind: 'ready' });
    handoff.handle({ kind: 'msgTs', changed: [['a', 't']], removed: [] });
    expect(calls.ready).toBe(1);
    expect(calls.msgTs).toHaveLength(1);
  });

  it('stops applying frames after a fallback (the main thread owns the caches again)', () => {
    const { handoff, calls } = makeHandoff();
    handoff.handle({ kind: 'ready' });
    handoff.stop();
    handoff.handle({ kind: 'msgTs', changed: [['a', 't']], removed: [] });
    expect(calls.msgTs).toHaveLength(0);
  });

  it('falls back to main-thread scans when the worker reports a fatal warm-up failure', () => {
    const { handoff, calls } = makeHandoff();
    handoff.handle({ kind: 'fatal', message: 'warm-up did not settle 12 of 4000 paths' });
    expect(calls.fatal).toEqual(['warm-up did not settle 12 of 4000 paths']);
    expect(handoff.isReady()).toBe(false);
  });

  it('ignores malformed messages', () => {
    const { handoff, calls } = makeHandoff();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    handoff.handle(null);
    handoff.handle('nope');
    handoff.handle({ kind: 'unknown' });
    spy.mockRestore();
    expect(calls.ready).toBe(0);
    expect(calls.msgTs).toHaveLength(0);
  });

  // dash-1 set-ceiling-v2: costCaps is a THIRD frame kind on the same
  // handoff protocol as msgTs/activity — it must honor the identical
  // queue-before-ready / apply-in-order / republish-on-overflow discipline,
  // since it's carried over the same MessagePort with the same ordering
  // guarantees and the same "host discarded a pre-ready frame the worker will
  // never resend" failure mode this whole protocol exists to avoid.
  describe('costCaps frames (dash-1 set-ceiling-v2)', () => {
    it('applies costCaps frames that arrived before `ready` instead of discarding them', () => {
      const { handoff, calls } = makeHandoff();
      handoff.handle({ kind: 'costCaps', changed: [['sess-1', 'ag-1', '{"capUsd":10}', 1000]], removed: [] });
      expect(calls.costCaps).toHaveLength(0); // main-thread fallback still owns the cache
      handoff.handle({ kind: 'ready' });
      expect(calls.costCaps).toEqual([{ changed: [['sess-1', 'ag-1', '{"capUsd":10}', 1000]], removed: [] }]);
    });

    it('applies costCaps frames directly once ready', () => {
      const { handoff, calls } = makeHandoff();
      handoff.handle({ kind: 'ready' });
      handoff.handle({ kind: 'costCaps', changed: [['sess-1', 'ag-1', '{"capUsd":10}', 1000]], removed: [] });
      expect(calls.costCaps).toHaveLength(1);
    });

    it('carries a removed session id through untouched (tombstone-on-delete)', () => {
      const { handoff, calls } = makeHandoff();
      handoff.handle({ kind: 'ready' });
      handoff.handle({ kind: 'costCaps', changed: [], removed: ['sess-deleted'] });
      expect(calls.costCaps).toEqual([{ changed: [], removed: ['sess-deleted'] }]);
    });

    it('shares the SAME pre-ready queue (and its overflow/republish behavior) as msgTs/activity', () => {
      const { handoff, calls } = makeHandoff({ maxPreReadyFrames: 2 });
      handoff.handle({ kind: 'msgTs', changed: [['g0', 't']], removed: [] });
      handoff.handle({ kind: 'costCaps', changed: [['sess-1', 'ag-1', '{}', 1]], removed: [] });
      handoff.handle({ kind: 'activity', buckets: [] });
      handoff.handle({ kind: 'ready' });
      // Only the first 2 (of 3) pre-ready frames survive the bounded queue —
      // the same budget is shared across all three kinds, not one each.
      expect(calls.msgTs.length + calls.costCaps.length + calls.activity.length).toBe(2);
      expect(calls.republish).toBe(1);
    });

    it('does not throw when applyCostCaps is not provided (backward compatible with older hook objects)', () => {
      const { handoff } = makeHandoff({ applyCostCaps: undefined });
      handoff.handle({ kind: 'ready' });
      expect(() => handoff.handle({ kind: 'costCaps', changed: [['sess-1', 'ag-1', '{}', 1]], removed: [] })).not.toThrow();
    });

    it('stops applying costCaps frames after a fallback, same as msgTs/activity', () => {
      const { handoff, calls } = makeHandoff();
      handoff.handle({ kind: 'ready' });
      handoff.stop();
      handoff.handle({ kind: 'costCaps', changed: [['sess-1', 'ag-1', '{}', 1]], removed: [] });
      expect(calls.costCaps).toHaveLength(0);
    });
  });
});
