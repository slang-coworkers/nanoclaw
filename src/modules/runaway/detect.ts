/**
 * Non-blocking runaway detector.
 *
 * Surfaces an admin card when a session looks stuck in a runaway loop:
 * MANY processed turns in a rolling window while producing NEAR-ZERO output.
 * That is the signature of the incident this whole feature targets — a triage
 * session that woke ~17,000 times emitting "Ignored." to echo pings, replaying
 * ~442k tokens each time (~21% of a month's spend).
 *
 * HARD CONSTRAINT: this NEVER blocks. It does not pause, kill, or throttle the
 * session. It only emits one card per runaway "episode". The session keeps
 * running normally; the ONLY thing that stops it is a human (maintainer/owner)
 * clicking Stop on the card — handled in ./index.ts.
 *
 * The signal is computed entirely from the session's outbound.db (already open
 * in the sweep), so it is cheap and never touches the multi-MB JSONL transcript:
 *   - turns   = processing_ack rows marked completed within the window
 *   - output  = total bytes of messages_out content within the window
 * Trip requires BOTH high turns AND low output — a genuinely busy session
 * produces output and so never trips (keeps false positives near zero).
 */
import type Database from 'better-sqlite3';

import { RUNAWAY_MAX_OUTPUT_BYTES, RUNAWAY_TURNS, RUNAWAY_WINDOW_S } from '../../config.js';
import { log } from '../../log.js';
import type { Session } from '../../types.js';

export interface RunawayMetrics {
  turns: number;
  outputBytes: number;
}

/**
 * The two cost numbers an approver needs to size a runaway: how much this
 * session has spent, and the effective cap for its window. Sourced from the
 * container's own cost-cap state, so a card and the cost-cap DM read alike.
 */
export interface RunawayCost {
  spentUsd: number;
  capUsd: number;
}

/**
 * Best-effort read of the session's cost-cap state from outbound.db.
 *
 * The container's poll loop persists its {@link CostCapState} under the
 * `cost_cap` key of `session_state` (agent-runner db/session-state.ts) on every
 * turn, so the host can surface live spend without touching the JSONL
 * transcript. We lift only spent/cap here — the two numbers a human weighs when
 * deciding whether to Stop a runaway.
 *
 * Returns null when cost tracking is off for the group (non-Claude provider or
 * no cap configured → no row is ever written), or when the row is missing /
 * unparseable / carries a non-positive cap. In every such case the card renders
 * exactly as it did before this field existed (back-compat).
 */
export function readRunawayCost(outDb: Database.Database): RunawayCost | null {
  try {
    const row = outDb.prepare(`SELECT value FROM session_state WHERE key = 'cost_cap'`).get() as
      | { value: string }
      | undefined;
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as { spentUsd?: unknown; capUsd?: unknown };
    const spentUsd = Number(parsed.spentUsd);
    const capUsd = Number(parsed.capUsd);
    if (!Number.isFinite(spentUsd) || !Number.isFinite(capUsd) || capUsd <= 0) return null;
    return { spentUsd, capUsd };
  } catch {
    // session_state absent (container never started) or JSON garbage → no cost.
    return null;
  }
}

/**
 * Count completed turns and sum output bytes within the trailing window.
 * Read-only against outbound.db. `nowIso`/`windowS` are injectable for tests.
 */
export function measureRunaway(
  outDb: Database.Database,
  nowMs = Date.now(),
  windowS = RUNAWAY_WINDOW_S,
): RunawayMetrics {
  const cutoffIso = new Date(nowMs - windowS * 1000).toISOString();

  const turns =
    (
      outDb
        .prepare(
          // datetime() normalizes both sides: the container writes status_changed
          // via datetime('now') ('YYYY-MM-DD HH:MM:SS', space-separated), while the
          // cutoff is an ISO string ('...THH:MM:SS.000Z'). A raw TEXT `>=` compares
          // lexicographically and the space (0x20) sorts below 'T' (0x54), so every
          // in-window same-day row is wrongly excluded and the detector never trips.
          `SELECT COUNT(*) AS c FROM processing_ack
           WHERE status = 'completed' AND datetime(status_changed) >= datetime(?)`,
        )
        .get(cutoffIso) as { c: number } | undefined
    )?.c ?? 0;

  const outputBytes =
    (
      outDb
        .prepare(
          // Same normalization as above: messages_out.timestamp is written with
          // datetime('now'); datetime() on both sides makes the compare correct.
          `SELECT COALESCE(SUM(LENGTH(content)), 0) AS b FROM messages_out
           WHERE datetime(timestamp) >= datetime(?)`,
        )
        .get(cutoffIso) as { b: number } | undefined
    )?.b ?? 0;

  return { turns, outputBytes };
}

export function isRunaway(m: RunawayMetrics): boolean {
  return m.turns >= RUNAWAY_TURNS && m.outputBytes <= RUNAWAY_MAX_OUTPUT_BYTES;
}

// ── Episode de-dup ──
// One card per runaway episode. A session stays "carded" until it recovers
// (drops below the trip condition), then re-arms so a later distinct episode
// can card again. Purely in-memory — a card lost to a host restart simply
// re-fires next time the condition holds, which is fine.
const cardedSessions = new Set<string>();

/** Test/maintenance hook. */
export function _resetRunawayState(): void {
  cardedSessions.clear();
}

export interface RunawayCardDeps {
  /**
   * Emit the admin card. Injected so the sweep wires the real approval flow.
   * `cost` is the session's spend/cap when cost tracking is on (null otherwise
   * — the card stays back-compat).
   */
  emitCard: (session: Session, metrics: RunawayMetrics, windowS: number, cost: RunawayCost | null) => Promise<void>;
}

/**
 * Per-session sweep hook. Measures the window, and on a fresh trip emits one
 * card. Recovery clears the carded flag so the session can card again later.
 * Returns the decision for logging/tests. NEVER stops the session.
 */
export async function checkRunaway(
  session: Session,
  outDb: Database.Database,
  deps: RunawayCardDeps,
  nowMs = Date.now(),
): Promise<{ tripped: boolean; carded: boolean; metrics: RunawayMetrics }> {
  const metrics = measureRunaway(outDb, nowMs);
  const tripped = isRunaway(metrics);

  if (!tripped) {
    // Recovered (or never tripped) — re-arm.
    cardedSessions.delete(session.id);
    return { tripped: false, carded: false, metrics };
  }

  if (cardedSessions.has(session.id)) {
    // Same ongoing episode — already carded, don't re-card every 60s.
    return { tripped: true, carded: false, metrics };
  }

  cardedSessions.add(session.id);
  const cost = readRunawayCost(outDb);
  log.warn('Runaway suspected — surfacing non-blocking admin card', {
    sessionId: session.id,
    agentGroupId: session.agent_group_id,
    turns: metrics.turns,
    outputBytes: metrics.outputBytes,
    windowS: RUNAWAY_WINDOW_S,
    spentUsd: cost?.spentUsd,
    capUsd: cost?.capUsd,
  });
  try {
    await deps.emitCard(session, metrics, RUNAWAY_WINDOW_S, cost);
  } catch (err) {
    // If the card failed to send, re-arm so the next sweep retries.
    cardedSessions.delete(session.id);
    log.error('Failed to emit runaway card', { sessionId: session.id, err });
  }
  return { tripped: true, carded: true, metrics };
}
