/**
 * Accessor for `cost_escalation_episodes` (migration 939) — the durable record and
 * compare-and-set resolver behind the cost-cap escalation card (Option 2).
 *
 * This module is PURE DATA + the CAS. It never applies an effect (enqueue a
 * cost_override, close a session, edit a card) — that is the cost-approval module's
 * job, driven by what `resolveCostEpisode` returns and repaired by the reconciler
 * queries here. Keeping effects out of the accessor keeps the CAS a single, testable
 * atomic transition.
 *
 * READS are fail-soft (return undefined/[] when the DB is uninitialized or the table
 * is missing) so callers on the hot path — dashboard, reconciler — can call
 * unconditionally and hermetic (no-DB) tests stay green. WRITES require an
 * initialized DB (host-side only).
 */
import type Database from 'better-sqlite3';

import { getDb, hasTable } from './connection.js';

export type CostReason = 'cap' | 'ceiling';
export type CostWindow = 'lifetime' | 'daily';
export type CostDecision = 'continue' | 'stop' | 'expired';
export type CostDecisionState =
  | 'pending'
  | 'continued'
  | 'stopped'
  | 'expired'
  | 'superseded'
  | 'observed';
export type CostEffectState = 'none' | 'enqueued' | 'applied';
export type CostCardState =
  | 'observed'
  | 'undelivered'
  | 'sending'
  | 'delivered'
  | 'edited'
  | 'failed';

/** The protocol version this host/runner build speaks. Bumped only on a breaking
 *  change to the episode contract; gates the S1→S2 flag rollout. */
export const COST_EPISODE_PROTOCOL_VERSION = 1;

export interface CostEpisodeRow {
  episode_id: string;
  short_id: string;
  protocol_version: number;
  session_id: string;
  agent_group_id: string | null;
  reason: CostReason;
  window: CostWindow;
  epoch_key: string;
  day_key: string | null;
  spent_usd: number | null;
  cap_usd: number | null;
  ceiling_usd: number | null;
  immortal: number; // 0 | 1
  decision_state: CostDecisionState;
  effect_state: CostEffectState;
  card_state: CostCardState;
  platform_message_id: string | null;
  approval_id: string | null;
  created_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  effect_attempts: number;
  last_error: string | null;
}

/** The fields a caller supplies to INGEST a new episode. Lifecycle columns default. */
export interface CostEpisodeInsert {
  episode_id: string;
  short_id: string;
  session_id: string;
  agent_group_id: string | null;
  reason: CostReason;
  window: CostWindow;
  epoch_key: string;
  day_key?: string | null;
  spent_usd?: number | null;
  cap_usd?: number | null;
  ceiling_usd?: number | null;
  immortal: boolean;
  created_at: string;
  expires_at?: string | null;
  /** 'observed' under the OFF flag (S1); 'undelivered' when the card should be sent;
   *  'stopped'/'edited' for a born-terminal ceiling episode. */
  decision_state?: CostDecisionState;
  card_state?: CostCardState;
}

/** Fail-soft handle: null when there is no initialized DB with the table. */
function db(): Database.Database | null {
  const d = getDb();
  if (!d) return null;
  return hasTable(d, 'cost_escalation_episodes') ? d : null;
}

/**
 * Idempotent INGEST. `INSERT … ON CONFLICT(episode_id) DO NOTHING` — a re-emitted
 * escalation (runner respawn, host retry) produces exactly one row. Returns true iff
 * a NEW row was inserted (so the caller sends the card exactly once).
 */
export function ingestEpisode(ep: CostEpisodeInsert): boolean {
  const d = db();
  if (!d) return false;
  const info = d
    .prepare(
      `INSERT INTO cost_escalation_episodes
         (episode_id, short_id, protocol_version, session_id, agent_group_id, reason, window,
          epoch_key, day_key, spent_usd, cap_usd, ceiling_usd, immortal,
          decision_state, effect_state, card_state, created_at, expires_at)
       VALUES
         (@episode_id, @short_id, @protocol_version, @session_id, @agent_group_id, @reason, @window,
          @epoch_key, @day_key, @spent_usd, @cap_usd, @ceiling_usd, @immortal,
          @decision_state, 'none', @card_state, @created_at, @expires_at)
       ON CONFLICT(episode_id) DO NOTHING`,
    )
    .run({
      episode_id: ep.episode_id,
      short_id: ep.short_id,
      protocol_version: COST_EPISODE_PROTOCOL_VERSION,
      session_id: ep.session_id,
      agent_group_id: ep.agent_group_id,
      reason: ep.reason,
      window: ep.window,
      epoch_key: ep.epoch_key,
      day_key: ep.day_key ?? null,
      spent_usd: ep.spent_usd ?? null,
      cap_usd: ep.cap_usd ?? null,
      ceiling_usd: ep.ceiling_usd ?? null,
      immortal: ep.immortal ? 1 : 0,
      decision_state: ep.decision_state ?? 'pending',
      card_state: ep.card_state ?? 'undelivered',
      created_at: ep.created_at,
      expires_at: ep.expires_at ?? null,
    });
  return info.changes > 0;
}

export function getEpisode(episodeId: string): CostEpisodeRow | undefined {
  const d = db();
  if (!d) return undefined;
  return d
    .prepare(`SELECT * FROM cost_escalation_episodes WHERE episode_id = ?`)
    .get(episodeId) as CostEpisodeRow | undefined;
}

export function getEpisodeByShortId(shortId: string): CostEpisodeRow | undefined {
  const d = db();
  if (!d) return undefined;
  return d
    .prepare(`SELECT * FROM cost_escalation_episodes WHERE short_id = ?`)
    .get(shortId) as CostEpisodeRow | undefined;
}

export interface ResolveResult {
  /** True iff THIS call won the compare-and-set (was the first to resolve a pending row). */
  won: boolean;
  /** The episode as it stands AFTER the attempt (terminal for a loser, freshly-resolved for a winner). */
  episode: CostEpisodeRow | undefined;
}

/**
 * The one compare-and-set every decision surface (card click, dashboard pill, expiry
 * sweep) funnels through. Atomically flips a still-`pending`, un-expired episode to a
 * terminal decision. A loser (already resolved / expired-by-predicate / superseded)
 * gets `won:false` and the existing terminal row to re-render — it MUST NOT apply an
 * effect. Expiry is enforced IN the predicate so a late click after the nominal
 * expiry can't win.
 *
 * `nowIso` is injectable for tests. `expectedEpochKey`, when given, additionally
 * requires the episode's epoch to match the caller's view of the session's current
 * cost epoch — refusing an old-epoch decision (pre-`/clear`, yesterday's daily card).
 */
export function resolveCostEpisode(
  episodeId: string,
  decision: CostDecision,
  resolvedBy: string,
  opts: { nowIso?: string; expectedEpochKey?: string } = {},
): ResolveResult {
  const d = db();
  if (!d) return { won: false, episode: undefined };
  const now = opts.nowIso ?? new Date().toISOString();
  const nextState: CostDecisionState =
    decision === 'continue' ? 'continued' : decision === 'stop' ? 'stopped' : 'expired';

  const info = d
    .prepare(
      `UPDATE cost_escalation_episodes
          SET decision_state = @next, resolved_at = @now, resolved_by = @by
        WHERE episode_id = @id
          AND decision_state = 'pending'
          AND (expires_at IS NULL OR datetime(expires_at) > datetime(@now))
          AND (@epoch IS NULL OR epoch_key = @epoch)`,
    )
    .run({ id: episodeId, next: nextState, now, by: resolvedBy, epoch: opts.expectedEpochKey ?? null });

  return { won: info.changes > 0, episode: getEpisode(episodeId) };
}

/**
 * Atomic cap→ceiling supersession: called inside the ceiling-episode INGEST txn.
 * Marks any still-live T1 (`reason='cap'`) episode for this (session, epoch)
 * `superseded`, so a live cap card and a ceiling close can never coexist.
 */
export function supersedeLiveCapEpisodes(
  sessionId: string,
  epochKey: string,
  nowIso = new Date().toISOString(),
): CostEpisodeRow[] {
  const d = db();
  if (!d) return [];
  const rows = d
    .prepare(
      `SELECT * FROM cost_escalation_episodes
        WHERE session_id = ? AND epoch_key = ? AND reason = 'cap' AND decision_state = 'pending'`,
    )
    .all(sessionId, epochKey) as CostEpisodeRow[];
  d.prepare(
    `UPDATE cost_escalation_episodes
        SET decision_state = 'superseded', resolved_at = ?, resolved_by = 'supersede:ceiling'
      WHERE session_id = ? AND epoch_key = ? AND reason = 'cap' AND decision_state = 'pending'`,
  ).run(nowIso, sessionId, epochKey);
  return rows;
}

// ── effect + card lifecycle setters (idempotent single-column advances) ──
export function markEffectEnqueued(episodeId: string): void {
  db()?.prepare(`UPDATE cost_escalation_episodes SET effect_state='enqueued' WHERE episode_id=? AND effect_state='none'`).run(episodeId);
}
export function markEffectApplied(episodeId: string): void {
  db()?.prepare(`UPDATE cost_escalation_episodes SET effect_state='applied' WHERE episode_id=?`).run(episodeId);
}
export function bumpEffectAttempt(episodeId: string, error?: string): void {
  db()?.prepare(`UPDATE cost_escalation_episodes SET effect_attempts=effect_attempts+1, last_error=? WHERE episode_id=?`).run(error ?? null, episodeId);
}
export function markCard(episodeId: string, state: CostCardState, platformMessageId?: string | null, approvalId?: string | null): void {
  db()?.prepare(
    `UPDATE cost_escalation_episodes
        SET card_state=@state,
            platform_message_id=COALESCE(@pmid, platform_message_id),
            approval_id=COALESCE(@aid, approval_id)
      WHERE episode_id=@id`,
  ).run({ id: episodeId, state, pmid: platformMessageId ?? null, aid: approvalId ?? null });
}

// ── reconciler queries (the host-sweep repairs half-done state from these) ──
/** Cards that still need (re)sending. */
export function listUndeliveredCards(limit = 50): CostEpisodeRow[] {
  const d = db();
  if (!d) return [];
  return d.prepare(
    `SELECT * FROM cost_escalation_episodes
      WHERE card_state IN ('undelivered','sending','failed') AND decision_state='pending'
      ORDER BY created_at LIMIT ?`,
  ).all(limit) as CostEpisodeRow[];
}
/** Decided episodes whose effect has not yet landed — re-drive them. */
export function listUnappliedEffects(limit = 50): CostEpisodeRow[] {
  const d = db();
  if (!d) return [];
  return d.prepare(
    `SELECT * FROM cost_escalation_episodes
      WHERE decision_state IN ('continued','stopped','expired') AND effect_state <> 'applied'
      ORDER BY resolved_at LIMIT ?`,
  ).all(limit) as CostEpisodeRow[];
}
/** Pending episodes past their expiry — the sweep resolves each to 'expired'. */
export function listExpiredPending(nowIso = new Date().toISOString(), limit = 50): CostEpisodeRow[] {
  const d = db();
  if (!d) return [];
  return d.prepare(
    `SELECT * FROM cost_escalation_episodes
      WHERE decision_state='pending' AND expires_at IS NOT NULL AND datetime(expires_at) <= datetime(?)
      ORDER BY expires_at LIMIT ?`,
  ).all(nowIso, limit) as CostEpisodeRow[];
}

/**
 * S2 activation guard: mark every pre-activation 'observed'/'pending' episode
 * `superseded` so flipping the flag on never cards a backlog of observation-era
 * (S1) episodes. Called once at activation with the activation timestamp.
 */
export function supersedePreActivationEpisodes(activationIso: string): number {
  const d = db();
  if (!d) return 0;
  return d.prepare(
    `UPDATE cost_escalation_episodes
        SET decision_state='superseded', resolved_at=?, resolved_by='supersede:activation'
      WHERE created_at < ? AND decision_state IN ('observed','pending')`,
  ).run(activationIso, activationIso).changes;
}
