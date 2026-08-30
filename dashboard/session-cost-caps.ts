/**
 * Live per-session cost-cap/ceiling state — pure parsing + shaping core for the
 * Sessions tab's "set ceiling" control (dash-1 set-ceiling-v2).
 *
 * This module owns three things, kept separate from server.ts and scan-worker.mjs
 * so each is directly unit-testable without spinning up the HTTP server or a
 * worker_threads worker:
 *
 *   1. Parsing the raw `session_state.value` TEXT (JSON) the runner writes into a
 *      session's outbound.db under key `cost_cap`, and deriving the two NEW signals
 *      a v2-capable runner adds to that same blob: a protocol/version marker and a
 *      generation/"epoch" token for optimistic concurrency. Both are read
 *      TOLERANTLY (several candidate field names) because this dashboard PR and the
 *      paired host+runner PR (separate branch, landing separately — see the PR
 *      description) are developed in parallel against a schema that isn't frozen
 *      yet; only the browser<->dashboard<->host HTTP contract is fixed. Reading
 *      tolerantly means an unrecognized/older shape degrades to "no v2 signal"
 *      (control hidden) rather than throwing — fail closed, never fail loud.
 *   2. Converting a `cost_escalation_episodes` row (host-owned central-DB table,
 *      migration 941 on the paired PR) into the `latestCostAdjustment` shape the
 *      fixed GET /api/sessions contract specifies. Also best-effort/fails-soft:
 *      that table doesn't exist at all on this branch today.
 *   3. Validating the browser's POST body against the fixed wire contract before
 *      this dashboard forwards anything upstream — never proxy a shape violation.
 *
 * Dollar/cents convention: fields that already shipped before this feature
 * (costCap/costSpent/costCeiling) stay in DOLLARS, matching their existing wire
 * shape (nothing renders costCap today, but costSpent/costCeiling already do, in
 * dollars — see renderCostCapCell in app.js). costLifetime is likewise DOLLARS
 * (it's the same money the cost column already prices, just unfiltered by the
 * day-window). New money fields introduced by this feature are CENTS
 * (costCeilingCents, targetCeilingCents, expectedCeilingCents),
 * per the fixed wire contract's "all money in integer cents on the wire" rule for
 * the new control. costCeilingCents is DERIVED from costCeiling (one source of
 * truth: the runner's ceilingUsd), never read/stored independently.
 */

// ---------- cost_cap blob parsing ----------

export type CostCapStatus = 'ok' | 'warn' | 'escalated' | 'stopped';
export type CostCapWindow = 'lifetime' | 'daily';

/** Loosely-typed shape of the `cost_cap` JSON blob, as published by the runner
 *  into outbound.db `session_state` (key `cost_cap`). Only the fields this
 *  feature reads are named; the blob may carry more (escalatedAt, decision,
 *  decidedAt, …) that this dashboard doesn't currently surface. */
export interface RawCostCapBlob {
  capUsd?: number;
  spentUsd?: number;
  status?: CostCapStatus;
  immortal?: boolean;
  window?: CostCapWindow;
  ceilingUsd?: number;
  // Candidate field names for the two NEW v2 signals — see the module doc for
  // why several are checked. A v2-capable runner is expected to publish one of
  // these; which one is confirmed once the paired PR lands.
  supportsSetCeiling?: boolean;
  costControlProtocol?: number;
  protocolVersion?: number;
  epochKey?: string | number;
  budgetGen?: string | number;
  lastCostOverride?: { budgetGen?: string | number; requestId?: string };
  [key: string]: unknown;
}

/** Parse the raw `session_state.value` TEXT for key `cost_cap`. Returns null on
 *  anything that isn't a JSON object (missing row, corrupt text, wrong shape) —
 *  callers treat null as "no live cost data for this session" and omit the
 *  session's cost fields entirely, exactly like today's "older runner / no
 *  accrual yet" degradation. */
export function parseCostCapBlob(raw: string | null | undefined): RawCostCapBlob | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as RawCostCapBlob) : null;
  } catch {
    return null;
  }
}

/**
 * Runner protocol readiness — the rollout gate for the live set-ceiling control.
 * `undefined` means "no cost data at all" (nothing to gate); `1` means "reports
 * cost_cap but no v2 signal found" (legacy Tier-2 continue/stop only); `>=2` means
 * the runner understands live `set_ceiling`. Checked in priority order: an
 * explicit numeric field beats the boolean flag (the boolean is the one concrete
 * field name confirmed in the paired PR's current WIP; the numeric fields are
 * forward-compatible guesses in case it ships a real version number instead).
 * Never throws — a malformed field is simply skipped.
 */
export function deriveControlVersion(blob: RawCostCapBlob | null): number | undefined {
  if (!blob) return undefined;
  const numericCandidates = [blob.costControlProtocol, blob.protocolVersion];
  for (const v of numericCandidates) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  if (blob.supportsSetCeiling === true) return 2;
  return 1;
}

/**
 * Optimistic-concurrency token for the live ceiling ("budgetGen" in the runner's
 * own state — see container/agent-runner/src/db/session-state.ts on the paired
 * PR). Stringified because the wire contract carries it as a string
 * (`expectedEpochKey: "7"`). Falls back to '0' when the runner hasn't started
 * publishing one yet — inert until costControlVersion >= 2 gates the control on,
 * at which point a real runner is expected to be populating this too; if it
 * somehow isn't, the host's own CAS still refuses a stale/absent epoch (409),
 * so an imprecise fallback here is a conflict-and-retry, never a silent
 * wrong-value write.
 */
export function deriveEpochKey(blob: RawCostCapBlob | null): string {
  if (!blob) return '0';
  const candidates: unknown[] = [blob.epochKey, blob.budgetGen, blob.lastCostOverride?.budgetGen];
  for (const v of candidates) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '0';
}

/** cost_cap fields as tracked in the dashboard's always-fresh in-memory map
 *  (fed by the scan worker + main-thread fallback — see server.ts). One entry
 *  per session with a readable cost_cap row; sessions with none simply have no
 *  map entry (join in /api/sessions treats absence as "no cost data"). */
export interface SessionCostCapEntry {
  agentGroupId: string;
  capUsd?: number;
  spentUsd?: number;
  status?: CostCapStatus;
  immortal?: boolean;
  window?: CostCapWindow;
  ceilingUsd?: number;
  epochKey: string;
  controlVersion?: number;
  /** ISO timestamp this entry was last (re)read — the outbound.db file's mtime
   *  at read time, which advances on every commit (journal_mode=DELETE), so it
   *  is an honest "cost state last changed" signal without the runner needing
   *  to publish its own timestamp. */
  updatedAt: string;
}

/** Build a map entry from a freshly-parsed blob, or null when there's nothing
 *  to publish (blob absent/unparseable) — the caller should delete any existing
 *  map entry for this session in that case (the runner cleared its state, or
 *  the read transiently failed and the caller is choosing not to clobber... see
 *  callers: a transient read failure passes the PREVIOUS raw text through
 *  unchanged rather than calling this with null, so null here only ever means
 *  "genuinely absent"). */
export function buildCostCapEntry(agentGroupId: string, blob: RawCostCapBlob | null, updatedAt: string): SessionCostCapEntry | null {
  if (!blob) return null;
  return {
    agentGroupId,
    capUsd: typeof blob.capUsd === 'number' ? blob.capUsd : undefined,
    spentUsd: typeof blob.spentUsd === 'number' ? blob.spentUsd : undefined,
    status: blob.status,
    immortal: typeof blob.immortal === 'boolean' ? blob.immortal : undefined,
    window: blob.window,
    ceilingUsd: typeof blob.ceilingUsd === 'number' ? blob.ceilingUsd : undefined,
    epochKey: deriveEpochKey(blob),
    controlVersion: deriveControlVersion(blob),
    updatedAt,
  };
}

/** usd -> integer cents, rounding away floating-point noise. undefined/NaN in,
 *  undefined out (never fabricate a $0 the runner didn't report). */
export function usdToCents(usd: number | undefined | null): number | undefined {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return undefined;
  return Math.round(usd * 100);
}

// ---------- GET /api/sessions field shaping ----------

/** The additive fields this feature joins onto each /api/sessions row, per the
 *  fixed wire contract. Every field is independent of the `period` query param —
 *  that's the whole point (requirement (a): a session's live ceiling must be
 *  visible regardless of the selected day-window). Absent entry -> every field
 *  comes back undefined, which JSON.stringify omits, matching the pre-existing
 *  "older runner / no accrual yet -> no cap fields" degradation. */
export interface SessionCostFields {
  costCap?: number;
  costSpent?: number;
  /** The session's TOTAL LIFETIME cost in DOLLARS — the `'all'`-period sum of
   *  its day buckets (the same money the cost column prices, just unfiltered by
   *  the selected day-window). Distinct from costSpent, which is the runner's
   *  internal WINDOWED enforcement counter (per-fire / per-day) — a different,
   *  usually smaller scope. The pill renders this as its spent number (x in
   *  "x / y ceiling"); see renderCostCapCell in app.js. Undefined when the
   *  session has no scanned cost yet (render falls back to costSpent). */
  costLifetime?: number;
  costStatus?: CostCapStatus;
  costCeiling?: number;
  costCeilingCents?: number;
  costEpochKey?: string;
  costImmortal?: boolean;
  costWindow?: CostCapWindow;
  costStateUpdatedAt?: string;
  costControlVersion?: number;
  latestCostAdjustment?: LatestCostAdjustment;
}

export function buildSessionCostFields(
  entry: SessionCostCapEntry | null | undefined,
  latestAdjustment: LatestCostAdjustment | null | undefined,
  // The session's total lifetime cost in dollars, sourced by the caller from the
  // `'all'`-period cost cache (NOT from the cap `entry`, whose spentUsd is the
  // windowed enforcement counter). Undefined when the session has no scanned
  // cost yet — the field is then omitted and the pill falls back to costSpent.
  lifetimeUsd?: number,
): SessionCostFields {
  return {
    costCap: entry?.capUsd,
    costSpent: entry?.spentUsd,
    costLifetime: typeof lifetimeUsd === 'number' && Number.isFinite(lifetimeUsd) ? lifetimeUsd : undefined,
    costStatus: entry?.status,
    costCeiling: entry?.ceilingUsd,
    costCeilingCents: usdToCents(entry?.ceilingUsd),
    costEpochKey: entry?.epochKey,
    costImmortal: entry?.immortal,
    costWindow: entry?.window,
    costStateUpdatedAt: entry?.updatedAt,
    costControlVersion: entry?.controlVersion,
    latestCostAdjustment: latestAdjustment ?? undefined,
  };
}

// ---------- latestCostAdjustment (cost_escalation_episodes join) ----------

export type LatestCostAdjustmentState = 'pending' | 'enqueued' | 'applied' | 'conflict' | 'rejected';

export interface LatestCostAdjustment {
  id: string;
  state: LatestCostAdjustmentState;
  targetCeilingCents: number;
  requestedAt: string;
}

/** Shape of a `cost_escalation_episodes` row this feature cares about (host
 *  migration 941, on the SEPARATE paired PR — not present on this branch). Only
 *  rows with target_ceiling_usd set are set_ceiling operations — that column is
 *  the table's own documented operation discriminator (a plain continue/stop
 *  never populates it), so callers filter on `target_ceiling_usd IS NOT NULL`. */
export interface CostEpisodeLikeRow {
  episode_id: string;
  session_id: string;
  decision_state: string;
  effect_state: string | null;
  target_ceiling_usd: number | null;
  created_at: string;
}

/**
 * Map a raw episode row to the wire's `latestCostAdjustment` shape.
 *
 * Uses BOTH lifecycle columns the episodes table tracks: `decision_state` (has
 * the CAS been won/lost/expired?) and `effect_state` (has the WIN actually been
 * applied yet?) — a single column can't distinguish "CAS just won, effect not
 * confirmed yet" (wire state 'enqueued') from "effect confirmed applied" (wire
 * state 'applied'), and collapsing that distinction would make a still-in-flight
 * request look done. superseded (another request/card won this epoch first) ->
 * 'conflict'; expired -> 'rejected'; anything else unresolved -> 'pending'.
 */
export function mapEpisodeToLatestAdjustment(row: CostEpisodeLikeRow | null | undefined): LatestCostAdjustment | null {
  if (!row || row.target_ceiling_usd == null) return null;
  const targetCeilingCents = usdToCents(row.target_ceiling_usd);
  if (targetCeilingCents == null) return null;
  let state: LatestCostAdjustmentState;
  if (row.effect_state === 'applied') state = 'applied';
  else if (row.decision_state === 'ceiling_set') state = 'enqueued';
  else if (row.decision_state === 'pending') state = 'pending';
  else if (row.decision_state === 'superseded') state = 'conflict';
  else state = 'rejected'; // expired, or any other terminal-without-effect state
  return { id: row.episode_id, state, targetCeilingCents, requestedAt: row.created_at };
}

// ---------- POST /api/sessions/:id/cost-ceiling request validation ----------

export interface CeilingRequestBody {
  requestId: string;
  targetCeilingCents: number;
  expectedEpochKey: string;
  expectedCeilingCents: number;
}

const MIN_TARGET_CEILING_CENTS = 1;
const MAX_TARGET_CEILING_CENTS = 100_000; // $1,000.00 — the fixed wire contract's bound
const MAX_REQUEST_ID_LEN = 200;

export type CeilingRequestValidation = { ok: true; value: CeilingRequestBody } | { ok: false; error: string };

/**
 * Validate the browser's POST body against the fixed wire contract BEFORE this
 * dashboard forwards anything upstream. This is defense in depth, not the
 * primary safety boundary — the host independently enforces the same
 * targetCeilingCents bound (see the PR description) — but a manipulated/bypassed
 * request (skipped client-side validation, hand-crafted fetch) must still be
 * rejected here rather than silently proxied to the host with an out-of-range
 * value.
 */
export function validateCeilingRequest(body: unknown): CeilingRequestValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  const requestId = b.requestId;
  if (typeof requestId !== 'string' || !requestId.trim() || requestId.length > MAX_REQUEST_ID_LEN) {
    return { ok: false, error: 'requestId (non-empty string) required' };
  }
  const targetCeilingCents = b.targetCeilingCents;
  if (
    typeof targetCeilingCents !== 'number' ||
    !Number.isInteger(targetCeilingCents) ||
    targetCeilingCents < MIN_TARGET_CEILING_CENTS ||
    targetCeilingCents > MAX_TARGET_CEILING_CENTS
  ) {
    return {
      ok: false,
      error: `targetCeilingCents must be an integer in [${MIN_TARGET_CEILING_CENTS}, ${MAX_TARGET_CEILING_CENTS}]`,
    };
  }
  const expectedEpochKey = b.expectedEpochKey;
  if (typeof expectedEpochKey !== 'string' || !expectedEpochKey.trim()) {
    return { ok: false, error: 'expectedEpochKey (non-empty string) required' };
  }
  const expectedCeilingCents = b.expectedCeilingCents;
  if (
    typeof expectedCeilingCents !== 'number' ||
    !Number.isInteger(expectedCeilingCents) ||
    expectedCeilingCents < 0
  ) {
    return { ok: false, error: 'expectedCeilingCents must be a non-negative integer' };
  }
  return {
    ok: true,
    value: { requestId: requestId.trim(), targetCeilingCents, expectedEpochKey: expectedEpochKey.trim(), expectedCeilingCents },
  };
}
