/**
 * Spawn admission: how many busy agent containers the host lets run before a
 * wake that needs a NEW container has to wait.
 *
 * Consider a replay that wakes 500 sessions at once. Each wake spawns a
 * container, and each container starts a model turn right away, so the model
 * endpoint sees 500 sessions calling it in the same minute. On prod
 * (2026-11-16) that tripped the endpoint's per-IP rate limit (AWS WAF rule
 * `CPE_RateLimit_IP`, HTTP 429) for ten minutes and failed 274 turns.
 *
 * We bound the burst at the one place every new container comes from: the
 * wake path in `container-runner.ts` asks `SpawnAdmission.admit` before it
 * spawns. A wake for a session whose container is already running never asks,
 * so live sessions are unaffected. A held wake returns `false` like any other
 * transient wake failure: its inbound rows stay pending and the host sweep
 * wakes it again on the next tick, so nothing is dropped.
 *
 * The limit counts BUSY containers, not running ones. A container stays up
 * long after its turn ends (prod keeps an idle container for up to three
 * hours), and an idle container makes no model calls. Counting it would make a
 * held wake wait for the idle reaper rather than for load to drop. A container
 * is busy while it starts up or while its heartbeat (touched on every provider
 * event) is recent — see `isBusyContainer`.
 *
 * Held wakes are served first come, first served. Each held session keeps its
 * place in a queue, and a free slot goes to the oldest held session that asks
 * for it; a wake that arrives later takes a slot only when there are more free
 * slots than held sessions ahead of it. A held session that stops asking (it
 * closed, or its messages went away) leaves the queue after `waiterTtlMs`.
 */

/**
 * A container whose heartbeat moved within this window is busy. A turn touches
 * the heartbeat on every provider event, and a claimed message whose container
 * goes 60 s without one is already treated as stuck by the sweep, so a
 * working container stays inside two minutes; an idle one falls out of it.
 */
export const BUSY_WINDOW_MS = 2 * 60_000;

/**
 * A container that has not touched its heartbeat since it started is still
 * starting (image start, runner boot, the provider's first request) and counts
 * as busy for this long. Past it, a container that never produced an event is
 * not calling the model either.
 */
export const STARTUP_GRACE_MS = 5 * 60_000;

/**
 * A held session that has not asked again for this long leaves the queue. The
 * sweep asks for every due session once per tick (60 s plus the tick's own
 * run time), so five minutes is several missed ticks.
 */
export const WAITER_TTL_MS = 5 * 60_000;

/** What the host knows about one running container when it counts busy ones. */
export interface ContainerActivity {
  /** When this host started tracking the container (spawn, or adoption after a host restart). */
  startedAtMs: number;
  /** True when this host adopted the container at startup rather than spawning it. */
  adopted: boolean;
  /** mtime of the session heartbeat file, or 0 when there is none. */
  heartbeatMs: number;
}

/**
 * Return whether a running container counts against the busy limit at `nowMs`.
 *
 * A spawned container's heartbeat file is removed at spawn, so a heartbeat
 * older than `startedAtMs` belongs to a previous container and is ignored. An
 * adopted container is the same process that wrote its heartbeat before the
 * host restarted, so its heartbeat counts whatever its age.
 *
 * Consider a container spawned at 10:00 that last touched its heartbeat at
 * 10:20. At 10:21 it is busy (inside the two-minute window); at 10:25 it is
 * idle. Had it never touched the heartbeat, it would be busy until 10:05
 * (the startup grace) and idle after.
 */
export function isBusyContainer(
  container: ContainerActivity,
  nowMs: number,
  windows: { busyWindowMs: number; startupGraceMs: number } = {
    busyWindowMs: BUSY_WINDOW_MS,
    startupGraceMs: STARTUP_GRACE_MS,
  },
): boolean {
  const ownHeartbeat = container.adopted || container.heartbeatMs >= container.startedAtMs ? container.heartbeatMs : 0;
  if (ownHeartbeat <= 0) return nowMs - container.startedAtMs < windows.startupGraceMs;
  return nowMs - ownHeartbeat < windows.busyWindowMs;
}

/** The outcome of one admission request. */
export type AdmissionDecision =
  { admitted: true; waitedMs?: number } | { admitted: false; position: number; firstHold: boolean };

/**
 * The first-come, first-served queue of wakes held at the busy limit. Pure:
 * the caller supplies the busy count and the clock, so the policy is testable
 * without containers.
 */
export class SpawnAdmission {
  /** Held sessions in arrival order (Map keeps insertion order). */
  private readonly waiters = new Map<string, { firstHeldAtMs: number; lastAskedAtMs: number }>();

  constructor(
    /** Busy containers allowed before a new spawn waits. 0 turns the limit off. */
    readonly limit: number,
    private readonly waiterTtlMs: number = WAITER_TTL_MS,
  ) {}

  /**
   * Decide whether `sessionId` may spawn now, given `busy` containers.
   *
   * A session may spawn when the free slots (`limit - busy`) outnumber the
   * held sessions queued ahead of it. An admitted session leaves the queue; a
   * held one joins it (or keeps its place) and learns its position.
   */
  admit(sessionId: string, busy: number, nowMs: number): AdmissionDecision {
    if (this.limit <= 0) return { admitted: true };
    this.expire(nowMs);
    const held = this.waiters.get(sessionId);
    const ahead = held ? this.positionOf(sessionId) : this.waiters.size;
    if (this.limit - busy > ahead) {
      this.waiters.delete(sessionId);
      return held ? { admitted: true, waitedMs: nowMs - held.firstHeldAtMs } : { admitted: true };
    }
    if (held) {
      held.lastAskedAtMs = nowMs;
      return { admitted: false, position: ahead, firstHold: false };
    }
    this.waiters.set(sessionId, { firstHeldAtMs: nowMs, lastAskedAtMs: nowMs });
    return { admitted: false, position: ahead, firstHold: true };
  }

  /** Drop a session from the queue (it closed, or its group was paused). */
  forget(sessionId: string): void {
    this.waiters.delete(sessionId);
  }

  /** Number of sessions waiting for a slot. */
  get held(): number {
    return this.waiters.size;
  }

  private positionOf(sessionId: string): number {
    let index = 0;
    for (const id of this.waiters.keys()) {
      if (id === sessionId) return index;
      index++;
    }
    return index;
  }

  private expire(nowMs: number): void {
    for (const [id, waiter] of this.waiters) {
      if (nowMs - waiter.lastAskedAtMs > this.waiterTtlMs) this.waiters.delete(id);
    }
  }
}
