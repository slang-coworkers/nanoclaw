/**
 * Live, per-session, exact-value cost-ceiling control (NanoClaw #1, "set
 * ceiling v2") — the host-side submission flow, runner-receipt ingest, and
 * reconciler. This is the host+runner half of a two-PR feature; the dashboard
 * half (the +/- UI, `POST /api/dashboard/session-cost-ceiling`'s browser side)
 * lands separately on `nv-dashboard`, keyed to the exact wire protocol below.
 *
 * REPLACES the old behavior where "Continue" on a stopped session raised the
 * ceiling by a hidden, fixed, never-displayed amount
 * (`costCeilingAllotmentUsd`). An admin now picks an EXACT target value, on
 * either a stopped session (raise) or a healthy one (proactive raise or
 * lower) — see `container/agent-runner/src/poll-loop.ts`'s
 * `applySetCeilingOverride` for the runner-side counterpart.
 *
 * THE WIRE PROTOCOL (fixed — do not change field names/shapes; the dashboard
 * side depends on this exact contract):
 *
 *   Dashboard → host  `POST /api/dashboard/session-cost-ceiling`:
 *     { protocolVersion: 2, requestId: "cca-<uuid>", sessionId, targetCeilingCents,
 *       expectedEpochKey, expectedCeilingCents }
 *
 *   Host → runner (still `kind:'cost_override'` — an old runner that doesn't
 *   understand this shape safely ignores it rather than feeding it to the
 *   model; see `applyCostOverride`'s dispatch):
 *     { protocolVersion: 2, operation: 'set_ceiling', adjustmentId,
 *       expectedEpochKey, expectedCeilingCents, targetCeilingCents }
 *
 *   Runner → host receipt (`kind:'system'`, `action:'cost_ceiling_adjustment_result'`):
 *     { action, protocolVersion: 2, adjustmentId, sessionId, outcome,
 *       expectedEpochKey, previousEpochKey?, resultEpochKey?, expectedCeilingCents,
 *       previousCeilingCents?, targetCeilingCents, resultCeilingCents?, spentUsd?,
 *       status?, reason? }
 *
 * MONEY-SAFETY SUMMARY (see `src/db/cost-ceiling-adjustments.ts`, migration 942,
 * for the full design rationale):
 *   - The `cost_ceiling_adjustments` ledger's `UNIQUE(session_id,
 *     expected_epoch_key)` is the concurrency control — not a bolted-on CAS.
 *   - `createCostCeilingAdjustment` also fences against a card decision (a
 *     `cost_escalation_episodes` row) racing the same exact epoch, in both
 *     directions: a card that already WON refuses this request (409); a card
 *     still PENDING is superseded so it can never apply after this request wins.
 *   - The runner-instance readiness handshake (`ensureRunnerReady` below) closes
 *     a TOCTOU gap: a stale live-state read must never be able to target a
 *     container that isn't the one that read applies to.
 *   - `recordCostCeilingAdjustmentResult` validates every echoed receipt field
 *     against the central record before accepting it as authoritative, and is
 *     idempotent under replay.
 */
import fs from 'fs';

import { getAgentGroup } from '../../db/agent-groups.js';
import {
  bumpCostCeilingAdjustmentAttempt,
  createCostCeilingAdjustment,
  getCostCeilingAdjustment,
  listUnfinishedCostCeilingAdjustments,
  markCostCeilingAdjustmentEnqueued,
  recordCostCeilingAdjustmentResult,
  rejectCostCeilingAdjustment,
  type CostCeilingAdjustmentRow,
} from '../../db/cost-ceiling-adjustments.js';
import { getSession } from '../../db/sessions.js';
import { getActiveContainerInstanceId, isContainerRunning, wakeContainer } from '../../container-runner.js';
import { isImmortalGroup } from '../../container-config.js';
import { readSessionCostCapStatus, readSessionCostControlProtocol } from '../../cli/session-cost-cap.js';
import { insertMessageIfAbsent } from '../../mailbox/sqlite/session-db.js';
import { inboundDbPath } from '../../mailbox/sqlite/paths.js';
import { openInboundDb } from '../../session-manager.js';
import { log } from '../../log.js';
import type { Session } from '../../types.js';

/** Server-enforced hard maximum — $1,000.00. Enforced HERE independently of the
 *  runner's own identical check (poll-loop.ts's MAX_CEILING_CENTS); neither
 *  layer trusts the other alone. */
const MAX_CEILING_CENTS = 100_000;

/** Safe charset for an id that becomes both a DB primary key and part of a
 *  deterministic message id — not a security boundary (queries are
 *  parameterized), just hygiene against pathological input. */
const SAFE_ID_PATTERN = /^[A-Za-z0-9:_-]+$/;

// ── Submission flow ─────────────────────────────────────────────────────────

export interface SetCeilingResult {
  status: 200 | 202 | 400 | 404 | 409 | 422 | 426 | 503;
  body: Record<string, unknown>;
}

interface ValidatedRequest {
  requestId: string;
  sessionId: string;
  targetCeilingCents: number;
  expectedEpochKey: string;
  expectedCeilingCents: number;
}

function badRequest(error: string, message: string): SetCeilingResult {
  return { status: 400, body: { ok: false, error, message } };
}

/** Step 1: shape/value validation. Pure — no DB, no I/O. */
function validateRequest(
  raw: unknown,
): { ok: true; value: ValidatedRequest } | { ok: false; result: SetCeilingResult } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, result: badRequest('invalid_shape', 'request body must be a JSON object') };
  }
  const r = raw as Record<string, unknown>;

  if (r.protocolVersion !== 2) {
    return { ok: false, result: badRequest('invalid_protocol_version', 'protocolVersion must be 2') };
  }

  const requestId = typeof r.requestId === 'string' ? r.requestId.trim() : '';
  if (!requestId || requestId.length > 200 || !SAFE_ID_PATTERN.test(requestId)) {
    return { ok: false, result: badRequest('invalid_request_id', 'requestId must be a non-empty id string') };
  }

  const sessionId = typeof r.sessionId === 'string' ? r.sessionId.trim() : '';
  if (!sessionId) {
    return { ok: false, result: badRequest('invalid_session_id', 'sessionId is required') };
  }

  const targetCeilingCents = r.targetCeilingCents;
  if (
    typeof targetCeilingCents !== 'number' ||
    !Number.isInteger(targetCeilingCents) ||
    targetCeilingCents < 1 ||
    targetCeilingCents > MAX_CEILING_CENTS
  ) {
    return {
      ok: false,
      result: badRequest(
        'invalid_target_ceiling_cents',
        `targetCeilingCents must be an integer between 1 and ${MAX_CEILING_CENTS}`,
      ),
    };
  }

  const expectedEpochKey = typeof r.expectedEpochKey === 'string' ? r.expectedEpochKey : '';
  if (!expectedEpochKey) {
    return { ok: false, result: badRequest('invalid_expected_epoch_key', 'expectedEpochKey is required') };
  }

  const expectedCeilingCents = r.expectedCeilingCents;
  if (typeof expectedCeilingCents !== 'number' || !Number.isInteger(expectedCeilingCents) || expectedCeilingCents < 0) {
    return {
      ok: false,
      result: badRequest('invalid_expected_ceiling_cents', 'expectedCeilingCents must be a non-negative integer'),
    };
  }

  if (targetCeilingCents === expectedCeilingCents) {
    return {
      ok: false,
      result: badRequest('no_op_target', 'targetCeilingCents equals expectedCeilingCents — nothing to change'),
    };
  }

  return { ok: true, value: { requestId, sessionId, targetCeilingCents, expectedEpochKey, expectedCeilingCents } };
}

function adjustmentResponseBody(row: CostCeilingAdjustmentRow): Record<string, unknown> {
  return {
    ok: true,
    adjustmentId: row.adjustment_id,
    sessionId: row.session_id,
    state: row.state,
    targetCeilingCents: row.target_ceiling_cents,
    expectedEpochKey: row.expected_epoch_key,
    expectedCeilingCents: row.expected_ceiling_cents,
    requestedAt: row.requested_at,
    ...(row.completed_at
      ? {
          completedAt: row.completed_at,
          resultEpochKey: row.result_epoch_key,
          resultCeilingCents: row.result_ceiling_cents,
          resultSpentUsd: row.result_spent_usd,
          resultCostStatus: row.result_cost_status,
          resultReason: row.result_reason,
        }
      : {}),
  };
}

const TERMINAL_STATES = new Set(['applied', 'conflict', 'rejected']);

/**
 * The full submission flow (steps 1-10 of the module doc comment). The HOST is
 * authoritative for every check here — the dashboard's own read is only a
 * hint the browser used to build the request; nothing it claims is trusted
 * without independently re-reading live state.
 */
export async function submitCostCeilingAdjustment(
  raw: unknown,
  requestedBy = 'dashboard-admin',
): Promise<SetCeilingResult> {
  const validated = validateRequest(raw);
  if (!validated.ok) return validated.result;
  const { requestId, sessionId, targetCeilingCents, expectedEpochKey, expectedCeilingCents } = validated.value;

  // 2. Resolve session.
  const session = await getSession(sessionId);
  if (!session) {
    return { status: 404, body: { ok: false, error: 'session_not_found', message: `session not found: ${sessionId}` } };
  }

  // 3. Resolve group; reject immortal AUTHORITATIVELY from central-DB fields —
  // independent of whatever the runner's own live-state `immortal` flag says.
  const group = await getAgentGroup(session.agent_group_id);
  if (!group) {
    return {
      status: 404,
      body: { ok: false, error: 'agent_group_not_found', message: `agent group not found for session ${sessionId}` },
    };
  }
  if (isImmortalGroup(group)) {
    return {
      status: 422,
      body: {
        ok: false,
        error: 'immortal',
        message: 'immortal (admin/main) sessions cannot be quiesced by this control',
      },
    };
  }

  // 4. Live cost state — the shared host reader (also backs `ncl cost-cap status`).
  const capView = await readSessionCostCapStatus(sessionId);
  if (capView.immortal === true) {
    // Defense in depth: the runner's own self-report agrees with step 3, but
    // step 3 alone is authoritative — this can never be the FIRST place that
    // rejects an immortal session, only a backstop if it somehow were.
    return {
      status: 422,
      body: {
        ok: false,
        error: 'immortal',
        message: 'immortal (admin/main) sessions cannot be quiesced by this control',
      },
    };
  }
  if (capView.status === 'unknown') {
    return {
      status: 422,
      body: { ok: false, error: 'cost_tracking_unavailable', message: 'cost tracking is not active for this session' },
    };
  }
  if (typeof capView.ceiling_usd !== 'number' || capView.ceiling_usd <= 0) {
    return {
      status: 422,
      body: { ok: false, error: 'no_live_ceiling', message: 'this session has no live Tier-2 ceiling configured' },
    };
  }
  if (typeof capView.budget_gen !== 'number') {
    return {
      status: 422,
      body: {
        ok: false,
        error: 'cost_tracking_unavailable',
        message: 'no live budget generation reported for this session',
      },
    };
  }
  const liveEpochKey = String(capView.budget_gen);
  const liveCeilingCents = Math.round(capView.ceiling_usd * 100);
  if (expectedEpochKey !== liveEpochKey || expectedCeilingCents !== liveCeilingCents) {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'stale',
        message: 'the session moved since this value was read',
        liveEpochKey,
        liveCeilingCents,
      },
    };
  }

  // 5. Runner readiness handshake.
  const readiness = await ensureRunnerReady(session);
  if (!readiness.ready) {
    if (readiness.reason === 'unsupported_protocol') {
      return {
        status: 426,
        body: {
          ok: false,
          error: 'unsupported_protocol',
          message: "this session's runner build does not speak protocol 2",
        },
      };
    }
    return {
      status: 503,
      body: { ok: false, error: 'runner_not_ready', message: 'could not confirm the runner was ready in time' },
    };
  }

  // 6. Create the ledger row.
  const inboundMessageId = `cost-ceiling-adjustment:${requestId}`;
  const created = await createCostCeilingAdjustment({
    adjustment_id: requestId,
    protocol_version: 2,
    session_id: session.id,
    agent_group_id: session.agent_group_id,
    expected_epoch_key: expectedEpochKey,
    expected_ceiling_cents: expectedCeilingCents,
    target_ceiling_cents: targetCeilingCents,
    inbound_message_id: inboundMessageId,
    requested_at: new Date().toISOString(),
    requested_by: requestedBy,
  });

  if (created.outcome === 'id-conflict') {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'request_id_conflict',
        message: 'this requestId was already used with a different request body',
      },
    };
  }
  if (created.outcome === 'episode-already-won') {
    return {
      status: 409,
      body: { ok: false, error: 'card_already_decided', message: 'a decision card already resolved this exact epoch' },
    };
  }
  if (created.outcome === 'epoch-conflict') {
    return {
      status: 409,
      body: {
        ok: false,
        error: 'epoch_conflict',
        message: 'another request already claimed this exact epoch',
        winner: created.row.adjustment_id,
      },
    };
  }
  if (created.outcome === 'idempotent-existing') {
    const row = created.row;
    return { status: TERMINAL_STATES.has(row.state) ? 200 : 202, body: adjustmentResponseBody(row) };
  }

  // 7-9. Best-effort enqueue: write the deterministic control message, mark
  // enqueued, wake the session. Failures here do NOT change the HTTP response
  // — the ledger row is already durably accepted (that IS the 202), and the
  // reconciler (`reconcileCostCeilingAdjustments`) re-drives any of these three
  // steps that didn't land, with persisted capped backoff.
  await enqueueAdjustment(session, created.row);

  // 10. Return the ledger row (re-read — enqueue may have advanced its state).
  const finalRow = (await getCostCeilingAdjustment(created.row.adjustment_id)) ?? created.row;
  return { status: 202, body: adjustmentResponseBody(finalRow) };
}

/** The exact control-message content a ledger row implies — a pure function of
 *  the row's own columns, so it can be reproduced identically by the
 *  reconciler without needing to separately persist the content anywhere. */
function controlMessageContent(row: CostCeilingAdjustmentRow): string {
  return JSON.stringify({
    protocolVersion: 2,
    operation: 'set_ceiling',
    adjustmentId: row.adjustment_id,
    expectedEpochKey: row.expected_epoch_key,
    expectedCeilingCents: row.expected_ceiling_cents,
    targetCeilingCents: row.target_ceiling_cents,
  });
}

/**
 * Write the deterministic inbound control message if it isn't already there.
 * Returns `false` (never throws for these two cases) when:
 *   - the session's inbound.db does not exist — deliberately does NOT
 *     reprovision it (see the module doc comment): a deleted/reset session
 *     must not silently accept a pre-reset money action.
 *   - a row with this id already exists but its kind/content do NOT match
 *     byte-for-byte — a mismatched replay is never silently accepted.
 * Both cases are reported so the caller can log/retry rather than treating a
 * `false` return as success.
 *
 * Synchronous and self-contained (raw SQLite escape hatch — see
 * session-manager.ts's "Raw SQLite escape hatches" section): open, write,
 * close within one call, same discipline `withInboundDb` uses.
 */
function writeControlMessageIfAbsent(session: Session, row: CostCeilingAdjustmentRow): boolean {
  const dbPath = inboundDbPath(session.agent_group_id, session.id);
  if (!fs.existsSync(dbPath)) return false;

  const db = openInboundDb(session.agent_group_id, session.id);
  try {
    const content = controlMessageContent(row);
    const result = insertMessageIfAbsent(db, {
      id: row.inbound_message_id,
      kind: 'cost_override',
      timestamp: new Date().toISOString(),
      platformId: 'dashboard:admin',
      channelType: 'dashboard',
      threadId: session.thread_id ?? null,
      content,
      processAfter: null,
      recurrence: null,
      trigger: true,
    });
    if (result.inserted) return true;
    if (result.existing.kind === 'cost_override' && result.existing.content === content) return true; // safe idempotent retry
    log.error(
      'cost-ceiling-adjustment: inbound_message_id collided with a MISMATCHED row — refusing to treat as a safe retry',
      {
        adjustmentId: row.adjustment_id,
        inboundMessageId: row.inbound_message_id,
        sessionId: session.id,
      },
    );
    return false;
  } finally {
    db.close();
  }
}

async function enqueueAdjustment(session: Session, row: CostCeilingAdjustmentRow): Promise<void> {
  try {
    const written = writeControlMessageIfAbsent(session, row);
    if (!written) {
      log.warn('cost-ceiling-adjustment: could not write control message at submission — reconciler will retry', {
        adjustmentId: row.adjustment_id,
        sessionId: session.id,
      });
      return;
    }
    if (row.state === 'pending') await markCostCeilingAdjustmentEnqueued(row.adjustment_id, new Date().toISOString());
    const woke = await wakeContainer(session).catch(() => false);
    if (!woke) {
      log.warn('cost-ceiling-adjustment: wake failed at submission — reconciler will retry', {
        adjustmentId: row.adjustment_id,
        sessionId: session.id,
      });
    }
  } catch (err) {
    log.error('cost-ceiling-adjustment: enqueue failed at submission — reconciler will retry', {
      adjustmentId: row.adjustment_id,
      sessionId: session.id,
      err,
    });
  }
}

// ── Runner-instance readiness handshake ─────────────────────────────────────

const DEFAULT_HANDSHAKE_WAIT_MS = 5_000;
const DEFAULT_HANDSHAKE_POLL_INTERVAL_MS = 250;

// `let`, not `const`, ONLY so __testHooks below can shorten the wait for unit
// tests — production always runs with the DEFAULT_* values above.
let handshakeWaitMs = DEFAULT_HANDSHAKE_WAIT_MS;
let handshakePollIntervalMs = DEFAULT_HANDSHAKE_POLL_INTERVAL_MS;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ReadinessResult = { ready: true } | { ready: false; reason: 'unsupported_protocol' | 'unavailable' };

/**
 * Verify the session's CURRENTLY active container is running a runner build
 * that advertises `cost_control_protocol` version 2, waking it first if it
 * isn't running. No control message is written unless this returns `ready`.
 *
 * The instance-id comparison (not just "a handshake exists") is the whole
 * point: a handshake left over from a PRIOR spawn of the same session id
 * (this exact container died and respawned between the browser's read and
 * this request's arrival) carries the OLD nonce, and is correctly treated as
 * "not ready yet" rather than a stale but superficially-plausible match. The
 * same comparison also fails closed for an ADOPTED runtime (a host restart
 * re-attached to an already-running container it did not itself spawn —
 * `getActiveContainerInstanceId` returns undefined for those; see
 * `container-runner.ts`'s `ActiveSessionRuntime.instanceId` doc comment) —
 * that session cannot accept a live adjustment until it next respawns.
 */
async function ensureRunnerReady(session: Session): Promise<ReadinessResult> {
  if (!isContainerRunning(session.id)) {
    await wakeContainer(session).catch(() => false);
  }

  const deadline = Date.now() + handshakeWaitMs;
  for (;;) {
    const activeInstanceId = getActiveContainerInstanceId(session.id);
    const handshake = activeInstanceId ? await readSessionCostControlProtocol(session.id) : undefined;
    if (activeInstanceId && handshake && handshake.runner_instance_id === activeInstanceId) {
      return handshake.version === 2 ? { ready: true } : { ready: false, reason: 'unsupported_protocol' };
    }
    if (Date.now() >= deadline) return { ready: false, reason: 'unavailable' };
    await sleep(handshakePollIntervalMs);
  }
}

/**
 * Test-only seam (ADDITIVE — no runtime path references this) so unit tests
 * can shorten the readiness-handshake wait instead of burning real wall-clock
 * seconds. Production always runs with the DEFAULT_* constants above.
 */
export const __testHooks = {
  setHandshakeTimingForTest(waitMs: number, pollIntervalMs: number): void {
    handshakeWaitMs = waitMs;
    handshakePollIntervalMs = pollIntervalMs;
  },
  resetHandshakeTimingForTest(): void {
    handshakeWaitMs = DEFAULT_HANDSHAKE_WAIT_MS;
    handshakePollIntervalMs = DEFAULT_HANDSHAKE_POLL_INTERVAL_MS;
  },
};

// ── Runner receipt ingest ───────────────────────────────────────────────────

interface ReceiptPayload {
  adjustmentId?: unknown;
  outcome?: unknown;
  expectedEpochKey?: unknown;
  resultEpochKey?: unknown;
  expectedCeilingCents?: unknown;
  targetCeilingCents?: unknown;
  resultCeilingCents?: unknown;
  spentUsd?: unknown;
  status?: unknown;
  reason?: unknown;
}

/**
 * Ingest a `cost_ceiling_adjustment_result` receipt (registered as a
 * `src/delivery.ts` action). Every echoed field is validated against the
 * central ledger record before being accepted as authoritative — see
 * `recordCostCeilingAdjustmentResult`'s CAS.
 */
export async function ingestCostCeilingAdjustmentReceipt(
  content: Record<string, unknown>,
  session: Session,
): Promise<void> {
  const c = content as ReceiptPayload;
  const adjustmentId = typeof c.adjustmentId === 'string' && c.adjustmentId ? c.adjustmentId : undefined;
  const outcome = c.outcome;
  if (!adjustmentId || (outcome !== 'applied' && outcome !== 'conflict' && outcome !== 'rejected')) {
    log.warn('cost-ceiling-adjustment: receipt with missing/invalid adjustmentId or outcome — ignoring', {
      sessionId: session.id,
      adjustmentId,
      outcome,
    });
    return;
  }

  const result = await recordCostCeilingAdjustmentResult({
    adjustment_id: adjustmentId,
    outcome,
    completed_at: new Date().toISOString(),
    result_epoch_key: typeof c.resultEpochKey === 'string' ? c.resultEpochKey : null,
    result_ceiling_cents: typeof c.resultCeilingCents === 'number' ? c.resultCeilingCents : null,
    result_spent_usd: typeof c.spentUsd === 'number' ? c.spentUsd : null,
    result_cost_status: typeof c.status === 'string' ? c.status : null,
    result_reason: typeof c.reason === 'string' ? c.reason : null,
    session_id: session.id,
    expected_epoch_key: typeof c.expectedEpochKey === 'string' ? c.expectedEpochKey : String(c.expectedEpochKey ?? ''),
    expected_ceiling_cents: Number(c.expectedCeilingCents),
    target_ceiling_cents: Number(c.targetCeilingCents),
  });

  if (result.outcome === 'not-found') {
    log.warn('cost-ceiling-adjustment: receipt for an unknown adjustment_id — ignoring', {
      adjustmentId,
      sessionId: session.id,
    });
    return;
  }
  if (result.outcome === 'mismatch') {
    log.error(
      'cost-ceiling-adjustment: receipt fields do NOT match the central record — refusing to accept as authoritative',
      {
        adjustmentId,
        sessionId: session.id,
      },
    );
    return;
  }
  if (result.outcome === 'replayed-identical') {
    log.info('cost-ceiling-adjustment: receipt replay — already recorded, idempotent no-op', { adjustmentId, outcome });
    return;
  }
  log.info('cost-ceiling-adjustment: outcome recorded', { adjustmentId, outcome, sessionId: session.id });
}

// ── Host-sweep reconciler ───────────────────────────────────────────────────

const RECONCILE_BASE_BACKOFF_MS = 5_000;
const RECONCILE_MAX_BACKOFF_MS = 5 * 60_000;

function computeBackoffMs(attemptsSoFar: number): number {
  return Math.min(RECONCILE_MAX_BACKOFF_MS, RECONCILE_BASE_BACKOFF_MS * 2 ** Math.max(0, attemptsSoFar));
}

/**
 * Repair half-done ledger rows once per sweep tick (see `src/host-sweep.ts`).
 * Never silently gives up — a wake/enqueue failure gets a persisted, capped
 * exponential backoff (`next_attempt_at`), retried forever. Only terminalizes
 * a row on an explicit runner receipt (handled separately, above), session
 * closure, confirmed session-DB loss, or a confirmed protocol-incompatible
 * runner — never on attempt-count alone.
 */
export async function reconcileCostCeilingAdjustments(nowIso: string = new Date().toISOString()): Promise<void> {
  for (const row of await listUnfinishedCostCeilingAdjustments(nowIso)) {
    await reconcileOne(row, nowIso);
  }
}

async function reconcileOne(row: CostCeilingAdjustmentRow, nowIso: string): Promise<void> {
  const session = await getSession(row.session_id);
  if (!session) {
    // Should be unreachable (ON DELETE CASCADE removes this row with the
    // session), but never leave a row stuck if it somehow happens.
    await rejectCostCeilingAdjustment(row.adjustment_id, 'session_gone', nowIso);
    return;
  }
  if (session.status === 'closed') {
    await rejectCostCeilingAdjustment(row.adjustment_id, 'session_closed', nowIso);
    return;
  }
  if (!fs.existsSync(inboundDbPath(session.agent_group_id, session.id))) {
    await rejectCostCeilingAdjustment(row.adjustment_id, 'session_db_missing', nowIso);
    return;
  }

  const written = writeControlMessageIfAbsent(session, row);
  if (!written) {
    await bumpCostCeilingAdjustmentAttempt(
      row.adjustment_id,
      new Date(Date.parse(nowIso) + computeBackoffMs(row.enqueue_attempts)).toISOString(),
      'could not write the deterministic control message (missing DB or a mismatched existing row)',
    );
    return;
  }
  if (row.state === 'pending') await markCostCeilingAdjustmentEnqueued(row.adjustment_id, nowIso);

  // Best-effort protocol-incompatibility check: if a handshake IS present
  // (the runner is up and has spoken) but reports a version other than 2,
  // this row can never resolve — terminalize instead of retrying forever. An
  // ABSENT handshake is NOT the same signal (could just be a cold container
  // that hasn't started yet) and keeps retrying.
  const handshake = await readSessionCostControlProtocol(session.id);
  if (handshake && handshake.version !== 2) {
    await rejectCostCeilingAdjustment(row.adjustment_id, 'unsupported_protocol', nowIso);
    return;
  }

  try {
    const woke = await wakeContainer(session);
    if (!woke) throw new Error('wakeContainer returned false');
  } catch (err) {
    await bumpCostCeilingAdjustmentAttempt(
      row.adjustment_id,
      new Date(Date.parse(nowIso) + computeBackoffMs(row.enqueue_attempts)).toISOString(),
      err instanceof Error ? err.message : String(err),
    );
  }
}
