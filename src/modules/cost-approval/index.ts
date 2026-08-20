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
 * MONEY-SAFETY (see the runner's budget-generation fence in poll-loop.ts):
 *   - At-most-one DECISION: the approval row is at-most-once (deleted on resolve), and every
 *     surface funnels through `resolveCostEpisode` (the CAS). So the episode resolves once.
 *   - Exactly-once GRANT: the override carries the episode's `epoch_key`; the runner APPLIES
 *     at most one per generation and refuses any whose epoch ≠ its live budget generation.
 *     Enqueue is at-least-once (a crash before the durable inbound write is re-driven by the
 *     reconciler), but the fence makes a duplicate override a no-op — so no double-grant.
 *   - The host stays READ-ONLY on outbound.db — it reads `cost_cap` and writes the central
 *     table + the session's inbound override (router path).
 *
 * Mapping: Approve → CONTINUE (raise cap + resume), Reject → STOP (quiesce). Both outcomes
 * arrive via `registerApprovalResolvedHandler` and funnel to `decideCostEpisode`.
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
import { registerApprovalResolvedHandler, requestApproval } from '../approvals/index.js';
import type { ApprovalResolvedEvent } from '../approvals/primitive.js';

/**
 * T1 advisory expiry: a pending cap decision no human answers within 24h is DISMISSED — no
 * session mutation (the ceiling still bounds spend). Born-terminal ceiling episodes and
 * observation-era (S1) episodes never expire.
 */
export const COST_ESCALATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

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
  // there is no decision to make. A cap episode — and an immortal ceiling (never stops) —
  // is a live decision (pending) under S2, or observation-only under S1.
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

  // Ceiling supersedes any still-live cap decision for the same (session, epoch): a stopped
  // session must never also show a live "raise the cap?" card.
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
 * Deliver the decision card via the OFFICIAL approval adapter. `requestApproval` persists a
 * `pending_approvals` row (rendered on the dashboard even with no chat channel) and delivers
 * to chat if a channel exists — approver-picking + click-authz handled for us. The episode id
 * rides the payload so the resolved-handler maps the click back to the episode; `spentUsd` /
 * `capUsd` are surfaced by the dashboard card renderer. Skipped for a born-terminal ceiling
 * (already stopped — no decision to make).
 */
export async function requestCostDecisionCard(session: Session, ep: CostEpisodeRow): Promise<void> {
  if (ep.reason === 'ceiling' && !ep.immortal) return;
  const spent = ep.spent_usd != null ? `$${ep.spent_usd.toFixed(2)}` : '$?';
  const cap = ep.cap_usd != null ? `$${ep.cap_usd.toFixed(2)}` : '$?';
  const immortalNote = ep.immortal
    ? ' (∞ immortal: Approve raises today’s cap; Reject is a no-op — immortal never stops.)'
    : '';
  await requestApproval({
    session,
    agentName: session.agent_group_id,
    action: COST_DECISION_ACTION,
    payload: {
      episodeId: ep.episode_id,
      sessionId: ep.session_id,
      ...(ep.spent_usd != null ? { spentUsd: Number(ep.spent_usd.toFixed(4)) } : {}),
      ...(ep.cap_usd != null ? { capUsd: Number(ep.cap_usd.toFixed(4)) } : {}),
    },
    title: 'Cost cap — decision needed',
    question:
      `Session ${ep.session_id} (${ep.agent_group_id}) crossed its cost cap: spent ${spent} of ${cap}. ` +
      'Approve to CONTINUE (raise the cap by one allotment and resume), or Reject to STOP ' +
      `(finish the current turn, take no new work).${immortalNote}`,
  });
  log.info('cost-approval: decision card requested', { episodeId: ep.episode_id, sessionId: ep.session_id });
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
  // done — the runner WILL consume it, epoch-fenced + idempotent). 'enqueued'/'none' = the
  // route threw / a crash landed before it → the reconciler re-drives (money-safe to repeat).
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
    log.error('cost-approval: failed to route override (reconciler will re-drive)', {
      episodeId,
      decision,
      err,
    });
  }
  return res;
}

/**
 * The approval-resolved callback for cost decisions. Fires on EVERY resolution of a
 * `cost_decision` card, in BOTH outcomes: Approve → CONTINUE, Reject → STOP. The approval
 * system already authorized the clicker (owner/admin) and is at-most-once (row deleted on
 * resolve); we map the outcome to the epoch-fenced CAS. No-op for other actions.
 */
async function costDecisionResolved(event: ApprovalResolvedEvent): Promise<void> {
  if (event.approval.action !== COST_DECISION_ACTION) return;
  let episodeId: string | undefined;
  try {
    const parsed = JSON.parse(event.approval.payload) as { episodeId?: unknown };
    if (typeof parsed.episodeId === 'string') episodeId = parsed.episodeId;
  } catch {
    /* unparseable payload — nothing to resolve */
  }
  if (!episodeId) return;
  const decision: CostDecision = event.outcome === 'approve' ? 'continue' : 'stop';
  await decideCostEpisode(episodeId, decision, `approval:${event.userId || 'unknown'}`);
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

  for (const ep of listExpiredPending(nowIso)) {
    await decideCostEpisode(ep.episode_id, 'expired', 'sweep:expiry');
  }

  const MAX_EFFECT_ATTEMPTS = 5;
  for (const ep of listUnappliedEffects()) {
    if (ep.decision_state === 'expired') {
      markEffectApplied(ep.episode_id); // dismiss has no override to land
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
      markEffectApplied(ep.episode_id);
      log.info('cost-approval: override re-driven', { episodeId: ep.episode_id, decision: ep.decision_state });
    } catch (err) {
      bumpEffectAttempt(ep.episode_id, String(err));
    }
  }
}

/**
 * Wire the cost-approval module at boot. Under S1 (flag OFF) episodes are ingested read-only
 * (observation mode) and the legacy DM fires — this only logs. Under S2 (flag ON) it
 * supersedes observation-era episodes and registers the cost-decision resolved-handler so
 * Approve/Reject on the official card drives the epoch-fenced CAS. The single flag flip is
 * the activation point.
 */
export function registerCostApproval(): void {
  if (!COST_APPROVAL_CARD) {
    log.info('cost-approval: card flag OFF — episodes recorded read-only (S1)');
    return;
  }
  // Activation boundary: supersede observation-era (S1) episodes so a flag flip never cards a
  // backlog. Targets only 'observed' — a genuine in-flight 'pending' decision is untouched.
  const superseded = supersedeObservedEpisodes();
  registerApprovalResolvedHandler(costDecisionResolved);
  log.info('cost-approval: card flag ON — cost decisions via official approval cards (S2)', {
    supersededObserved: superseded,
  });
}
