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
import { getDb, hasTable } from './connection.js';
import type { DbDriver } from './driver.js';

export type CostReason = 'cap' | 'ceiling';
export type CostWindow = 'lifetime' | 'daily';
export type CostDecision = 'continue' | 'stop' | 'expired';
export type CostDecisionState = 'pending' | 'continued' | 'stopped' | 'expired' | 'superseded' | 'observed';
export type CostEffectState = 'none' | 'enqueued' | 'applied';
export type CostCardState = 'observed' | 'undelivered' | 'sending' | 'delivered' | 'edited' | 'failed';

/** The protocol version this host/runner build speaks. Bumped only on a breaking
 *  change to the episode contract; gates the S1→S2 flag rollout. */
export const COST_EPISODE_PROTOCOL_VERSION = 1;

/**
 * The `pending_approvals.action` key the cost-decision card is registered under.
 * Lives here (db layer) rather than in `src/modules/cost-approval/index.ts` (which
 * still re-exports it for its own use) so `src/db/cost-ceiling-adjustments.ts` — a
 * sibling db-layer module that also needs to reap a stale card — can import it
 * without reaching up into the modules layer (which would invert the dependency
 * direction and risk a circular import, since cost-approval/index.ts already
 * imports from this file).
 */
export const COST_DECISION_ACTION = 'cost_decision';

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
async function db(): Promise<DbDriver | null> {
  const d = getDb();
  if (!d) return null;
  return (await hasTable(d, 'cost_escalation_episodes')) ? d : null;
}

/**
 * Idempotent INGEST. `INSERT … ON CONFLICT(episode_id) DO NOTHING` — a re-emitted
 * escalation (runner respawn, host retry) produces exactly one row. Returns true iff
 * a NEW row was inserted (so the caller sends the card exactly once).
 */
export async function ingestEpisode(ep: CostEpisodeInsert): Promise<boolean> {
  const d = await db();
  if (!d) return false;
  const info = await d.run(
    `INSERT INTO cost_escalation_episodes
       (episode_id, short_id, protocol_version, session_id, agent_group_id, reason, window,
        epoch_key, day_key, spent_usd, cap_usd, ceiling_usd, immortal,
        decision_state, effect_state, card_state, created_at, expires_at)
     VALUES
       (@episode_id, @short_id, @protocol_version, @session_id, @agent_group_id, @reason, @window,
        @epoch_key, @day_key, @spent_usd, @cap_usd, @ceiling_usd, @immortal,
        @decision_state, 'none', @card_state, @created_at, @expires_at)
     ON CONFLICT(episode_id) DO NOTHING`,
    {
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
    },
  );
  return info.changes > 0;
}

export async function getEpisode(episodeId: string): Promise<CostEpisodeRow | undefined> {
  const d = await db();
  if (!d) return undefined;
  return d.get<CostEpisodeRow>(`SELECT * FROM cost_escalation_episodes WHERE episode_id = ?`, episodeId);
}

export async function getEpisodeByShortId(shortId: string): Promise<CostEpisodeRow | undefined> {
  const d = await db();
  if (!d) return undefined;
  return d.get<CostEpisodeRow>(`SELECT * FROM cost_escalation_episodes WHERE short_id = ?`, shortId);
}

/**
 * The live (still-pending, un-expired) episode for a session, if any. The dashboard pill
 * routes its decision through THIS episode's CAS so the secondary surface is money-safe and
 * epoch-carrying — the same guarantee as the card. Newest-first (a ceiling supersedes a cap
 * within the same epoch). Returns undefined when there is no live episode (S1 observation
 * mode, an already-expired card, or a session whose escalation was already resolved) — the
 * pill then falls back to the legacy unconditional override.
 */
export async function getPendingEpisodeForSession(
  sessionId: string,
  nowIso = new Date().toISOString(),
): Promise<CostEpisodeRow | undefined> {
  const d = await db();
  if (!d) return undefined;
  return d.get<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes
      WHERE session_id = ? AND decision_state = 'pending'
        AND (expires_at IS NULL OR datetime(expires_at) > datetime(?))
      ORDER BY created_at DESC LIMIT 1`,
    sessionId,
    nowIso,
  );
}

/**
 * The newest episode for a session in ANY state — used by the dashboard pill to fence a
 * decision even when there is no live PENDING episode. A resolved episode still carries an
 * `epoch_key`; routing the pill override with it lets the runner refuse a duplicate/stale
 * press (no double-grant, since a Continue already rotated the generation) while still
 * applying a genuine reversal (the generation is unchanged after a Stop). A session that
 * has NEVER emitted a protocol episode returns undefined → the pill's legacy unconditional
 * override (stale runner) is the only place an unfenced override is allowed.
 */
export async function getLatestEpisodeForSession(sessionId: string): Promise<CostEpisodeRow | undefined> {
  const d = await db();
  if (!d) return undefined;
  return d.get<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
    sessionId,
  );
}

/** An episode enriched with its coworker (agent_groups) and, when the session's
 *  thread traces to a GitHub issue/PR, the originating author (gh_thread_origin). */
export interface EscalationListRow extends CostEpisodeRow {
  group_folder: string | null;
  group_name: string | null;
  thread_id: string | null;
  gh_author: string | null;
  gh_repo: string | null;
  gh_number: number | null;
}

export interface EscalationFilter {
  state?: CostDecisionState;
  sessionId?: string;
  groupFolder?: string;
  ghAuthor?: string;
  limit?: number;
}

/**
 * The per-session escalation LIST behind `ncl cost-cap escalations` (and the
 * coworker MCP `list_cost_escalations` tool): every episode with its cost
 * (spent/cap/ceiling), decision_state, coworker folder, and — when the session
 * sits on a GitHub thread — the issue/PR author. Read-only, fail-soft (returns []
 * with no DB/table). The `gh_thread_origin` join is guarded because it is a newer
 * table (migration 940) that need not exist on every install; filtering by
 * `ghAuthor` when it is absent yields [] rather than an error. Ordering is
 * newest-first; `limit` is clamped to [1, 500].
 */
export async function listEscalationEpisodes(f: EscalationFilter = {}): Promise<EscalationListRow[]> {
  const d = await db();
  if (!d) return [];
  const hasGh = await hasTable(d, 'gh_thread_origin');
  if (f.ghAuthor && !hasGh) return []; // can't attribute without the table

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (f.state) {
    clauses.push('e.decision_state = ?');
    params.push(f.state);
  }
  if (f.sessionId) {
    clauses.push('e.session_id = ?');
    params.push(f.sessionId);
  }
  if (f.groupFolder) {
    clauses.push('g.folder = ?');
    params.push(f.groupFolder);
  }
  if (hasGh && f.ghAuthor) {
    clauses.push('o.author = ?');
    params.push(f.ghAuthor);
  }
  // Floor to an integer: SQLite rejects a non-integer bound param to `LIMIT ?`
  // ("datatype mismatch"), matching the codebase clamp pattern (session-messages.ts).
  const limit = Math.max(1, Math.min(Number.isFinite(f.limit) ? Math.floor(Number(f.limit)) : 50, 500));
  params.push(limit);

  const ghCols = hasGh
    ? 'o.author AS gh_author, o.repo AS gh_repo, o.number AS gh_number'
    : 'NULL AS gh_author, NULL AS gh_repo, NULL AS gh_number';
  const ghJoin = hasGh ? 'LEFT JOIN gh_thread_origin o ON o.thread_id = s.thread_id' : '';

  return d.all<EscalationListRow>(
    `SELECT e.*, g.folder AS group_folder, g.name AS group_name, s.thread_id AS thread_id, ${ghCols}
       FROM cost_escalation_episodes e
       LEFT JOIN agent_groups g ON g.id = e.agent_group_id
       LEFT JOIN sessions s ON s.id = e.session_id
       ${ghJoin}
       ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''}
       ORDER BY e.created_at DESC
       LIMIT ?`,
    ...params,
  );
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
export async function resolveCostEpisode(
  episodeId: string,
  decision: CostDecision,
  resolvedBy: string,
  opts: { nowIso?: string; expectedEpochKey?: string } = {},
): Promise<ResolveResult> {
  const d = await db();
  if (!d) return { won: false, episode: undefined };
  const now = opts.nowIso ?? new Date().toISOString();
  const nextState: CostDecisionState =
    decision === 'continue' ? 'continued' : decision === 'stop' ? 'stopped' : 'expired';

  const info = await d.run(
    `UPDATE cost_escalation_episodes
        SET decision_state = @next, resolved_at = @now, resolved_by = @by
      WHERE episode_id = @id
        AND decision_state = 'pending'
        AND (expires_at IS NULL OR datetime(expires_at) > datetime(@now))
        AND (@epoch IS NULL OR epoch_key = @epoch)`,
    { id: episodeId, next: nextState, now, by: resolvedBy, epoch: opts.expectedEpochKey ?? null },
  );

  return { won: info.changes > 0, episode: await getEpisode(episodeId) };
}

/**
 * The expiry CAS. `resolveCostEpisode` deliberately REFUSES any resolution on a
 * past-expiry row (so a late human click can't win) — which means it can't be used to
 * mark a row `expired` either. Expiry has the mirror-image predicate: win ONLY on a
 * still-`pending` row that IS past its expiry. This races safely with a human click on
 * the same row — SQLite serializes the two UPDATEs, whichever commits first flips
 * `decision_state` off `pending`, and the other finds 0 rows. So exactly-once holds
 * across the click/expiry boundary. Dismiss is advisory (T1): no session mutation.
 */
export async function expireEpisode(
  episodeId: string,
  resolvedBy = 'sweep:expiry',
  nowIso = new Date().toISOString(),
): Promise<ResolveResult> {
  const d = await db();
  if (!d) return { won: false, episode: undefined };
  const info = await d.run(
    `UPDATE cost_escalation_episodes
        SET decision_state = 'expired', resolved_at = @now, resolved_by = @by
      WHERE episode_id = @id
        AND decision_state = 'pending'
        AND expires_at IS NOT NULL
        AND datetime(expires_at) <= datetime(@now)`,
    { id: episodeId, now: nowIso, by: resolvedBy },
  );
  return { won: info.changes > 0, episode: await getEpisode(episodeId) };
}

/**
 * Every episode for one exact (session, epoch) pair, in ANY state. Used by the
 * cost-ceiling-adjustment ledger's creation transaction (`src/db/cost-ceiling-
 * adjustments.ts`) to check whether a card already WON this precise epoch
 * (`continued`/`stopped`) before a new adjustment is allowed to claim it — a card
 * decision beating a request is money-safety, not a UX nicety (the card's
 * `cost_override` may already be durably enqueued for the runner to apply).
 */
export async function getEpisodesForSessionEpoch(sessionId: string, epochKey: string): Promise<CostEpisodeRow[]> {
  const d = await db();
  if (!d) return [];
  return d.all<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes WHERE session_id = ? AND epoch_key = ?`,
    sessionId,
    epochKey,
  );
}

/**
 * Supersede every still-`pending` episode (ANY reason — cap or ceiling) for one
 * exact (session, epoch) pair. Unlike `supersedeLiveCapEpisodes` (reason-
 * restricted, called from the ceiling-episode ingest path), this is called from
 * the cost-ceiling-adjustment ledger's creation transaction when a live-control
 * request is about to claim an epoch that still has an undecided card sitting on
 * it — so a delayed click on that card can never apply after the request already
 * won (the CAS in `resolveCostEpisode` refuses a non-`pending` row on its own,
 * this just makes the card's terminal state honest instead of leaving it
 * dangling as `pending` forever). Returns the superseded rows so the caller can
 * reap their now-stale `pending_approvals` cards.
 */
export async function supersedePendingEpisodesForEpoch(
  sessionId: string,
  epochKey: string,
  resolvedBy: string,
  nowIso = new Date().toISOString(),
): Promise<CostEpisodeRow[]> {
  const d = await db();
  if (!d) return [];
  const rows = await d.all<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes
      WHERE session_id = ? AND epoch_key = ? AND decision_state = 'pending'`,
    sessionId,
    epochKey,
  );
  if (rows.length === 0) return rows;
  await d.run(
    `UPDATE cost_escalation_episodes
        SET decision_state = 'superseded', resolved_at = ?, resolved_by = ?
      WHERE session_id = ? AND epoch_key = ? AND decision_state = 'pending'`,
    nowIso,
    resolvedBy,
    sessionId,
    epochKey,
  );
  return rows;
}

/**
 * Atomic cap→ceiling supersession: called inside the ceiling-episode INGEST txn.
 * Marks any still-live T1 (`reason='cap'`) episode for this (session, epoch)
 * `superseded`, so a live cap card and a ceiling close can never coexist.
 */
export async function supersedeLiveCapEpisodes(
  sessionId: string,
  epochKey: string,
  nowIso = new Date().toISOString(),
): Promise<CostEpisodeRow[]> {
  const d = await db();
  if (!d) return [];
  const rows = await d.all<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes
      WHERE session_id = ? AND epoch_key = ? AND reason = 'cap' AND decision_state = 'pending'`,
    sessionId,
    epochKey,
  );
  await d.run(
    `UPDATE cost_escalation_episodes
        SET decision_state = 'superseded', resolved_at = ?, resolved_by = 'supersede:ceiling'
      WHERE session_id = ? AND epoch_key = ? AND reason = 'cap' AND decision_state = 'pending'`,
    nowIso,
    sessionId,
    epochKey,
  );
  return rows;
}

// ── effect + card lifecycle setters (idempotent single-column advances) ──
export async function markEffectEnqueued(episodeId: string): Promise<void> {
  await (
    await db()
  )?.run(
    `UPDATE cost_escalation_episodes SET effect_state='enqueued' WHERE episode_id=? AND effect_state='none'`,
    episodeId,
  );
}
export async function markEffectApplied(episodeId: string): Promise<void> {
  await (await db())?.run(`UPDATE cost_escalation_episodes SET effect_state='applied' WHERE episode_id=?`, episodeId);
}
export async function bumpEffectAttempt(episodeId: string, error?: string): Promise<void> {
  await (
    await db()
  )?.run(
    `UPDATE cost_escalation_episodes SET effect_attempts=effect_attempts+1, last_error=? WHERE episode_id=?`,
    error ?? null,
    episodeId,
  );
}
// ── reconciler queries (the host-sweep repairs half-done state from these) ──
/** Decided episodes whose effect has not yet landed — re-drive them. */
export async function listUnappliedEffects(limit = 50): Promise<CostEpisodeRow[]> {
  const d = await db();
  if (!d) return [];
  return d.all<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes
      WHERE decision_state IN ('continued','stopped','expired') AND effect_state <> 'applied'
      ORDER BY resolved_at LIMIT ?`,
    limit,
  );
}
/** Pending episodes past their expiry — the sweep resolves each to 'expired'. */
export async function listExpiredPending(nowIso = new Date().toISOString(), limit = 50): Promise<CostEpisodeRow[]> {
  const d = await db();
  if (!d) return [];
  return d.all<CostEpisodeRow>(
    `SELECT * FROM cost_escalation_episodes
      WHERE decision_state='pending' AND expires_at IS NOT NULL AND datetime(expires_at) <= datetime(?)
      ORDER BY expires_at LIMIT ?`,
    nowIso,
    limit,
  );
}

/**
 * S2 activation guard: mark every observation-era ('observed', S1) episode `superseded`.
 * Called at each S2 boot. Targets ONLY 'observed' — never 'pending' — so it can never
 * nuke a genuine in-flight card that a restart is resuming. (Observed rows also carry
 * card_state='observed', which the reconciler's card query excludes, so this is defense
 * in depth: it guarantees a flag flip can never card a backlog of S1 episodes.)
 */
export async function supersedeObservedEpisodes(nowIso = new Date().toISOString()): Promise<number> {
  const d = await db();
  if (!d) return 0;
  const info = await d.run(
    `UPDATE cost_escalation_episodes
      SET decision_state='superseded', resolved_at=?, resolved_by='supersede:activation'
    WHERE decision_state='observed'`,
    nowIso,
  );
  return info.changes;
}
