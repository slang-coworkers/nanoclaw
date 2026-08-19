/**
 * NanoClaw dashboard — shared live-state reconciliation (dash-perf round 2).
 *
 * The desktop (`app.js`) and mobile (`mobile.js`) clients consume the SAME
 * revisioned protocol: a full snapshot (`/api/state`, or an in-stream `state`
 * frame) establishes `{ stateEpoch, stateRev }`, and `state-delta` frames tagged
 * `{ stateEpoch, baseRev, rev }` patch it forward. Both clients used to carry a
 * hand-copied implementation of that reconciliation, and `state-delta.test.ts`
 * carried a THIRD hand-written copy as its "reference client" — so a fix in one
 * copy silently left the others (and the tests) describing a protocol nobody
 * ran. This module is the single implementation: both browser scripts drive it,
 * and the test suite drives this exact code rather than a look-alike.
 *
 * Deliberately written as a CLASSIC script (no import/export): `mobile.js` is a
 * classic script and `app.js` is a module, so the only shape both can consume is
 * a global installed by a plain `<script src>` tag. It has no `import`/`export`
 * statements either, which keeps it loadable as an ES module for the tests
 * (side-effect import → read the global).
 *
 * The invariants it enforces, and why each exists:
 *
 *  • EPOCH GATING. Revisions are per-server-process counters that reset on
 *    restart, so `baseRev` alone is ambiguous across one. A delta must carry the
 *    epoch we hold — a MISSING epoch is a mismatch too once we hold one, so a
 *    legacy/mixed-version frame can't slip past both this and the order check.
 *  • ORDER PROOF. A keyed upsert/remove merge reproduces the server's CONTENTS
 *    but keeps OUR insertion order. Index-positional UI (the pixel office
 *    assigns desks by array index) then renders a different office at a revision
 *    the client believes is in sync. A keyed change must therefore carry either
 *    the server's full `order`, or `orderChanged: false` — the server's explicit
 *    statement that this delta only changes VALUES of existing keys, which a
 *    Map merge preserves exactly. Anything else → resync.
 *  • SNAPSHOT GENERATIONS. An HTTP `/api/state` resync races the live stream. An
 *    in-stream snapshot is ordered against the deltas by construction, so
 *    installing one supersedes any HTTP response still in flight: that response
 *    may come from the OLD process (different epoch), which the "same epoch,
 *    older revision" rewind guard cannot catch — it would look like a legitimate
 *    epoch change and be applied over newer state, stranding the UI until the
 *    next delta (never, if the new process is idle).
 *  • BOUNDED BUFFER, NO LIVELOCK. Deltas that arrive behind the resync barrier
 *    are buffered and replayed against the revision the snapshot established.
 *    The buffer is bounded; dropping the OLDEST frame (the previous behavior)
 *    leaves a hole no later snapshot can bridge, so every snapshot lands behind
 *    the earliest retained delta and the client resyncs forever. On overflow we
 *    instead declare the barrier UNREPLAYABLE and reopen the live channel for an
 *    ordered in-stream snapshot.
 */
function createStateSync(options) {
  const opts = options || {};
  const getState = opts.getState;
  const applyState = opts.applyState;
  const startResync = opts.startResync; // () => void — begin (or join) an HTTP snapshot fetch
  const onSettled = typeof opts.onSettled === 'function' ? opts.onSettled : null;
  const reconnectLive = typeof opts.reconnectLive === 'function' ? opts.reconnectLive : null;
  const maxBufferedDeltas = typeof opts.maxBufferedDeltas === 'number' ? opts.maxBufferedDeltas : 200;

  /** All reconciliation state lives here so callers (and tests) can inspect it. */
  const sync = {
    /** Revision of the last snapshot/delta applied. */
    rev: 0,
    /** Identity of the server PROCESS that produced `rev` (null before the first snapshot). */
    epoch: null,
    /** True while an HTTP snapshot is in flight: deltas queue instead of applying. */
    barrier: false,
    /** Bumped whenever an authoritative in-stream snapshot is installed; an HTTP
     *  response tagged with an older generation is superseded and dropped. */
    generation: 0,
    buffered: [],
    /** Set when the buffer overflowed: the queue can no longer be replayed, so
     *  only an ordered in-stream snapshot (or a snapshot at/after `droppedRev`)
     *  can restore continuity. */
    unreplayable: false,
    /** Highest revision dropped while unreplayable — a snapshot at or after it
     *  provably contains everything we lost. */
    droppedRev: 0,
    /** Epoch `droppedRev` was counted in. Revisions reset per server process, so
     *  `droppedRev` is only meaningful within its own epoch: a snapshot from a
     *  DIFFERENT epoch is a fresh full baseline that restores continuity outright,
     *  regardless of its (smaller) revision. Without this, an old-epoch overflow at
     *  rev 103 could never be cleared by a restarted process whose snapshots start
     *  at rev 1 — an endless reconnect. */
    droppedEpoch: null,
    /** One in-stream recovery request per overflow episode (no reconnect storm). */
    recoveryRequested: false,
  };

  /** Adopt `{ stateEpoch, stateRev }` carried by any state object. */
  function observeSnapshotFields(next) {
    if (!next || typeof next !== 'object') return;
    if (typeof next.stateEpoch === 'string') sync.epoch = next.stateEpoch;
    if (typeof next.stateRev === 'number') sync.rev = next.stateRev;
  }

  /**
   * Merge one keyed collection from a delta. Returns null when the result can't
   * be trusted, which the caller turns into a resync.
   */
  function mergeKeyedDelta(current, change, keyOf) {
    const hasOrder = Array.isArray(change.order);
    // Value-only: the server states the key ORDER and MEMBERSHIP are unchanged,
    // so a Map merge reproduces its array exactly and `order` is redundant
    // (shipping it on every small delta is O(fleet) bytes per one-field change).
    const valueOnly = !hasOrder && change.orderChanged === false;
    if (!hasOrder && !valueOnly) return null; // no order, no proof → resync
    const map = new Map((current || []).map((item) => [keyOf(item), item]));
    for (const item of change.upsert || []) {
      const key = keyOf(item);
      // A value-only delta may not introduce a key: we'd have to guess where the
      // server put it.
      if (valueOnly && !map.has(key)) return null;
      map.set(key, item);
    }
    for (const key of change.remove || []) {
      if (valueOnly) return null; // membership change without an order
      map.delete(String(key));
    }
    if (!hasOrder) return Array.from(map.values());
    const ordered = [];
    for (const key of change.order) {
      const item = map.get(String(key));
      if (item !== undefined) ordered.push(item);
    }
    // Server order and our merged set must describe exactly the same membership.
    if (ordered.length !== map.size || ordered.length !== change.order.length) return null;
    return ordered;
  }

  /**
   * Apply an incremental delta's payload. Only the changed keyed objects
   * (coworkers/registered-groups upsert+remove), the key order, and scalar
   * fields travel. Returns false if the patch can't be applied cleanly.
   */
  function applyDeltaPatch(delta) {
    const state = getState() || {};
    const patch = {};
    if (delta.coworkers) {
      const merged = mergeKeyedDelta(state.coworkers, delta.coworkers, (c) => String(c.folder));
      if (merged === null) return false;
      patch.coworkers = merged;
    }
    if (delta.registeredGroups) {
      const merged = mergeKeyedDelta(state.registeredGroups, delta.registeredGroups, (g) => String(g.id));
      if (merged === null) return false;
      patch.registeredGroups = merged;
    }
    if (delta.fields && typeof delta.fields === 'object') Object.assign(patch, delta.fields);
    // The revision travels WITH the state (never as a side variable only), so a
    // later applyState({ ...state, ... }) can't carry a stale revision and roll
    // the live one backwards.
    patch.stateRev = delta.rev;
    if (typeof delta.stateEpoch === 'string') patch.stateEpoch = delta.stateEpoch;
    observeSnapshotFields(patch);
    applyState(patch);
    return true;
  }

  /** Ask for an ordered in-stream snapshot (once per overflow episode). */
  function requestInStreamRecovery() {
    if (sync.recoveryRequested) return;
    sync.recoveryRequested = true;
    if (reconnectLive) reconnectLive();
    else startResync();
  }

  function bufferDelta(delta) {
    if (sync.unreplayable) {
      // Only track how far we've fallen WITHIN the dropped epoch — a cross-epoch
      // delta's revision is an unrelated counter and must not inflate droppedRev.
      const dEpoch = typeof delta.stateEpoch === 'string' ? delta.stateEpoch : null;
      if (dEpoch === sync.droppedEpoch && typeof delta.rev === 'number' && delta.rev > sync.droppedRev) {
        sync.droppedRev = delta.rev;
      }
      return;
    }
    if (sync.buffered.length >= maxBufferedDeltas) {
      // Overflow. Dropping the oldest frame (the old behavior) would leave a
      // hole between the snapshot we're waiting for and the frames we kept — the
      // snapshot always lands behind the earliest retained delta, so nothing
      // ever chains and the client resyncs forever. Drop the whole queue, record
      // how far ahead we've fallen, and recover in-stream.
      for (const queued of sync.buffered) {
        if (typeof queued.rev === 'number' && queued.rev > sync.droppedRev) sync.droppedRev = queued.rev;
      }
      if (typeof delta.rev === 'number' && delta.rev > sync.droppedRev) sync.droppedRev = delta.rev;
      sync.buffered = [];
      sync.unreplayable = true;
      sync.droppedEpoch = sync.epoch; // droppedRev is only meaningful within this epoch
      sync.barrier = true; // nothing may apply onto a baseline we know is holed
      requestInStreamRecovery();
      return;
    }
    sync.buffered.push(delta);
  }

  /**
   * Replay deltas that arrived while a snapshot was in flight, against the
   * revision the snapshot actually established. Anything at or below it is
   * already included; anything that doesn't chain means we still have a hole.
   */
  function drainBufferedDeltas() {
    if (sync.unreplayable) {
      sync.buffered = [];
      // Continuity is restored when EITHER:
      //  • the snapshot came from a DIFFERENT epoch — a restarted server process,
      //    whose full snapshot is a complete fresh baseline (its rev counter is
      //    unrelated to droppedRev, so a numeric compare would loop forever); or
      //  • within the SAME epoch, the snapshot reached or passed the highest
      //    revision we dropped, so it provably contains everything we lost.
      const newEpoch = sync.epoch !== null && sync.epoch !== sync.droppedEpoch;
      if (newEpoch || sync.rev >= sync.droppedRev) {
        sync.unreplayable = false;
        sync.recoveryRequested = false;
        sync.droppedRev = 0;
        sync.droppedEpoch = null;
        return;
      }
      // Same epoch, snapshot still older than what we dropped — it doesn't close
      // the hole. Ask again — bounded by snapshot arrivals, not a retry loop.
      sync.recoveryRequested = false;
      requestInStreamRecovery();
      return;
    }
    if (!sync.buffered.length) return;
    const pending = sync.buffered.slice().sort((a, b) => a.rev - b.rev);
    sync.buffered = [];
    let gap = false;
    for (const delta of pending) {
      const epoch = typeof delta.stateEpoch === 'string' ? delta.stateEpoch : null;
      if (epoch !== sync.epoch) {
        gap = true;
        continue;
      }
      if (delta.rev <= sync.rev) continue;
      if (delta.baseRev !== sync.rev || !applyDeltaPatch(delta)) {
        gap = true;
        break;
      }
    }
    if (gap) startResync();
  }

  /**
   * Raise the resync barrier for an HTTP snapshot fetch and return the
   * generation token the response must still carry to be adopted.
   */
  function beginResync() {
    sync.barrier = true;
    return sync.generation;
  }

  function finishResync() {
    sync.barrier = false;
    if (onSettled) onSettled();
    drainBufferedDeltas();
  }

  /**
   * Adopt a full snapshot from ANY source and lift the barrier.
   *
   * `generation` is omitted for an in-stream snapshot (WS/SSE `state` frame):
   * it is ordered against the delta stream by construction, so it is always
   * authoritative and supersedes any HTTP resync still in flight. An HTTP
   * response passes the token it was issued; if it no longer matches, a newer
   * snapshot already landed and this one is dropped — WITHOUT this, a delayed
   * response from an OLD server process (different epoch) reads as a legitimate
   * epoch change and overwrites newer state.
   *
   * Returns true when the resync this response belongs to is settled (adopted,
   * intentionally discarded, or already finished by a newer snapshot), false
   * when the caller should retry.
   */
  function adoptSnapshot(data, generation) {
    if (generation === undefined || generation === null) {
      sync.generation += 1;
    } else if (generation !== sync.generation) {
      return !sync.barrier;
    }
    if (!data || typeof data !== 'object') {
      finishResync();
      return true;
    }
    const epoch = typeof data.stateEpoch === 'string' ? data.stateEpoch : null;
    const rev = typeof data.stateRev === 'number' ? data.stateRev : null;
    // A delayed response that would rewind us — same server process, older
    // revision than we already hold — is discarded rather than applied.
    if (epoch !== null && epoch === sync.epoch && rev !== null && rev < sync.rev) {
      finishResync();
      return true;
    }
    observeSnapshotFields(data);
    applyState(data);
    finishResync();
    return true;
  }

  /** Apply an incremental live delta; resync if it doesn't chain onto our (epoch, rev). */
  function applyStateDelta(delta) {
    if (!delta || typeof delta.baseRev !== 'number' || typeof delta.rev !== 'number') {
      startResync();
      return;
    }
    if (sync.barrier) {
      bufferDelta(delta);
      return;
    }
    // Epoch first: after a server restart the revision numbers alone will
    // happily "chain" onto a baseline from the previous process. A frame with NO
    // epoch fails this too once we hold one (fail closed, not open).
    const epoch = typeof delta.stateEpoch === 'string' ? delta.stateEpoch : null;
    if (epoch !== sync.epoch || delta.baseRev !== sync.rev || !applyDeltaPatch(delta)) {
      bufferDelta(delta);
      startResync();
    }
  }

  return {
    sync,
    observeSnapshotFields,
    mergeKeyedDelta,
    applyDeltaPatch,
    applyStateDelta,
    adoptSnapshot,
    beginResync,
    finishResync,
    bufferDelta,
    drainBufferedDeltas,
  };
}

// Classic-script global (both `app.js` as a module and `mobile.js` as a classic
// script read it; the tests import this file for its side effect and read it off
// globalThis).
globalThis.NanoclawStateSync = { createStateSync };
