/**
 * The guard-consult path for privileged delivery actions.
 *
 * The registry itself — registration, lookup, approved-replay re-entry —
 * stays in delivery.ts, close to main's shape. This file holds the new
 * guard logic: the spec a privileged registration carries, and runGuarded,
 * the precheck → guard → deny/hold/allow pipeline every consult runs.
 */
import { guard, type GuardedAction } from './guard/index.js';
import { log } from './log.js';
import type { PendingApproval, Session } from './types.js';

/** Handler shape for guard-wrapped actions — must not touch inDb (replays run without one). */
export type GuardedDeliveryHandler = (content: Record<string, unknown>, session: Session) => Promise<void>;

export interface DeliveryGuardSpec {
  /** Guard action consulted before the handler runs — the defined value, not a name. */
  guardAction: GuardedAction;
  /**
   * Domain validation that runs before the guard — malformed requests are
   * answered (notify) without ever creating a hold. Return false to stop.
   */
  precheck?: (content: Record<string, unknown>, session: Session) => boolean | Promise<boolean>;
  /**
   * Create the hold (the domain's requestApproval call — card text lives with
   * the domain).
   *
   * Omitted by actions whose decide fn never returns HOLD — the same class the
   * guard catalog marks by leaving `grantActionName` unset. The
   * approval-ledger actions are the case in point: "may this container write
   * an approval outcome for a PR it was never given?" is not a question a
   * human can answer from a card, so it is refused rather than escalated.
   * A hold that arrives with no builder is a wiring bug; runGuarded fails
   * closed and says so.
   */
  requestHold?: (content: Record<string, unknown>, session: Session) => Promise<void>;
  /** Tell the requester about a deny. */
  onDeny?: (content: Record<string, unknown>, session: Session, reason: string) => void | Promise<void>;
}

/**
 * Run a guarded delivery action: precheck, consult the guard, then route the
 * decision — deny → onDeny, hold → requestHold, allow → handler. A fresh
 * dispatch passes grant=null; an approved replay passes the approval row,
 * which satisfies a hold but never a deny (the structural checks re-run
 * live, so approve-then-revoke does not execute).
 */
export async function runGuarded(
  action: string,
  spec: DeliveryGuardSpec,
  handler: GuardedDeliveryHandler,
  content: Record<string, unknown>,
  session: Session,
  grant: PendingApproval | null,
): Promise<void> {
  if (spec.precheck && !(await spec.precheck(content, session))) return;

  const decision = await guard(spec.guardAction, {
    actor: { kind: 'agent', agentGroupId: session.agent_group_id, sessionId: session.id },
    payload: content,
    grant,
  });

  if (decision.effect === 'deny') {
    log.warn('Delivery action denied by guard', { action, reason: decision.reason });
    await spec.onDeny?.(content, session, decision.reason);
    return;
  }
  if (decision.effect === 'hold') {
    if (!spec.requestHold) {
      // No approval path was declared for this action, so there is nobody to
      // ask — do not run the handler. Loud, because it means a decide fn grew
      // a HOLD branch its registration was never updated for.
      log.error('Delivery action held but declares no approval path — failing closed', {
        action,
        reason: decision.reason,
      });
      spec.onDeny?.(content, session, `${decision.reason} (no approval path is configured for this action)`);
      return;
    }
    await spec.requestHold(content, session);
    return;
  }
  await handler(content, session);
}
