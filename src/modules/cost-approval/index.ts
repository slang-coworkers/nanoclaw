/**
 * Cost-cap escalation approval card — host module (NanoClaw #1 cost cap, Option 2).
 *
 * The durable data model + the compare-and-set resolver live in
 * `src/db/cost-escalation-episodes.ts` (migration 939); this module drives them: INGEST a
 * runner escalation into the central table, deliver the decision via the OFFICIAL approval
 * card (`requestApproval` — the same surface install_packages / runaway use, which renders
 * on the dashboard AND chat and is authorization-gated), and DECIDE through the CAS.
 *
 * Why the official card and not a bespoke one: `requestApproval` persists a `pending_approvals`
 * row that the dashboard renders even when no chat channel exists ("row persisted for
 * dashboard"), does approver-picking + click-authz for us, and shows `$spent/$cap` from the
 * payload. So the cost decision reuses proven infra — no custom card render / click code.
 *
 * ONE CARD, THE CEILING ONLY (redesign, 2026-08-24): the Tier-1 per-session cap crossing
 * used to card too — at a p90-derived cap that floored to ~$10 for most groups, it produced
 * far more noise than signal (a fleet audit found 133 cap episodes in days, 61 expired
 * unanswered, while the 25 genuine Tier-2 ceiling stops sat silent with no card at all). Now:
 *   - Tier-1 'cap' crossings are OBSERVATION ONLY — ingested for the record, never a decision,
 *     never a card (the runner keeps tracking/publishing spend for the dashboard regardless).
 *   - A Tier-2 ceiling breach for a NON-immortal session is the only actionable episode: the
 *     runner already hard-stopped it, so the card is "this is blocked, decide" — not "heads
 *     up". It does NOT expire (a silently-abandoned decision would otherwise leave the session
 *     stopped forever with no human ever having been asked).
 *   - An immortal ceiling breach stays observation-only too (immortal is never blocked, so
 *     there's nothing to decide — see poll-loop.ts's costImmortal guard).
 *
 * MONEY-SAFETY (see the runner's budget-generation fence in poll-loop.ts):
 *   - At-most-one DECISION: the approval row is at-most-once (deleted on resolve), and every
 *     surface funnels through `resolveCostEpisode` (the CAS). So the episode resolves once.
 *   - Exactly-once GRANT: the override carries the episode's `epoch_key`; the runner APPLIES
 *     at most one per generation and refuses any whose epoch ≠ its live budget generation.
 *     Enqueue is at-least-once (a crash before the durable inbound write is re-driven by the
 *     reconciler), but the fence makes a duplicate override a no-op — so no double-grant. On
 *     approve, the runner raises the ceiling by one fixed allotment (bounded — a session that
 *     burns through the raise re-stops and re-cards) and queues a cost-sensitivity nudge for
 *     the agent's next turn.
 *   - The host stays READ-ONLY on outbound.db — it reads `cost_cap` and writes the central
 *     table + the session's inbound override (router path).
 *
 * Mapping: Approve → CONTINUE (raise ceiling + resume), Reject → STOP (stays quiesced). Approve
 * arrives via `registerApprovalHandler` (the standard "run this on approve" hook — see
 * self-mod/runaway/critique-escalation); Reject arrives via `registerApprovalResolvedHandler`
 * filtered to the reject outcome (mirrors critique-escalation's BYPASS_ACTION pattern). Using
 * ONLY the resolved-handler for both — the first cut of this module — left no action handler
 * registered, so `response-handler.ts` took its "no handler installed" fallback branch on every
 * approve (cosmetic: the resolved-handler still fired and the override still applied, but the
 * agent and the admin both saw a false failure message). This split is the fix.
 */
import { COST_APPROVAL_CARD } from '../../config.js';
import { deletePendingApproval, getPendingApprovalsByAction } from '../../db/sessions.js';
import {
  bumpEffectAttempt,
  expireEpisode,
  getEpisode,
  getEpisodeByShortId,
  ingestEpisode,
  listExpiredPending,
  listUnappliedEffects,
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
import { log } from '../../log.js';
import { routeCostOverrideToSession } from '../../router.js';
import type { Session } from '../../types.js';
// Import from primitive.js DIRECTLY, not the approvals barrel: the barrel pulls in
// onecli-approvals, whose import-time onDeliveryAdapterReady() re-enters delivery.ts
// mid-initialization (delivery → cost-approval → approvals/index → delivery), a
// circular-import TDZ crash. primitive.js only touches delivery inside functions.
import {
  registerApprovalHandler,
  registerApprovalResolvedHandler,
  requestApproval,
  type ApprovalHandlerContext,
  type ApprovalResolvedEvent,
} from '../approvals/primitive.js';

/** The approval action key the decision card is registered under. */
const COST_DECISION_ACTION = 'cost_decision';

/**
 * A short, unique handle for the episode's NOT-NULL UNIQUE `short_id` column (a stable
 * per-row id used for joins/traceability), collision-retried against the column.
 */
function freshShortId(): string {
  for (let i = 0; i < 8; i++) {
    const candidate = `cst-${Math.random().toString(36).slice(2, 9)}`;
    if (!getEpisodeByShortId(candidate)) return candidate;
  }
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
  /** True once the approval card owns the notification (S2) — the caller must NOT also send
   *  the legacy plain-text DM. False under S1 (DM stays as-is). */
  cardOwnsNotification: boolean;
}

/**
 * INGEST a runner `cost_escalation` payload into the central episode table (idempotent,
 * fail-soft). A stale runner (pre-card agent-runner-src) emits no `episodeId`/`epochKey`
 * → nothing to ingest and the caller falls back to the legacy DM (back-compat for
 * un-refreshed groups).
 */
export async function ingestCostEscalation(
  content: Record<string, unknown>,
  session: Session,
  nowIso: string = new Date().toISOString(),
): Promise<IngestResult> {
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
  // The ONLY actionable episode: a non-immortal Tier-2 ceiling breach. The runner already
  // hard-stopped it, so this is a genuine "decide" — and it must NOT expire (an abandoned
  // decision would otherwise leave the session stopped forever with no human ever asked).
  // Everything else (a Tier-1 'cap' crossing; an immortal ceiling breach, which never
  // blocks) is observation-only, regardless of the flag — ingested for the record, no card.
  const isCard = active && reason === 'ceiling' && !immortal;
  const decisionState = isCard ? 'pending' : 'observed';
  const cardState = isCard ? 'undelivered' : 'observed';
  // No episode carries an expiry any more (the one card-worthy case must NOT auto-dismiss).
  // The expiry CAS + sweep in reconcileCostCards below stay wired as a dormant safety net —
  // harmless to leave live, and it costs nothing per sweep tick when nothing matches.
  const expiresAt = null;

  const isNew = await ingestEpisode({
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

  // Ceiling supersedes any still-live cap decision for the same (session, epoch): defense in
  // depth from the pre-redesign S1/legacy path (a NEW cap episode is never 'pending' any more,
  // so this typically matches nothing) — reap the superseded rows' cards so none go stale.
  if (reason === 'ceiling') {
    for (const superseded of await supersedeLiveCapEpisodes(session.id, epochKey, nowIso)) {
      await reapPendingApprovalCard(superseded.episode_id);
    }
  }

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
 * Deliver the decision card via the OFFICIAL approval adapter. `requestApproval` persists a
 * `pending_approvals` row (rendered on the dashboard even with no chat channel) and delivers
 * to chat if a channel exists — approver-picking + click-authz handled for us. The episode id
 * rides the payload so the response handler maps the click back to the episode. Only a
 * non-immortal Tier-2 ceiling breach is ever card-worthy — see the module doc comment — so
 * this is a no-op for anything else (ingestCostEscalation never marks those 'pending', but
 * this guard keeps the function correct even if called directly).
 */
export async function requestCostDecisionCard(session: Session, ep: CostEpisodeRow): Promise<void> {
  if (ep.reason !== 'ceiling' || ep.immortal) return;
  const spent = ep.spent_usd != null ? `$${ep.spent_usd.toFixed(2)}` : '$?';
  const ceiling = ep.ceiling_usd != null ? `$${ep.ceiling_usd.toFixed(2)}` : '$?';
  await requestApproval({
    session,
    agentName: session.agent_group_id,
    action: COST_DECISION_ACTION,
    payload: {
      episodeId: ep.episode_id,
      sessionId: ep.session_id,
      ...(ep.spent_usd != null ? { spentUsd: Number(ep.spent_usd.toFixed(4)) } : {}),
      // Dashboard renderer reads `capUsd` for the "$spent of $cap" line — feed it the
      // ceiling (the only threshold this card is ever about now).
      ...(ep.ceiling_usd != null ? { capUsd: Number(ep.ceiling_usd.toFixed(4)) } : {}),
    },
    title: 'Cost ceiling reached — session blocked',
    question:
      `Session ${ep.session_id} (${ep.agent_group_id}) HIT ITS COST CEILING and is STOPPED: spent ${spent} ` +
      `of ${ceiling}. Approve to raise the ceiling by one allotment and resume (the agent is told to be ` +
      'cost-conscious on its next turn), or Reject to leave it stopped.',
  });
  log.info('cost-approval: ceiling decision card requested', { episodeId: ep.episode_id, sessionId: ep.session_id });
}

/**
 * Delete the dashboard/chat card for an episode, if one was ever created. There is no direct
 * `episode -> approval_id` link (`requestApproval` generates its own id internally and returns
 * `void`, so nothing to store it against), so this scans the small `cost_decision` action set
 * for a payload whose `episodeId` matches. A human clicking the card already deletes its own
 * row (response-handler.ts, unconditionally, after any approve/reject); this is for episodes
 * resolved BEHIND the card's back — today, only the supersede path above. Idempotent: finds
 * nothing (and does nothing) once the row is already gone.
 */
async function reapPendingApprovalCard(episodeId: string): Promise<void> {
  for (const approval of await getPendingApprovalsByAction(COST_DECISION_ACTION)) {
    if (approval.status !== 'pending') continue;
    let payloadEpisodeId: unknown;
    try {
      payloadEpisodeId = (JSON.parse(approval.payload) as { episodeId?: unknown }).episodeId;
    } catch {
      continue;
    }
    if (payloadEpisodeId === episodeId) await deletePendingApproval(approval.approval_id);
  }
}

/**
 * DECIDE a human verdict through the CAS. On a win, enqueue EXACTLY ONE epoch-fenced
 * `cost_override` (continue/stop) via the router, or — for `expired` — DISMISS with no
 * session mutation (T1 advisory). A loser (already resolved / expired / epoch-superseded)
 * gets `won:false`. Idempotent: safe to call twice.
 */
export async function decideCostEpisode(
  episodeId: string,
  decision: CostDecision,
  resolvedBy: string,
): Promise<ResolveResult> {
  const current = await getEpisode(episodeId);
  if (!current) {
    log.warn('cost-approval: decide on unknown episode', { episodeId, decision });
    return { won: false, episode: undefined };
  }

  // Expiry has the mirror-image CAS (win only on a past-expiry pending row) and is a pure
  // DISMISS — no override, no session mutation (T1 advisory). resolveCostEpisode can't do
  // it: its predicate refuses any resolution on an already-expired row.
  if (decision === 'expired') {
    const res = await expireEpisode(episodeId, resolvedBy);
    if (res.won) {
      log.info('cost-approval: episode expired (dismissed)', { episodeId });
      await reapPendingApprovalCard(episodeId);
    }
    return res;
  }

  const res = await resolveCostEpisode(episodeId, decision, resolvedBy, {
    expectedEpochKey: current.epoch_key,
  });
  if (!res.won) {
    log.info('cost-approval: decision did not win the CAS (already resolved/expired)', {
      episodeId,
      decision,
    });
    return res;
  }
  // A human click already deletes its own card (response-handler.ts); this covers every
  // OTHER path that can win the CAS (today: none, going forward: defense in depth) so a
  // decision made behind the card's back never leaves it stale on the dashboard.
  await reapPendingApprovalCard(episodeId);

  // Continue/Stop enqueue exactly one epoch-fenced override. effect_state semantics:
  // 'applied' = the override is DURABLY in the session's inbound.db (the host's job is
  // done — the runner WILL consume it, epoch-fenced + idempotent). 'enqueued'/'none' = the
  // route threw / a crash landed before it → the reconciler re-drives (money-safe to repeat).
  await markEffectEnqueued(episodeId);
  try {
    await routeCostOverrideToSession({
      sessionId: current.session_id,
      decision,
      epochKey: current.epoch_key,
    });
    await markEffectApplied(episodeId);
    log.info('cost-approval: override enqueued', {
      episodeId,
      decision,
      sessionId: current.session_id,
      epochKey: current.epoch_key,
    });
  } catch (err) {
    log.error('cost-approval: failed to route override (reconciler will re-drive)', {
      episodeId,
      decision,
      err,
    });
  }
  return res;
}

/** Pull `episodeId` out of an approval payload; undefined if missing/unparseable. */
function payloadEpisodeId(payload: string): string | undefined {
  try {
    const parsed = JSON.parse(payload) as { episodeId?: unknown };
    return typeof parsed.episodeId === 'string' ? parsed.episodeId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Approve → CONTINUE. Registered via `registerApprovalHandler` — the standard "run this on
 * approve" hook every other approval-gated action uses (self-mod, runaway, agent-to-agent,
 * critique-escalation's bypass). The approval system already authorized the clicker
 * (owner/admin) and is at-most-once (row deleted by response-handler.ts right after this
 * returns); we just map to the epoch-fenced CAS.
 */
async function applyCostApproveHandler(ctx: ApprovalHandlerContext): Promise<void> {
  const episodeId = payloadEpisodeId(ctx.approval.payload);
  if (!episodeId) return;
  const res = await decideCostEpisode(episodeId, 'continue', `approval:${ctx.userId || 'unknown'}`);
  if (!res.won) {
    ctx.notify('This cost decision was already resolved (or the session moved on) — no change made.');
  }
}

/**
 * Reject → STOP. Registered via `registerApprovalResolvedHandler` filtered to the reject
 * outcome (mirrors critique-escalation's BYPASS_ACTION pattern) — `registerApprovalHandler`
 * only ever fires on approve, so a genuine reject-side effect needs the resolved-handler.
 * No-op for other actions or for approve (that's `applyCostApproveHandler`'s job — handling
 * both here would double-call `decideCostEpisode` per click; harmless since it's a CAS, but
 * pointless).
 */
async function costDecisionRejected(event: ApprovalResolvedEvent): Promise<void> {
  if (event.approval.action !== COST_DECISION_ACTION || event.outcome !== 'reject') return;
  const episodeId = payloadEpisodeId(event.approval.payload);
  if (!episodeId) return;
  await decideCostEpisode(episodeId, 'stop', `approval:${event.userId || 'unknown'}`);
}

/**
 * The host-sweep reconciler (once per tick). Repairs half-done best-effort state without
 * ever touching money-safety (the CAS + epoch fence already guarantee exactly-once):
 *   - EXPIRY: T1 advisory decisions past 24h → 'expired' (pure dismiss; a late resolve on the
 *     stale approval no-ops via the CAS).
 *   - EFFECT RE-DRIVE: a decided episode whose override route THREW or crashed before landing
 *     (effect_state 'enqueued'/'none') is re-routed — epoch-fenced, so the runner refuses a
 *     stale/duplicate. Bounded by effect_attempts. 'expired' episodes have no override.
 * No-op under S1 (flag OFF). Card DELIVERY is not reconciled here — `requestApproval`
 * persists the dashboard-visible row up front, so there is no separate card to re-send.
 */
export async function reconcileCostCards(nowIso: string = new Date().toISOString()): Promise<void> {
  if (!COST_APPROVAL_CARD) return;

  for (const ep of await listExpiredPending(nowIso)) {
    await decideCostEpisode(ep.episode_id, 'expired', 'sweep:expiry');
  }

  const MAX_EFFECT_ATTEMPTS = 5;
  for (const ep of await listUnappliedEffects()) {
    if (ep.decision_state === 'expired') {
      await markEffectApplied(ep.episode_id); // dismiss has no override to land
      continue;
    }
    if (ep.decision_state !== 'continued' && ep.decision_state !== 'stopped') continue;
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
      await markEffectApplied(ep.episode_id);
      log.info('cost-approval: override re-driven', { episodeId: ep.episode_id, decision: ep.decision_state });
    } catch (err) {
      await bumpEffectAttempt(ep.episode_id, String(err));
    }
  }
}

/**
 * Wire the cost-approval module at boot. Under S1 (flag OFF) episodes are ingested read-only
 * (observation mode) and the legacy DM fires — this only logs. Under S2 (flag ON) it
 * supersedes observation-era episodes and registers BOTH cost-decision handlers — the approve
 * action handler and the reject-filtered resolved-handler — so Approve/Reject on the official
 * ceiling card drives the epoch-fenced CAS. The single flag flip is the activation point.
 */
export async function registerCostApproval(): Promise<void> {
  if (!COST_APPROVAL_CARD) {
    log.info('cost-approval: card flag OFF — episodes recorded read-only (S1)');
    return;
  }
  // Activation boundary: supersede observation-era (S1) episodes so a flag flip never cards a
  // backlog. Targets only 'observed' — a genuine in-flight 'pending' decision is untouched.
  const superseded = await supersedeObservedEpisodes();
  registerApprovalHandler(COST_DECISION_ACTION, applyCostApproveHandler);
  registerApprovalResolvedHandler(costDecisionRejected);
  log.info('cost-approval: card flag ON — cost decisions via official approval cards (S2)', {
    supersededObserved: superseded,
  });
}
