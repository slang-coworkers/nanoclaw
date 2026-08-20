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
 *   - At-most-one DECISION: every surface funnels through `resolveCostEpisode` (the CAS).
 *     First writer wins; a loser is a no-op re-render. So the episode is resolved once.
 *   - Exactly-once GRANT: the override carries the episode's `epoch_key`; the runner
 *     APPLIES at most one per generation and refuses any whose epoch ≠ its live budget
 *     generation (post-/clear, superseded, re-enqueued). Enqueue itself is AT-LEAST-once
 *     (a crash between the CAS and the durable inbound write is re-driven by the
 *     reconciler), but the fence makes a duplicate override a no-op — so no double-grant.
 *   - The host stays READ-ONLY on outbound.db — it only reads the durable `cost_cap`
 *     state and writes the central table + the session's inbound override (router path).
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
  bumpEffectAttempt,
  expireEpisode,
  getEpisode,
  getEpisodeByShortId,
  ingestEpisode,
  listExpiredPending,
  listUnappliedEffects,
  listUndeliveredCards,
  markCard,
  markEffectApplied,
  markEffectEnqueued,
  resolveCostEpisode,
  supersedeLiveCapEpisodes,
  supersedeObservedEpisodes,
  type CostDecision,
  type CostEpisodeRow,
  type CostReason,
  type CostWindow,
  type ResolveResult,
} from '../../db/cost-escalation-episodes.js';
import { getMessagingGroup } from '../../db/messaging-groups.js';
import { getSession } from '../../db/sessions.js';
import { getDeliveryAdapter } from '../../delivery.js';
import { log } from '../../log.js';
import { routeCostOverrideToSession } from '../../router.js';
import type { Session } from '../../types.js';
import { pickApprovalDelivery, pickApprover } from '../approvals/primitive.js';
import { hasAdminPrivilege } from '../permissions/db/user-roles.js';
import { buildCostCardContent, type CostCardOutcome } from './card.js';

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
    active && !bornTerminal ? new Date(new Date(nowIso).getTime() + COST_ESCALATION_EXPIRY_MS).toISOString() : null;

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

  // Continue/Stop enqueue exactly one epoch-fenced override. effect_state semantics:
  // 'applied' = the override is DURABLY in the session's inbound.db (the host's job is
  // done — the runner WILL consume it, epoch-fenced + idempotent). 'enqueued' = the route
  // threw before it landed → the reconciler re-drives (money-safe to repeat).
  markEffectEnqueued(episodeId);
  try {
    await routeCostOverrideToSession({
      sessionId: current.session_id,
      decision,
      epochKey: current.epoch_key,
    });
    markEffectApplied(episodeId);
    log.info('cost-approval: override enqueued', {
      episodeId,
      decision,
      sessionId: current.session_id,
      epochKey: current.epoch_key,
    });
  } catch (err) {
    // Left effect_state='enqueued' → the host-sweep reconciler re-drives. The CAS already
    // marked the decision terminal, so no second decision can slip in.
    log.error('cost-approval: failed to route override (reconciler will re-drive)', {
      episodeId,
      decision,
      err,
    });
  }
  return res;
}

export interface CostClickResult {
  /** The episode after the decision (the standing row when this click lost the CAS). */
  episode: CostEpisodeRow | undefined;
  /** How to render the terminal card: this actor's outcome, or 'already' if it lost. */
  outcome: CostCardOutcome;
}

/**
 * Resolve a card click by its `short_id` (the handle in the button action id). Maps to the
 * episode and funnels through the same CAS as every surface. Returns the standing episode +
 * a terminal-render outcome. The bridge calls this from both click sites (Chat SDK onAction
 * + Discord forwarded interaction) and terminal-edits the card with `buildCostTerminalCard`.
 *
 * AUTHORIZATION: only an approver (owner / global admin / scoped admin for the episode's
 * agent group) may decide — a forwarded/shared card or a replayed component action from a
 * non-admin (even an unknown/empty identity) is REJECTED before the CAS, mirroring the
 * unknown-sender approval-card check. `clickerId` must already be namespaced
 * (`<channelType>:<handle>`) by the caller.
 *
 * FLAG: gated on COST_APPROVAL_CARD so flipping the flag OFF is an effective kill switch —
 * a click on a card left over from an S2 session is a no-op once the flag is off.
 */
export async function decideCostEpisodeByShortId(
  shortId: string,
  decision: 'continue' | 'stop',
  clickerId: string | null,
): Promise<CostClickResult> {
  if (!COST_APPROVAL_CARD) {
    log.info('cost-approval: card click ignored — flag OFF (kill switch)', { shortId });
    return { episode: undefined, outcome: 'already' };
  }
  const ep = getEpisodeByShortId(shortId);
  if (!ep) {
    log.warn('cost-approval: click on unknown short_id', { shortId, decision });
    return { episode: undefined, outcome: 'already' };
  }
  if (!clickerId || !ep.agent_group_id || !hasAdminPrivilege(clickerId, ep.agent_group_id)) {
    log.warn('cost-approval: unauthorized card click rejected', {
      shortId,
      clickerId,
      agentGroupId: ep.agent_group_id,
    });
    return { episode: ep, outcome: 'unauthorized' };
  }
  const res = await decideCostEpisode(ep.episode_id, decision, `chat:${clickerId}`);
  const outcome: CostCardOutcome = res.won ? (decision === 'continue' ? 'continued' : 'stopped') : 'already';
  return { episode: res.episode ?? ep, outcome };
}

/**
 * Send (or re-send) the interactive card for an episode to a human approver's DM. Best-effort
 * — a missed card is a lost notice, never lost money (the ceiling still bounds spend). Resolves
 * the approver via the same primitive the OneCLI approval bridge uses (scoped admin → global
 * admin → owner). Marks the card lifecycle so the reconciler can retry a failed/undelivered send.
 *
 * Idempotent-ish: only sends when the card is still awaiting delivery (undelivered/failed) and
 * the episode is actionable (pending, or a born-terminal ceiling that shows an informational
 * card once). A resolved/superseded episode is skipped.
 */
export async function sendCostCard(ep: CostEpisodeRow): Promise<void> {
  const actionable = ep.decision_state === 'pending' || (ep.reason === 'ceiling' && !ep.immortal);
  // 'sending' is included so a crash mid-send is retried (a stuck 'sending' would otherwise
  // never resend); at-least-once delivery is terminal-edit-deduped on the platform.
  const awaitingDelivery = ep.card_state === 'undelivered' || ep.card_state === 'failed' || ep.card_state === 'sending';
  if (!actionable || !awaitingDelivery) return;
  if (!ep.agent_group_id) {
    log.warn('cost-approval: episode has no agent group — cannot resolve approver', { episodeId: ep.episode_id });
    markCard(ep.episode_id, 'failed');
    return;
  }

  const approvers = pickApprover(ep.agent_group_id);
  if (approvers.length === 0) {
    log.warn('cost-approval: no approver to card', { episodeId: ep.episode_id });
    markCard(ep.episode_id, 'failed');
    return;
  }
  const session = getSession(ep.session_id);
  const originChannelType = session?.messaging_group_id
    ? (getMessagingGroup(session.messaging_group_id)?.channel_type ?? '')
    : '';
  const target = await pickApprovalDelivery(approvers, originChannelType);
  if (!target) {
    log.warn('cost-approval: no DM channel for any approver', { episodeId: ep.episode_id });
    markCard(ep.episode_id, 'failed');
    return;
  }
  const adapter = getDeliveryAdapter();
  if (!adapter) return; // not ready yet — reconciler retries next tick

  markCard(ep.episode_id, 'sending');
  try {
    const messageId = await adapter.deliver(
      target.messagingGroup.channel_type,
      target.messagingGroup.platform_id,
      null,
      'chat',
      JSON.stringify(buildCostCardContent(ep)),
    );
    markCard(ep.episode_id, 'delivered', messageId ?? null);
    log.info('cost-approval: card delivered', {
      episodeId: ep.episode_id,
      approver: target.userId,
      messageId: messageId ?? null,
    });
  } catch (err) {
    markCard(ep.episode_id, 'failed');
    log.error('cost-approval: card delivery failed (reconciler will retry)', { episodeId: ep.episode_id, err });
  }
}

/**
 * The host-sweep reconciler (once per tick). Repairs half-done best-effort state without
 * ever touching money-safety (the CAS + epoch fence already guarantee exactly-once):
 *   - EXPIRY: T1 advisory cards past 24h → 'expired' (pure dismiss; a late click on the
 *     stale card self-resolves to 'already' via the CAS).
 *   - CARD RESEND: undelivered/failed cards (a crash between ingest and the prompt send).
 *   - EFFECT RE-DRIVE: a decided episode whose override route THREW (effect_state stuck at
 *     'enqueued') is re-routed — epoch-fenced, so the runner refuses a stale/duplicate.
 *     Bounded by effect_attempts. 'expired' episodes have no override → mark applied.
 * No-op under S1 (flag OFF).
 */
export async function reconcileCostCards(nowIso: string = new Date().toISOString()): Promise<void> {
  if (!COST_APPROVAL_CARD) return;

  for (const ep of listExpiredPending(nowIso)) {
    await decideCostEpisode(ep.episode_id, 'expired', 'sweep:expiry');
  }

  for (const ep of listUndeliveredCards()) {
    await sendCostCard(ep);
  }

  const MAX_EFFECT_ATTEMPTS = 5;
  for (const ep of listUnappliedEffects()) {
    if (ep.decision_state === 'expired') {
      markEffectApplied(ep.episode_id); // dismiss has no override to land
      continue;
    }
    if (ep.decision_state !== 'continued' && ep.decision_state !== 'stopped') continue;
    // Re-drive effect_state 'none' AND 'enqueued'. 'none' means the CAS committed the
    // decision but a crash landed before the override was routed — the human's decision
    // would otherwise be PERMANENTLY LOST. 'enqueued' means the route threw. Both re-route;
    // the runner's epoch fence refuses any stale/duplicate, so re-drive is money-safe.
    if (ep.effect_state !== 'none' && ep.effect_state !== 'enqueued') continue;
    if (ep.effect_attempts >= MAX_EFFECT_ATTEMPTS) {
      log.error('cost-approval: giving up re-driving override after max attempts', {
        episodeId: ep.episode_id,
        attempts: ep.effect_attempts,
        lastError: ep.last_error,
      });
      continue;
    }
    try {
      await routeCostOverrideToSession({
        sessionId: ep.session_id,
        decision: ep.decision_state === 'continued' ? 'continue' : 'stop',
        epochKey: ep.epoch_key,
      });
      markEffectApplied(ep.episode_id);
      log.info('cost-approval: override re-driven', { episodeId: ep.episode_id, decision: ep.decision_state });
    } catch (err) {
      bumpEffectAttempt(ep.episode_id, String(err));
    }
  }
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
  // Activation boundary: supersede any observation-era (S1) episodes so flipping the flag
  // on never cards a backlog of pre-activation observations. Targets only 'observed', so a
  // genuine in-flight 'pending' card that a restart is resuming is untouched.
  const superseded = supersedeObservedEpisodes();
  log.info('cost-approval: card flag ON — interactive escalation cards active (S2)', {
    supersededObserved: superseded,
  });
}
