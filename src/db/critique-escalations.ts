/**
 * Read/write helpers for `critique_escalation_events`.
 *
 * See src/db/migrations/931-critique-escalation-events.ts for schema +
 * rationale. Appends are best-effort by contract: recording history must never
 * be able to block the gate itself, so `recordEscalationEvent` swallows and
 * logs write failures rather than propagating them into the sweep.
 */
import { log } from '../log.js';

import { hasColumn } from './column-info.js';
import { getDb, hasTable } from './connection.js';

/**
 * Lifecycle transitions. The two RELEASE events are `approved` and
 * `failed_open`. `state_divergence` is the integrity event: the session's
 * workflow-state claimed a bypass the host never granted (see
 * migrations/933-critique-bypass-grants.ts). `release_orphaned` is the other
 * integrity event: a grant the gate CONSUMED whose release never reached the
 * host, so the audit trail for that delivery is knowably incomplete (see
 * migrations/936-critique-release-exactly-once.ts).
 */
export type EscalationEventKind =
  | 'self_heal'
  | 'self_healed'
  | 'carded'
  | 'expired'
  | 'approved'
  | 'rejected'
  | 'failed_open'
  | 'release_orphaned'
  | 'state_divergence';

export interface EscalationEvent {
  session_id: string;
  agent_group_id?: string | null;
  approval_id?: string | null;
  event: EscalationEventKind;
  class?: string | null;
  reason?: string | null;
  hit?: string | null;
  repo?: string | null;
  pr_number?: number | null;
  attempt?: number | null;
  requested_at?: number | null;
  /**
   * Exactly-once key, unique-indexed. Set it for any event that can reach the
   * host by more than one route — a release arrives BOTH in the escalation
   * file and in the container's append-only release journal. Leave it unset
   * for events the host itself originates exactly once.
   */
  dedupe_key?: string | null;
}

/**
 * What actually happened to an append. Returned rather than swallowed because
 * a release that could not be recorded is precisely the thing the events table
 * exists to make impossible to miss — the caller has to be able to say so at
 * its own boundary instead of assuming the write landed.
 *
 *   recorded     a new row exists
 *   duplicate    the same dedupe_key was already recorded (the exactly-once
 *                property doing its job — not a failure)
 *   unavailable  the events table is not installed on this host
 *   failed       the insert threw; details are in the error log
 */
export type EventRecordResult = 'recorded' | 'duplicate' | 'unavailable' | 'failed';

/** Does this DB carry migration 936's exactly-once key yet? */
function hasDedupeKey(): Promise<boolean> {
  return hasColumn(getDb(), 'critique_escalation_events', 'dedupe_key');
}

/**
 * Bind values for one append. `dedupe_key` is added only when the column
 * exists: the driver rejects a named parameter the statement does not declare,
 * so a host that has not run migration 936 must not be handed one.
 */
function buildEventParams(e: EscalationEvent, keyed: boolean): Record<string, unknown> {
  const { dedupe_key: dedupeKey, ...rest } = e;
  const params: Record<string, unknown> = {
    agent_group_id: null,
    approval_id: null,
    class: null,
    reason: null,
    hit: null,
    repo: null,
    pr_number: null,
    attempt: null,
    requested_at: null,
    ...rest,
    created_at: new Date().toISOString(),
  };
  if (keyed) params.dedupe_key = dedupeKey ?? null;
  return params;
}

export async function recordEscalationEvent(e: EscalationEvent): Promise<EventRecordResult> {
  try {
    if (!(await hasTable(getDb(), 'critique_escalation_events'))) return 'unavailable';
    const keyed = await hasDedupeKey();
    // OR IGNORE + the partial unique index is what makes "exactly once"
    // structural. A check-then-insert would still double-record two sweeps
    // racing on the same journal line.
    const info = await getDb().run(
      keyed
        ? `INSERT OR IGNORE INTO critique_escalation_events
             (session_id, agent_group_id, approval_id, event, class, reason, hit,
              repo, pr_number, attempt, created_at, requested_at, dedupe_key)
           VALUES (@session_id, @agent_group_id, @approval_id, @event, @class, @reason, @hit,
                   @repo, @pr_number, @attempt, @created_at, @requested_at, @dedupe_key)`
        : `INSERT INTO critique_escalation_events
             (session_id, agent_group_id, approval_id, event, class, reason, hit,
              repo, pr_number, attempt, created_at, requested_at)
           VALUES (@session_id, @agent_group_id, @approval_id, @event, @class, @reason, @hit,
                   @repo, @pr_number, @attempt, @created_at, @requested_at)`,
      buildEventParams(e, keyed),
    );
    return info.changes > 0 ? 'recorded' : 'duplicate';
    // eslint-disable-next-line no-catch-all/no-catch-all -- history must never block the gate
  } catch (err) {
    log.error('Failed to record critique escalation event', { event: e.event, sessionId: e.session_id, err });
    return 'failed';
  }
}

export interface EscalationSummaryRow {
  day: string;
  coworker: string | null;
  event: string;
  class: string | null;
  n: number;
}

/**
 * Per-day / per-coworker / per-outcome counts — the query the dashboard's
 * escalation metrics endpoint runs, and the one that previously required
 * grepping a 64 MB log and decoding epoch-ms out of approval ids.
 */
export async function summarizeEscalations(sinceIso: string): Promise<EscalationSummaryRow[]> {
  if (!(await hasTable(getDb(), 'critique_escalation_events'))) return [];
  return getDb().all<EscalationSummaryRow>(
    `SELECT substr(e.created_at, 1, 10) AS day,
            ag.name                     AS coworker,
            e.event                     AS event,
            e.class                     AS class,
            COUNT(*)                    AS n
       FROM critique_escalation_events e
       LEFT JOIN agent_groups ag ON ag.id = e.agent_group_id
      WHERE e.created_at >= ?
      GROUP BY day, coworker, event, class
      ORDER BY day DESC, coworker, event`,
    sinceIso,
  );
}

/**
 * The PR a session is working, if the mapping exists.
 *
 * The escalation card's whole problem was that it named a session id and
 * nothing else — an operator could not tell which PR was blocked without
 * hand-joining three tables. The gate hook cannot know this (it only sees the
 * container), so the host resolves it at card time.
 *
 * Returns null for a session that has not opened a PR yet, which is itself
 * informative: a `missing critique stages` escalation on an unmapped session
 * is an agent trying to create its first PR with no critique at all.
 */
export async function lookupPrForSession(sessionId: string): Promise<{ repo: string; pr_number: number } | null> {
  if (!(await hasTable(getDb(), 'pr_session_mappings'))) return null;
  const row = await getDb().get<{ repo: string; pr_number: number }>(
    'SELECT repo, pr_number FROM pr_session_mappings WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
    sessionId,
  );
  return row ?? null;
}

// ── Bypass grant ledger ───────────────────────────────────────────────────
// The host's own record of every bypass it actually granted. See
// migrations/933-critique-bypass-grants.ts. Unlike the escalation-event
// appends above these are NOT best-effort: if the ledger write fails the grant
// must fail too, because a grant the ledger does not know about is exactly the
// thing the sweep revokes.

export interface BypassGrant {
  grant_id: string;
  session_id: string;
  requested_at: number | null;
  granted_at: string;
  expires_at: string;
  granted_by: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  /**
   * When the host recorded the release this grant paid for. A grant with
   * `consumed_at` set and this NULL is an OUTSTANDING OBLIGATION: the gate
   * spent the grant and the host has not yet seen where it went. Retiring the
   * escalation file in that window throws away the record the container is
   * still writing into. Host-owned — unlike the `failed_open_recorded` flag in
   * the session-mounted file, nothing in a container can set it.
   */
  release_recorded_at: string | null;
}

/**
 * `SELECT *` returns only the columns the DB actually has. On a host that has
 * not run migration 936 `release_recorded_at` comes back `undefined`, and
 * `undefined !== null` would read as "already recorded" — the exact
 * early-retirement this column exists to prevent. Normalize on the way out.
 */
function normalizeGrant(row: Partial<BypassGrant>): BypassGrant {
  return { ...row, release_recorded_at: row.release_recorded_at ?? null } as BypassGrant;
}

export async function createBypassGrant(g: {
  grant_id: string;
  session_id: string;
  requested_at: number | null;
  granted_at: string;
  expires_at: string;
  granted_by: string | null;
}): Promise<void> {
  if (!(await hasTable(getDb(), 'critique_bypass_grants'))) return;
  await getDb().run(
    `INSERT INTO critique_bypass_grants (grant_id, session_id, requested_at, granted_at, expires_at, granted_by)
     VALUES (@grant_id, @session_id, @requested_at, @granted_at, @expires_at, @granted_by)`,
    g,
  );
}

/**
 * Look a grant up by its id — the approval_id that authorized it.
 *
 * Keyed on the host-owned id rather than `(session_id, requested_at)`:
 * `requested_at` originates in the agent-writable escalation file, so matching
 * on it would let the claimant choose which row it is compared against.
 * Liveness (expiry, consumption, revocation) is evaluated by the caller so a
 * dead grant can still be distinguished from a grant that never existed.
 */
export async function getBypassGrant(grantId: string): Promise<BypassGrant | null> {
  if (!(await hasTable(getDb(), 'critique_bypass_grants'))) return null;
  const row = await getDb().get<Partial<BypassGrant>>(
    'SELECT * FROM critique_bypass_grants WHERE grant_id = ?',
    grantId,
  );
  return row ? normalizeGrant(row) : null;
}

/**
 * The session's newest still-spendable grant.
 *
 * Only used to attribute a consumption that arrived WITHOUT a grant id — a
 * gate older than this host does not write one, and the two gates deploy on
 * different cadences (hooks are bind-mounted and live on restart; the
 * agent-runner ships as a per-group image copy). Without this fallback every
 * legitimate bypass during a skew window would be reported as a forgery.
 */
export async function getLatestSpendableGrant(sessionId: string, nowIso: string): Promise<BypassGrant | null> {
  if (!(await hasTable(getDb(), 'critique_bypass_grants'))) return null;
  const row = await getDb().get<Partial<BypassGrant>>(
    `SELECT * FROM critique_bypass_grants
      WHERE session_id = ? AND consumed_at IS NULL AND revoked_at IS NULL
        AND datetime(expires_at) > datetime(?)
      ORDER BY datetime(granted_at) DESC, rowid DESC
      LIMIT 1`,
    sessionId,
    nowIso,
  );
  return row ? normalizeGrant(row) : null;
}

/** The gate spent the grant; record it so it can never be honoured again. */
export async function markBypassGrantConsumed(grantId: string, consumedAtIso: string): Promise<void> {
  if (!(await hasTable(getDb(), 'critique_bypass_grants'))) return;
  await getDb().run(
    'UPDATE critique_bypass_grants SET consumed_at = ? WHERE grant_id = ? AND consumed_at IS NULL',
    consumedAtIso,
    grantId,
  );
}

/**
 * Discharge a consumed grant's release obligation — the host has recorded
 * where the delivery it paid for went. First write wins, so ingesting the same
 * release from both routes (escalation file and release journal) keeps the
 * first observation time.
 *
 * Silently a no-op on a host that has not run migration 936; the column is
 * additive and its absence only costs the extra retirement protection.
 */
export async function markBypassGrantReleaseRecorded(grantId: string, recordedAtIso: string): Promise<void> {
  if (!(await hasTable(getDb(), 'critique_bypass_grants'))) return;
  if (!(await hasColumn(getDb(), 'critique_bypass_grants', 'release_recorded_at'))) return;
  await getDb().run(
    'UPDATE critique_bypass_grants SET release_recorded_at = ? WHERE grant_id = ? AND release_recorded_at IS NULL',
    recordedAtIso,
    grantId,
  );
}

/**
 * Kill a grant. Also the compensating action when the workflow-state patch
 * fails after the row is inserted — without it the ledger would hold a live
 * grant nobody knows about, which an agent could later claim by forging
 * matching file fields.
 */
export async function revokeBypassGrant(grantId: string, revokedAtIso: string, reason: string): Promise<void> {
  if (!(await hasTable(getDb(), 'critique_bypass_grants'))) return;
  await getDb().run(
    'UPDATE critique_bypass_grants SET revoked_at = ?, revoked_reason = ? WHERE grant_id = ? AND revoked_at IS NULL',
    revokedAtIso,
    reason,
    grantId,
  );
}

/** Every event for one session, oldest first — the per-escalation audit trail. */
export async function getEscalationEventsForSession(sessionId: string): Promise<unknown[]> {
  if (!(await hasTable(getDb(), 'critique_escalation_events'))) return [];
  return getDb().all('SELECT * FROM critique_escalation_events WHERE session_id = ? ORDER BY id ASC', sessionId);
}
