/**
 * Cost-cap escalation approval card — host module (NanoClaw #1 cost cap, Option 2).
 *
 * The durable data model + the compare-and-set resolver live in
 * `src/db/cost-escalation-episodes.ts` (migration 939); this module is the ACTION
 * surface that drives them: INGEST a runner escalation into the central table, and
 * DECIDE (card click / dashboard pill / expiry) through the CAS, enqueuing at most one
 * epoch-fenced `cost_override` on a win.
 *
 * MONEY-SAFETY (see the runner's budget-generation fence in poll-loop.ts):
 *   - Exactly-one enqueue: every decision surface funnels through `resolveCostEpisode`
 *     (the CAS). First writer wins; a loser is a no-op re-render. So ≤1 override is
 *     enqueued per episode.
 *   - Stale-proof apply: the override carries the episode's `epoch_key`; the runner
 *     refuses one whose epoch ≠ its live budget generation (post-/clear, superseded,
 *     re-enqueued). The host stays READ-ONLY on outbound.db — it only reads the durable
 *     `cost_cap` state and writes the central table + the session's inbound override
 *     (via the existing router path).
 *   - Best-effort card: delivery/expiry are notification-only. A missed card is a lost
 *     notice, never lost money (the ceiling still bounds spend).
 *
 * Lifecycle:
 *   INGEST   host consumes the runner's `cost_escalation` outbound row → ingestEpisode()
 *            (idempotent). Under the OFF flag (S1) it records `decision_state:'observed'`
 *            and the legacy plain-text DM still fires. Under ON (S2) it records `pending`
 *            (or born-terminal `stopped` for a non-immortal ceiling) and the card owns
 *            the notification.
 *   DECIDE   card click / dashboard pill / expiry funnel through resolveCostEpisode() —
 *            first writer wins; a win enqueues ONE epoch-fenced cost_override (continue/
 *            stop) or, for expiry, DISMISSES (no session mutation — T1 advisory).
 *   RECONCILE the host-sweep re-sends undelivered cards, re-drives decided-but-unapplied
 *            effects, and expiry-dismisses (host-sweep.ts, using the accessor's queries).
 */
import { COST_APPROVAL_CARD } from '../../config.js';
import {
  expireEpisode,
  getEpisode,
  getEpisodeByShortId,
  ingestEpisode,
  markEffectApplied,
  markEffectEnqueued,
  resolveCostEpisode,
  supersedeLiveCapEpisodes,
  type CostDecision,
  type CostReason,
  type CostWindow,
  type ResolveResult,
} from '../../db/cost-escalation-episodes.js';
import { log } from '../../log.js';
import { routeCostOverrideToSession } from '../../router.js';
import type { Session } from '../../types.js';

/**
 * T1 advisory expiry: a pending cap card no human answers within 24h is DISMISSED — no
 * session mutation (the ceiling still bounds spend). Born-terminal ceiling episodes and
 * observation-era (S1) episodes never expire.
 */
export const COST_ESCALATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * A short, button/URL-safe episode handle for the card custom_id, collision-retried
 * against the UNIQUE `short_id` column. `cst-` namespace so a cross-surface click can't
 * be confused with another card kind (approvals, runaway, …).
 */
function freshShortId(): string {
  for (let i = 0; i < 8; i++) {
    const candidate = `cst-${Math.random().toString(36).slice(2, 9)}`;
    if (!getEpisodeByShortId(candidate)) return candidate;
  }
  // Astronomically unlikely after 8 draws; take a longer draw rather than throw on the
  // delivery hot path (a duplicate would fail the UNIQUE constraint → ingest no-ops).
  return `cst-${Math.random().toString(36).slice(2, 13)}`;
}

interface EscalationPayload {
  reason?: unknown;
  episodeId?: unknown;
  epochKey?: unknown;
  spentUsd?: unknown;
  capUsd?: unknown;
  ceilingUsd?: unknown;
  immortal?: unknown;
  window?: unknown;
}

export interface IngestResult {
  episodeId?: string;
  /** True iff this ingest inserted a NEW row (so the caller cards/logs exactly once). */
  isNew: boolean;
  /** True once the interactive card owns the notification (S2) — the caller must NOT
   *  also send the legacy plain-text DM. False under S1 (DM stays as-is). */
  cardOwnsNotification: boolean;
}

/**
 * INGEST a runner `cost_escalation` payload into the central episode table (idempotent,
 * fail-soft). A stale runner (pre-card agent-runner-src) emits no `episodeId`/`epochKey`
 * → nothing to ingest and the caller falls back to the legacy DM (back-compat for
 * un-refreshed groups).
 */
export function ingestCostEscalation(
  content: Record<string, unknown>,
  session: Session,
  nowIso: string = new Date().toISOString(),
): IngestResult {
  const p = content as EscalationPayload;
  const episodeId = typeof p.episodeId === 'string' && p.episodeId ? p.episodeId : undefined;
  const epochKey = p.epochKey != null ? String(p.epochKey) : undefined;
  if (!episodeId || epochKey == null) return { isNew: false, cardOwnsNotification: false };

  const reason: CostReason = p.reason === 'ceiling' ? 'ceiling' : 'cap';
  const window: CostWindow = p.window === 'daily' ? 'daily' : 'lifetime';
  const immortal = p.immortal === true;
  const spent = Number(p.spentUsd);
  const cap = Number(p.capUsd);
  const ceiling = Number(p.ceilingUsd);

  const active = COST_APPROVAL_CARD;
  // A non-immortal ceiling episode is BORN TERMINAL: the runner already hard-stopped, so
  // the card is informational (no Continue buys past the ceiling). A cap episode — and an
  // immortal ceiling (never stops) — is a live decision (pending) under S2, or
  // observation-only under S1.
  const bornTerminal = reason === 'ceiling' && !immortal;
  const decisionState = !active ? 'observed' : bornTerminal ? 'stopped' : 'pending';
  const cardState = active ? 'undelivered' : 'observed';
  const expiresAt =
    active && !bornTerminal
      ? new Date(new Date(nowIso).getTime() + COST_ESCALATION_EXPIRY_MS).toISOString()
      : null;

  const isNew = ingestEpisode({
    episode_id: episodeId,
    short_id: freshShortId(),
    session_id: session.id,
    agent_group_id: session.agent_group_id,
    reason,
    window,
    epoch_key: epochKey,
    day_key: window === 'daily' ? nowIso.slice(0, 10) : null,
    spent_usd: Number.isFinite(spent) ? spent : null,
    cap_usd: Number.isFinite(cap) ? cap : null,
    ceiling_usd: Number.isFinite(ceiling) ? ceiling : null,
    immortal,
    created_at: nowIso,
    expires_at: expiresAt,
    decision_state: decisionState,
    card_state: cardState,
  });

  // A born-terminal ceiling has no override to enqueue (the runner is the effector) —
  // mark its effect applied so the reconciler never tries to re-drive it.
  if (isNew && bornTerminal) markEffectApplied(episodeId);

  // Ceiling supersedes any still-live cap card for the same (session, epoch): a stopped
  // session must never also show a "raise the cap?" card. Runs on every re-emit too, to
  // reconcile a race where the cap card landed first.
  if (reason === 'ceiling') supersedeLiveCapEpisodes(session.id, epochKey, nowIso);

  if (isNew) {
    log.info('cost-approval: episode ingested', {
      episodeId,
      sessionId: session.id,
      reason,
      window,
      immortal,
      active,
      decisionState,
    });
  }
  return { episodeId, isNew, cardOwnsNotification: active };
}

/**
 * DECIDE a human verdict through the CAS. On a win, enqueue EXACTLY ONE epoch-fenced
 * `cost_override` (continue/stop) via the router, or — for `expired` — DISMISS with no
 * session mutation (T1 advisory). A loser (already resolved / expired / epoch-superseded)
 * gets `won:false` and the terminal row to re-render. Idempotent: safe to call twice.
 *
 * The CAS is epoch-gated on the episode's own `epoch_key`, a belt-and-braces with the
 * runner fence: even if two surfaces race, only one enqueues, and the runner refuses any
 * that arrives against a rotated generation.
 */
export async function decideCostEpisode(
  episodeId: string,
  decision: CostDecision,
  resolvedBy: string,
): Promise<ResolveResult> {
  const current = getEpisode(episodeId);
  if (!current) {
    log.warn('cost-approval: decide on unknown episode', { episodeId, decision });
    return { won: false, episode: undefined };
  }

  // Expiry has the mirror-image CAS (win only on a past-expiry pending row) and is a pure
  // DISMISS — no override, no session mutation (T1 advisory). resolveCostEpisode can't do
  // it: its predicate refuses any resolution on an already-expired row.
  if (decision === 'expired') {
    const res = expireEpisode(episodeId, resolvedBy);
    if (res.won) log.info('cost-approval: episode expired (dismissed)', { episodeId });
    return res;
  }

  const res = resolveCostEpisode(episodeId, decision, resolvedBy, {
    expectedEpochKey: current.epoch_key,
  });
  if (!res.won) {
    log.info('cost-approval: decision did not win the CAS (already resolved/expired)', {
      episodeId,
      decision,
    });
    return res;
  }

  // Continue/Stop enqueue exactly one epoch-fenced override.
  markEffectEnqueued(episodeId);
  try {
    await routeCostOverrideToSession({
      sessionId: current.session_id,
      decision,
      epochKey: current.epoch_key,
    });
    log.info('cost-approval: override enqueued', {
      episodeId,
      decision,
      sessionId: current.session_id,
      epochKey: current.epoch_key,
    });
  } catch (err) {
    // The override write failed — leave effect_state='enqueued' so the host-sweep
    // reconciler re-drives it. The CAS already marked the decision terminal, so no
    // second decision can slip in.
    log.error('cost-approval: failed to route override (reconciler will re-drive)', {
      episodeId,
      decision,
      err,
    });
  }
  return res;
}

/**
 * Wire the cost-approval module at boot. Under S1 (flag OFF) episodes are still ingested
 * read-only from the delivery handler (observation mode) and the legacy DM fires — this
 * only logs the mode. Under S2 (flag ON) the ingest handler cards instead of DMing, and
 * the host-sweep reconciler + bridge interceptor (registered elsewhere) drive delivery
 * and clicks. The single flag flip is the activation point.
 */
export function registerCostApproval(): void {
  if (!COST_APPROVAL_CARD) {
    log.info('cost-approval: card flag OFF — episodes recorded read-only (S1)');
    return;
  }
  log.info('cost-approval: card flag ON — interactive escalation cards active (S2)');
}
