/**
 * Read/write helpers for `critique_escalation_events`.
 *
 * See src/db/migrations/931-critique-escalation-events.ts for schema +
 * rationale. Appends are best-effort by contract: recording history must never
 * be able to block the gate itself, so `recordEscalationEvent` swallows and
 * logs write failures rather than propagating them into the sweep.
 */
import { log } from '../log.js';

import { getDb, hasTable } from './connection.js';

/**
 * Lifecycle transitions. The two RELEASE events are `approved` and
 * `failed_open`. `state_divergence` is the integrity event: the session's
 * workflow-state claimed a bypass the host never granted (see
 * migrations/933-critique-bypass-grants.ts).
 */
export type EscalationEventKind =
  | 'self_heal'
  | 'self_healed'
  | 'carded'
  | 'expired'
  | 'approved'
  | 'rejected'
  | 'failed_open'
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
}

export function recordEscalationEvent(e: EscalationEvent): void {
  try {
    if (!hasTable(getDb(), 'critique_escalation_events')) return;
    getDb()
      .prepare(
        `INSERT INTO critique_escalation_events
           (session_id, agent_group_id, approval_id, event, class, reason, hit,
            repo, pr_number, attempt, created_at, requested_at)
         VALUES (@session_id, @agent_group_id, @approval_id, @event, @class, @reason, @hit,
                 @repo, @pr_number, @attempt, @created_at, @requested_at)`,
      )
      .run({
        agent_group_id: null,
        approval_id: null,
        class: null,
        reason: null,
        hit: null,
        repo: null,
        pr_number: null,
        attempt: null,
        requested_at: null,
        ...e,
        created_at: new Date().toISOString(),
      });
    // eslint-disable-next-line no-catch-all/no-catch-all -- history must never block the gate
  } catch (err) {
    log.error('Failed to record critique escalation event', { event: e.event, sessionId: e.session_id, err });
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
export function summarizeEscalations(sinceIso: string): EscalationSummaryRow[] {
  if (!hasTable(getDb(), 'critique_escalation_events')) return [];
  return getDb()
    .prepare(
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
    )
    .all(sinceIso) as EscalationSummaryRow[];
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
export function lookupPrForSession(sessionId: string): { repo: string; pr_number: number } | null {
  if (!hasTable(getDb(), 'pr_session_mappings')) return null;
  const row = getDb()
    .prepare('SELECT repo, pr_number FROM pr_session_mappings WHERE session_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(sessionId) as { repo: string; pr_number: number } | undefined;
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
}

export function createBypassGrant(g: {
  grant_id: string;
  session_id: string;
  requested_at: number | null;
  granted_at: string;
  expires_at: string;
  granted_by: string | null;
}): void {
  if (!hasTable(getDb(), 'critique_bypass_grants')) return;
  getDb()
    .prepare(
      `INSERT INTO critique_bypass_grants (grant_id, session_id, requested_at, granted_at, expires_at, granted_by)
       VALUES (@grant_id, @session_id, @requested_at, @granted_at, @expires_at, @granted_by)`,
    )
    .run(g);
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
export function getBypassGrant(grantId: string): BypassGrant | null {
  if (!hasTable(getDb(), 'critique_bypass_grants')) return null;
  const row = getDb().prepare('SELECT * FROM critique_bypass_grants WHERE grant_id = ?').get(grantId) as
    | BypassGrant
    | undefined;
  return row ?? null;
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
export function getLatestSpendableGrant(sessionId: string, nowIso: string): BypassGrant | null {
  if (!hasTable(getDb(), 'critique_bypass_grants')) return null;
  const row = getDb()
    .prepare(
      `SELECT * FROM critique_bypass_grants
        WHERE session_id = ? AND consumed_at IS NULL AND revoked_at IS NULL
          AND datetime(expires_at) > datetime(?)
        ORDER BY datetime(granted_at) DESC, rowid DESC
        LIMIT 1`,
    )
    .get(sessionId, nowIso) as BypassGrant | undefined;
  return row ?? null;
}

/** The gate spent the grant; record it so it can never be honoured again. */
export function markBypassGrantConsumed(grantId: string, consumedAtIso: string): void {
  if (!hasTable(getDb(), 'critique_bypass_grants')) return;
  getDb()
    .prepare('UPDATE critique_bypass_grants SET consumed_at = ? WHERE grant_id = ? AND consumed_at IS NULL')
    .run(consumedAtIso, grantId);
}

/**
 * Kill a grant. Also the compensating action when the workflow-state patch
 * fails after the row is inserted — without it the ledger would hold a live
 * grant nobody knows about, which an agent could later claim by forging
 * matching file fields.
 */
export function revokeBypassGrant(grantId: string, revokedAtIso: string, reason: string): void {
  if (!hasTable(getDb(), 'critique_bypass_grants')) return;
  getDb()
    .prepare(
      'UPDATE critique_bypass_grants SET revoked_at = ?, revoked_reason = ? WHERE grant_id = ? AND revoked_at IS NULL',
    )
    .run(revokedAtIso, reason, grantId);
}

/** Every event for one session, oldest first — the per-escalation audit trail. */
export function getEscalationEventsForSession(sessionId: string): unknown[] {
  if (!hasTable(getDb(), 'critique_escalation_events')) return [];
  return getDb()
    .prepare('SELECT * FROM critique_escalation_events WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId);
}
