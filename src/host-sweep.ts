/**
 * Host sweep — periodic maintenance of all session DBs.
 *
 * Two-DB architecture:
 *   - Reads processing_ack + container_state from outbound.db
 *   - Writes to inbound.db (host-owned) for status updates + recurrence
 *   - Uses heartbeat file mtime for liveness (never polls DB for it)
 *   - Never writes to outbound.db — preserves single-writer-per-file invariant
 *
 * Stuck / idle detection (replaces the old IDLE_TIMEOUT setTimeout + 10-min
 * heartbeat threshold):
 *
 *   If the container isn't running and there are 'processing' rows left over
 *   (e.g. it crashed mid-turn) → reset them to pending with backoff +
 *   tries++. Existing retry machinery does the rest.
 *
 *   If the container IS running:
 *     1. Absolute ceiling: heartbeat age > max(30 min, current_bash_timeout)
 *        → kill. Covers the "alive but silent for 30 min" case. Extended
 *        only while Bash is declared as running longer, honouring the
 *        user's own timeout directive. Kill then resets processing rows.
 *
 *     2. Message-scoped stuck: for each 'processing' row, tolerance =
 *        max(60s, current_bash_timeout_ms_if_Bash_running). If
 *        (claim_age > tolerance) AND (heartbeat_mtime <= status_changed)
 *        → kill + reset this message + tries++. Semantics: "container
 *        claimed a message and went quiet past tolerance since the claim."
 */
import type Database from 'better-sqlite3';
import fs from 'fs';

import { ensureEgressNetwork } from './egress-lockdown.js';
import { getActiveSessions, getSession, isTaskThread, updateSession } from './db/sessions.js';
import { getAgentGroup } from './db/agent-groups.js';
import { getSourceFor } from './db/a2a-session-sources.js';
import {
  clearOrphanProcessingAcks,
  countDueMessages,
  deleteBouncedClaims,
  deleteOrphanProcessingClaims,
  getBouncedClaims,
  getBouncedTriggerRow,
  getContainerState,
  getMessageForRetry,
  getProcessingClaims,
  markMessageFailed,
  retryWithBackoff,
  syncProcessingAcks,
  type ContainerState,
} from './db/session-db.js';
import { log } from './log.js';
import {
  openInboundDb,
  openOutboundDb,
  openOutboundDbRw,
  inboundDbPath,
  outboundDbPath,
  heartbeatPath,
  writeSessionMessage,
} from './session-manager.js';
import {
  detectStaleContainers,
  isContainerRunning,
  killContainer,
  recomposeAndUpdateHash,
  wakeContainer,
} from './container-runner.js';
import type { Session } from './types.js';

const SWEEP_INTERVAL_MS = 60_000;
// Absolute idle ceiling for a running container. If the heartbeat file hasn't
// been touched in this long, the container is either stuck or doing genuinely
// nothing — kill and restart on the next inbound.
// Respects CONTAINER_TIMEOUT from .env (default 30 min).
export const ABSOLUTE_CEILING_MS = parseInt(process.env.CONTAINER_TIMEOUT || '1800000', 10);
// Stuck tolerance window applied per 'processing' claim — "did we see any
// signs of life since this message was claimed?"
export const CLAIM_STUCK_MS = 60 * 1000;
// Service start time — claims older than this are orphans from a prior run.
const SERVICE_START_MS = Date.now();
const MAX_TRIES = 5;
const BACKOFF_BASE_MS = 5000;

// --- a2a bounce-redrive budgets (see redriveBouncedA2a) ------------------
// A bounced a2a handoff (recipient turn errored on a transient/unknown provider
// fault) is re-armed on its OWN budget, separate from the generic MAX_TRIES
// path above — a transient auth outage can last far longer than the ~2.5 min
// the generic path allows, so these ceilings are deliberately much larger.
// 'bounced-transient' (known outage signature) gets the long budget;
// 'bounced-unknown' (isError but unrecognized) gets a short one so a truly
// permanent failure that dodged the denylist cannot hide for hours.
const A2A_MAX_TRIES = 12;
const A2A_UNKNOWN_MAX_TRIES = 2;
const A2A_BACKOFF_BASE_MS = 60_000; // 1 min, doubling …
const A2A_BACKOFF_CAP_MS = 3_600_000; // … capped at 1h per step (multi-hour total).

/**
 * Parse a timestamp that may be in SQLite datetime('now') format
 * ("YYYY-MM-DD HH:MM:SS", always UTC but missing indicator) or
 * ISO 8601 ("...T...Z"). Date.parse treats space-separated strings
 * as local time — this normalises to UTC first.
 */
export function parseSqliteUtc(s: string): number {
  // SQLite TIMESTAMP columns store UTC without a timezone marker.
  // Date.parse treats timezoneless ISO strings as local time, so on non-UTC
  // hosts every timestamp looks (TZ offset) hours stale — leading to
  // spurious kill-claim decisions on freshly-claimed messages. Append "Z"
  // when no zone marker is present so Date.parse interprets as UTC.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return Date.parse(s.replace(' ', 'T') + 'Z');
  }
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : s + 'Z');
}

export type StuckDecision =
  | { action: 'ok' }
  | { action: 'kill-ceiling'; heartbeatAgeMs: number; ceilingMs: number }
  | { action: 'kill-claim'; messageId: string; claimAgeMs: number; toleranceMs: number };

/**
 * Pure decision for whether a running container should be killed this sweep
 * tick. Inputs are all deterministic; filesystem + DB reads happen in the
 * caller.
 */
export function decideStuckAction(args: {
  now: number;
  heartbeatMtimeMs: number; // 0 when heartbeat file absent
  containerState: ContainerState | null;
  claims: Array<{ message_id: string; status_changed: string }>;
}): StuckDecision {
  const { now, heartbeatMtimeMs, containerState, claims } = args;
  const declaredBashMs = bashTimeoutMs(containerState);

  // Ceiling check only applies when we have an actual heartbeat timestamp.
  // A freshly-spawned container hasn't had any SDK activity yet so no
  // heartbeat file exists — if we treated that as infinitely stale we'd
  // kill every container within seconds of spawn. Genuinely-dead containers
  // that never wrote a heartbeat are caught by the separate "container
  // process not running" cleanup path, not here. If a fresh container is
  // hanging at the gate (claimed a message but never did anything) the
  // claim-stuck check below handles it.
  if (heartbeatMtimeMs !== 0) {
    const heartbeatAge = now - heartbeatMtimeMs;
    const ceiling = Math.max(ABSOLUTE_CEILING_MS, declaredBashMs ?? 0);
    if (heartbeatAge > ceiling) {
      return { action: 'kill-ceiling', heartbeatAgeMs: heartbeatAge, ceilingMs: ceiling };
    }
  }

  const tolerance = Math.max(CLAIM_STUCK_MS, declaredBashMs ?? 0);
  for (const claim of claims) {
    const claimedAt = parseSqliteUtc(claim.status_changed);
    if (Number.isNaN(claimedAt)) continue;
    const claimAge = now - claimedAt;
    if (claimAge <= tolerance) continue;
    if (heartbeatMtimeMs > claimedAt) continue;
    return { action: 'kill-claim', messageId: claim.message_id, claimAgeMs: claimAge, toleranceMs: tolerance };
  }

  return { action: 'ok' };
}

let running = false;

export function startHostSweep(): void {
  if (running) return;
  running = true;
  sweep();
}

export function stopHostSweep(): void {
  running = false;
}

async function sweep(): Promise<void> {
  if (!running) return;

  // Re-heal the egress network so already-running agents keep their gateway hop
  // if it was detached out-of-band. Best-effort here: a heal failure isn't a
  // leak (agents stay on the internal net), so log and continue. No-op when
  // lockdown is disabled.
  try {
    ensureEgressNetwork();
  } catch (err) {
    log.error('Egress lockdown re-heal failed', { err });
  }

  try {
    const sessions = getActiveSessions();
    for (const session of sessions) {
      await sweepSession(session);
    }

    // CLAUDE.md staleness: detect containers whose composed CLAUDE.md
    // has changed since spawn (skills/overlays/instructions edited).
    //
    // Strategy: kill the container so it respawns with fresh CLAUDE.md.
    // Session history is preserved in the inbound/outbound DBs — the
    // agent picks up where it left off with updated instructions.
    // No /clear: that wipes conversation context and causes amnesia.
    const stale = detectStaleContainers();
    for (const { sessionId, agentGroupId, folder } of stale) {
      log.warn('CLAUDE.md stale — killing container for respawn', { sessionId, folder });
      recomposeAndUpdateHash(sessionId);
      killContainer(sessionId, 'claude-md-stale');
      const staleSession = getSession(sessionId);
      writeSessionMessage(agentGroupId, sessionId, {
        id: `claudemd-refresh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: 'chat',
        timestamp: new Date().toISOString(),
        platformId: agentGroupId,
        channelType: 'agent',
        threadId: staleSession?.thread_id ?? null,
        content: JSON.stringify({
          text: 'Your instructions were updated. Container restarted to apply them. If you have work in progress, resume it — otherwise no response needed.',
          sender: 'system',
          senderId: 'system',
        }),
        processAfter: new Date(Date.now() + 5000)
          .toISOString()
          .replace('T', ' ')
          .replace(/\.\d+Z$/, ''),
      });
    }
  } catch (err) {
    log.error('Host sweep error', { err });
  }

  // Finalize any "Reject with reason…" holds whose reply window elapsed (admin
  // ghosted, or the host restarted mid-capture). Central-DB scan, once per tick
  // — not per session.
  // MODULE-HOOK:approvals-reason-sweep:start
  try {
    const { sweepAwaitingReasonRejects } = await import('./modules/approvals/index.js');
    await sweepAwaitingReasonRejects();
  } catch (err) {
    log.error('Reject-with-reason sweep failed', { err });
  }
  // MODULE-HOOK:approvals-reason-sweep:end

  // Cost-approval reconciler: 24h expiry-dismiss, card resend, and override re-drive for
  // any decision whose enqueue threw. No-op under the S1 flag. Central-DB scan, once/tick.
  try {
    const { reconcileCostCards } = await import('./modules/cost-approval/index.js');
    await reconcileCostCards();
  } catch (err) {
    log.error('Cost-approval reconcile failed', { err });
  }

  setTimeout(sweep, SWEEP_INTERVAL_MS);
}

/** A per-task session with no live tasks and no running container is spent → close it. */
export function shouldCloseTaskSession(
  threadId: string | null,
  containerRunning: boolean,
  liveTaskCount: number,
): boolean {
  return isTaskThread(threadId) && !containerRunning && liveTaskCount === 0;
}

async function sweepSession(session: Session): Promise<void> {
  const agentGroup = getAgentGroup(session.agent_group_id);
  if (!agentGroup) return;

  const inPath = inboundDbPath(agentGroup.id, session.id);
  if (!fs.existsSync(inPath)) return;

  let inDb: Database.Database;
  let outDb: Database.Database | null = null;
  try {
    inDb = openInboundDb(agentGroup.id, session.id);
  } catch {
    return;
  }

  try {
    outDb = openOutboundDb(agentGroup.id, session.id);
  } catch {
    // outbound.db might not exist yet (container hasn't started)
  }

  try {
    // 1. Sync processing_ack → messages_in status
    if (outDb) {
      syncProcessingAcks(inDb, outDb);
    }

    // 1b. Runaway detection (non-blocking). Runs after ack-sync so the
    // turn/output counts reflect synced state. NEVER stops the session — on a
    // fresh runaway episode it only surfaces an admin card; a human clicking
    // Stop is the only thing that ends the session. Module-gated: no-op when
    // the runaway module isn't installed.
    // MODULE-HOOK:runaway-detect:start
    if (outDb) {
      try {
        const [{ checkRunaway }, { runawayCardDeps }] = await Promise.all([
          import('./modules/runaway/detect.js'),
          import('./modules/runaway/index.js'),
        ]);
        await checkRunaway(session, outDb, runawayCardDeps);
      } catch (err) {
        log.debug('runaway detect skipped', { sessionId: session.id, err });
      }
    }
    // MODULE-HOOK:runaway-detect:end

    // 1c. Critique-gate escalation: a session that hit the gate's denial cap
    // writes .claude/critique-escalation.json (host-visible — /workspace is
    // the session-dir mount); turn a fresh request into an admin approval
    // card. Non-blocking and module-gated like runaway.
    // MODULE-HOOK:critique-escalation:start
    try {
      const { checkCritiqueEscalation } = await import('./modules/critique-escalation/index.js');
      await checkCritiqueEscalation(session);
    } catch (err) {
      log.debug('critique escalation check skipped', { sessionId: session.id, err });
    }
    // MODULE-HOOK:critique-escalation:end

    // 1b. Reclaim bounced claims BEFORE the wake below. Ordering is
    // load-bearing, and the reason is subtle:
    //
    // A `bounced-*` processing_ack hides its message from the container's poll
    // (getPendingMessages filters on ackedIds) while messages_in stays
    // 'pending'. The container's own startup cleanup only clears
    // status='processing' (clearStaleProcessingAcks), so a container restart can
    // never reclaim a bounced row — only this path can.
    //
    // Left in step 4, it was unreachable in EVERY state: container up => the
    // !alive gate skips it; container down => step 2 sees the still-due hidden
    // message, spawns a container, and `alive` flips true before step 4 is
    // reached. The message that needs healing is exactly what arms the wake that
    // suppresses the healing. Observed in prod 2026-07-17..08-04: a `*/5` task
    // frozen 18 days behind one bounced-transient ack, tries stuck at 0, while
    // the container truthfully logged "0 pending" on every poll.
    //
    // Still gated on the container being down: this DELETEs from outbound.db,
    // and exactly-one-writer per file is the invariant that makes the two-DB
    // split safe.
    if (outDb && !isContainerRunning(session.id)) {
      redriveBouncedA2a(inDb, outDb, session);
    }

    // 2. Wake a container if work is due and nothing is running. Ordered
    // before the crashed-container cleanup so a fresh container gets a chance
    // to clean its own orphan processing_ack rows on startup (see
    // container/agent-runner/src/db/connection.ts). Otherwise the reset path
    // would keep bumping process_after into the future, dueCount would stay 0,
    // and the wake would never fire.
    let justSpawned = false;
    const dueCount = countDueMessages(inDb);
    if (dueCount > 0 && !isContainerRunning(session.id)) {
      log.info('Waking container for due messages', { sessionId: session.id, count: dueCount });
      // wakeContainer never throws — transient spawn failures (OneCLI down,
      // etc.) return false and leave messages pending for the next tick.
      await wakeContainer(session);
      justSpawned = true;
    }

    const alive = isContainerRunning(session.id);

    // 3. Running-container SLA: absolute ceiling + per-claim stuck rules.
    // Skip on the same tick that spawned the container — give it time to
    // start up and clear orphan processing_ack rows from a prior crash.
    // Without this gate, stale claims from the crashed container cause an
    // immediate kill (spawn-kill loop).
    if (alive && outDb && !justSpawned) {
      enforceRunningContainerSla(inDb, outDb, session, agentGroup.id);
    }

    // 4. Crashed-container cleanup: processing rows left behind get retried.
    // Only fires when wake in step 2 didn't pick up the work (no due messages,
    // or wake failed). resetStuckProcessingRows itself is idempotent — it
    // skips messages already scheduled for a future retry.
    if (!alive && outDb) {
      resetStuckProcessingRows(inDb, outDb, session, 'container not running');
      // Bounced-claim redrive moved to step 1b — see the note there. Running it
      // here made it unreachable whenever the bounced message was itself due.
    }

    // 5. Recurrence fanout for completed recurring tasks.
    // MODULE-HOOK:scheduling-recurrence:start
    const { handleRecurrence } = await import('./modules/scheduling/recurrence.js');
    await handleRecurrence(inDb, session);
    // MODULE-HOOK:scheduling-recurrence:end

    // 6. GC spent task sessions. An isolated per-task session with no live task
    // rows left (one-shot fired, or all cancelled/deleted) and no container
    // running is dead — close it so it stops being swept and listed. Runs after
    // recurrence so a just-fired recurring series has already re-armed its next
    // pending row and is never collected. The per-task log file in the workspace
    // is the durable history and survives the close.
    if (isTaskThread(session.thread_id)) {
      const liveTasks = (
        inDb
          .prepare("SELECT COUNT(*) AS c FROM messages_in WHERE kind = 'task' AND status IN ('pending', 'paused')")
          .get() as { c: number }
      ).c;
      if (shouldCloseTaskSession(session.thread_id, isContainerRunning(session.id), liveTasks)) {
        updateSession(session.id, { status: 'closed' });
        log.info('Closed spent task session', { sessionId: session.id, threadId: session.thread_id });
      }
    }
  } finally {
    inDb.close();
    outDb?.close();
  }
}

function heartbeatMtimeMs(agentGroupId: string, sessionId: string): number {
  const hbPath = heartbeatPath(agentGroupId, sessionId);
  try {
    return fs.statSync(hbPath).mtimeMs;
  } catch {
    return 0;
  }
}

function bashTimeoutMs(state: ContainerState | null): number | null {
  if (!state || state.current_tool !== 'Bash') return null;
  return typeof state.tool_declared_timeout_ms === 'number' ? state.tool_declared_timeout_ms : null;
}

function enforceRunningContainerSla(
  inDb: Database.Database,
  outDb: Database.Database,
  session: Session,
  agentGroupId: string,
): void {
  // Filter out orphan claims from before this service started — they're
  // leftovers from a prior run. The container cleans its own processing_ack
  // on startup; killing it before that cleanup runs causes a respawn loop.
  const allClaims = getProcessingClaims(outDb);
  const claims = allClaims.filter((c) => {
    const ts = parseSqliteUtc(c.status_changed);
    return !Number.isNaN(ts) && ts >= SERVICE_START_MS;
  });

  const decision = decideStuckAction({
    now: Date.now(),
    heartbeatMtimeMs: heartbeatMtimeMs(agentGroupId, session.id),
    containerState: getContainerState(outDb),
    claims,
  });

  if (decision.action === 'ok') return;

  if (decision.action === 'kill-ceiling') {
    log.warn('Killing container past absolute ceiling', {
      sessionId: session.id,
      heartbeatAgeMs: decision.heartbeatAgeMs,
      ceilingMs: decision.ceilingMs,
    });
    killContainer(session.id, 'absolute-ceiling');
    resetStuckProcessingRows(inDb, outDb, session, 'absolute-ceiling');
    return;
  }

  log.warn('Killing container — message claimed then silent', {
    sessionId: session.id,
    messageId: decision.messageId,
    claimAgeMs: decision.claimAgeMs,
    toleranceMs: decision.toleranceMs,
  });
  killContainer(session.id, 'claim-stuck');
  resetStuckProcessingRows(inDb, outDb, session, 'claim-stuck');
}

export function _resetStuckProcessingRowsForTesting(
  inDb: Database.Database,
  outDb: Database.Database,
  session: Session,
  reason: string,
): void {
  resetStuckProcessingRows(inDb, outDb, session, reason, outDb);
}

/**
 * Redrive bounced a2a handoffs (Part b of the a2a-redrive fix).
 *
 * The container marks a transient/unknown a2a bounce with a distinct
 * processing_ack status ('bounced-transient'|'bounced-unknown') instead of
 * 'completed', which leaves the trigger `messages_in` row `pending`
 * (syncProcessingAcks ignores those statuses). Here — ONLY when the container
 * is dead (temporal single-writer, mirroring resetStuckProcessingRows) — we:
 *
 *   1. re-arm the still-pending trigger with an outage-scale backoff (so it
 *      re-delivers to the SAME recipient session on a later wake — no re-route,
 *      no duplicate row, no echo-drop interaction), OR
 *   2. dead-letter it (notify the delegator session, else escalate to an admin)
 *      once its per-class budget is spent.
 *
 * Recovery lives entirely in the session layer — no GitHub dependency.
 */
type DeadLetterFn = (
  recipientSession: Session,
  row: { id: string; tries: number; sourceSessionId: string | null; threadId: string | null },
  status: string,
) => void;

function redriveBouncedA2a(
  inDb: Database.Database,
  outDb: Database.Database,
  session: Session,
  // Injectable seams for unit testing — production passes neither.
  writableOutDb?: Database.Database,
  deadLetter: DeadLetterFn = (s, r, st) =>
    deadLetterBouncedHandoff(s, r, st).catch((err) =>
      log.error('a2a dead-letter delivery failed', { sessionId: s.id, messageId: r.id, err }),
    ),
): void {
  const claims = getBouncedClaims(outDb);
  if (claims.length === 0) return;
  const now = Date.now();
  const handled: string[] = [];

  for (const { message_id, status } of claims) {
    const row = getBouncedTriggerRow(inDb, message_id);
    if (!row) {
      // Trigger no longer pending (already re-armed/failed/gone) — clear the
      // stale marker so it doesn't linger.
      handled.push(message_id);
      continue;
    }
    // Idempotency: already scheduled for a future retry — leave the marker; a
    // later tick (after process_after elapses) will clear it. Same guard as
    // resetStuckProcessingRows.
    if (row.processAfter && parseSqliteUtc(row.processAfter) > now) continue;
    // Non-a2a bounce (channel_type NULL — e.g. a scheduled task, which never
    // sets platform/channel/thread). No a2a backoff applies, but clearing the
    // claim is exactly what unblocks it: the row is still 'pending', so once the
    // ack is gone the container's next poll sees it again. Logged because this
    // is the only signal that a task turn bounced and was reclaimed — it was
    // silent before, which is why an 18-day freeze left no trace.
    if (row.channelType !== 'agent') {
      handled.push(message_id);
      log.info('Reclaimed non-a2a bounced claim', {
        sessionId: session.id,
        messageId: message_id,
        status,
        tries: row.tries,
      });
      continue;
    }

    const maxTries = status === 'bounced-transient' ? A2A_MAX_TRIES : A2A_UNKNOWN_MAX_TRIES;
    if (row.tries < maxTries) {
      const backoffMs = Math.min(A2A_BACKOFF_CAP_MS, A2A_BACKOFF_BASE_MS * Math.pow(2, row.tries));
      // Re-arm FIRST (sets a future process_after + tries++), THEN clear the
      // marker below — ordering is load-bearing: clearing the ack makes the row
      // pollable again, so process_after must already be in the future or it
      // would re-fire with no backoff.
      retryWithBackoff(inDb, message_id, Math.floor(backoffMs / 1000));
      handled.push(message_id);
      log.info('Re-armed bounced a2a handoff', {
        sessionId: session.id,
        messageId: message_id,
        status,
        tries: row.tries,
        backoffMs,
      });
    } else {
      // Budget spent — dead-letter and fail the trigger so it stops redriving.
      markMessageFailed(inDb, message_id);
      handled.push(message_id);
      log.warn('Bounced a2a handoff dead-lettered after max redrive tries', {
        sessionId: session.id,
        messageId: message_id,
        status,
        tries: row.tries,
      });
      // Fire-and-forget the escalation — never let a delivery failure abort the
      // sweep (mirrors the recurrence/notify pattern).
      deadLetter(session, row, status);
    }
  }

  // Clear the handled markers — ONLY the ids we acted on this pass (never a
  // blanket clear). Safe: container is dead (caller gates on !alive), so we are
  // the sole writer. Tests pass an already-open writable handle; production
  // opens one (the read-only outDb the sweep holds can't DELETE).
  if (handled.length > 0) {
    const ownsDb = !writableOutDb;
    let rw: Database.Database | null = writableOutDb ?? null;
    try {
      if (!rw) rw = openOutboundDbRw(session.agent_group_id, session.id);
      const cleared = deleteBouncedClaims(rw, handled);
      if (cleared > 0) log.info('Cleared bounced a2a markers', { sessionId: session.id, cleared });
    } catch (err) {
      log.warn('Failed to clear bounced a2a markers', { sessionId: session.id, err });
    } finally {
      if (ownsDb) rw?.close();
    }
  }
}

/** Test-only shim: run redriveBouncedA2a with injected writable DB + dead-letter spy. */
export function _redriveBouncedA2aForTesting(
  inDb: Database.Database,
  outDb: Database.Database,
  session: Session,
  deadLetter: DeadLetterFn,
): void {
  redriveBouncedA2a(inDb, outDb, session, outDb, deadLetter);
}

/**
 * Dead-letter a bounced handoff: notify the delegating session if it is still
 * alive (self-heal one hop up the chain), else escalate to an admin as a
 * notification (NOT an approval gate). Includes enough context to re-drive
 * safely: recipient group/session, source session, thread, message id, retries.
 */
async function deadLetterBouncedHandoff(
  recipientSession: Session,
  row: { id: string; tries: number; sourceSessionId: string | null; threadId: string | null },
  status: string,
): Promise<void> {
  const sourceSessionId = row.sourceSessionId ?? getSourceFor(recipientSession.id)?.source_session_id ?? null;
  const detail =
    `[a2a-redrive] Handoff to ${recipientSession.agent_group_id} (session ${recipientSession.id}` +
    `${row.threadId ? `, thread ${row.threadId}` : ''}) bounced ${row.tries}× on transient/unknown ` +
    `provider errors (${status}) and was NOT delivered. Original message ${row.id}. ` +
    `Re-drive the handoff or escalate — it will not self-recover.`;

  const { notifyAgent, pickApprover, pickApprovalDelivery } = await import('./modules/approvals/primitive.js');

  if (sourceSessionId) {
    const sourceSession = getSession(sourceSessionId);
    if (sourceSession && sourceSession.status === 'active') {
      // Self-heal one hop up the chain: let the delegator re-drive or escalate.
      notifyAgent(sourceSession, detail);
      return;
    }
  }

  // No live delegator — escalate to an admin as a plain chat notification (NOT
  // an approval gate). Reuse the same approver resolution + DM delivery the
  // approvals primitive uses, but send a chat, not an ask_question card.
  const approvers = pickApprover(recipientSession.agent_group_id);
  const delivery = await pickApprovalDelivery(approvers, '');
  if (delivery) {
    const { getDeliveryAdapter } = await import('./delivery.js');
    const adapter = getDeliveryAdapter();
    if (adapter) {
      await adapter.deliver(
        delivery.messagingGroup.channel_type,
        delivery.messagingGroup.platform_id,
        null,
        'chat',
        JSON.stringify({ text: detail }),
      );
      return;
    }
  }
  log.error('a2a dead-letter: no delegator session and no admin to escalate to', {
    sessionId: recipientSession.id,
    messageId: row.id,
  });
}

function resetStuckProcessingRows(
  inDb: Database.Database,
  outDb: Database.Database,
  session: Session,
  reason: string,
  writableOutDb?: Database.Database,
): void {
  const claims = getProcessingClaims(outDb);
  const now = Date.now();
  for (const { message_id } of claims) {
    const msg = getMessageForRetry(inDb, message_id, 'pending');
    if (!msg) continue;

    // Already rescheduled for a future retry — don't bump tries again. The
    // wake path (sweep step 2) will fire when process_after elapses and a
    // fresh container will clean the orphan claim on startup.
    if (msg.processAfter && parseSqliteUtc(msg.processAfter) > now) continue;

    if (msg.tries >= MAX_TRIES) {
      markMessageFailed(inDb, msg.id);
      log.warn('Message marked as failed after max retries', {
        messageId: msg.id,
        sessionId: session.id,
        reason,
      });
    } else {
      const backoffMs = BACKOFF_BASE_MS * Math.pow(2, msg.tries);
      const backoffSec = Math.floor(backoffMs / 1000);
      retryWithBackoff(inDb, msg.id, backoffSec);
      log.info('Reset stale message with backoff', {
        messageId: msg.id,
        tries: msg.tries,
        backoffMs,
        reason,
      });
    }
  }

  // Drop the orphan 'processing' rows. Without this, the next sweep tick
  // would re-read them, see the old status_changed timestamp, conclude the
  // freshly respawned container is stuck, and SIGKILL it before its
  // agent-runner has a chance to run clearStaleProcessingAcks() on startup.
  // Safe because this only runs when the container is dead (step 4) or just
  // killed (step 3 kill path).
  if (claims.length > 0) {
    const ownsDb = !writableOutDb;
    let useDb: Database.Database | null = writableOutDb ?? null;
    try {
      if (!useDb) useDb = openOutboundDbRw(session.agent_group_id, session.id);
      const cleared = deleteOrphanProcessingClaims(useDb);
      if (cleared > 0) {
        log.info('Cleared orphan processing claims', { sessionId: session.id, cleared, reason });
      }
    } catch (err) {
      log.warn('Failed to clear orphan processing claims', { sessionId: session.id, err });
    } finally {
      if (ownsDb) useDb?.close();
    }
  }
}
