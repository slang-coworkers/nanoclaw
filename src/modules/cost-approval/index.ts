/**
 * Cost-cap escalation approval card — module scaffold (NanoClaw #1 cost cap, Option 2).
 *
 * STATUS: S1 skeleton. The durable data model + the compare-and-set resolver live in
 * `src/db/cost-escalation-episodes.ts` (migration 939) and are exercised now. The
 * ACTION surface below (card delivery, decision→effect→ack, reconciler, expiry,
 * pill/bridge routing) activates only under the `COST_APPROVAL_CARD` flag (S2) and is
 * being finalized against the v5 plan review — the functions here are intentionally
 * inert until that lands, so S1 changes nothing at runtime.
 *
 * The lifecycle this module owns (see the accessor for the state columns):
 *   INGEST   host consumes the runner's `cost_escalation` outbound row → ingestEpisode()
 *            (idempotent). Under the OFF flag it records `card_state:'observed'` and stops.
 *   CARD     card reconciler (re)sends the interactive Continue/Stop card via a
 *            cost-specific delivery path; stores platform_message_id on success.
 *   DECIDE   card click / dashboard pill / expiry all funnel through resolveCostEpisode()
 *            (the CAS) — first writer wins; a loser re-renders the terminal result.
 *   EFFECT   Continue → enqueue ONE cost_override(continue, episode_id) to the session
 *            (runner acks via the outbound.db cost_receipts ledger; dedups by episode_id).
 *            Stop → host close+kill. Reconciler re-drives any decided-but-unapplied effect.
 *   EXPIRE   advisory-T1 expiry DISMISSES the card (no session mutation).
 */
import { COST_APPROVAL_CARD } from '../../config.js';
import { log } from '../../log.js';

/**
 * Wire the cost-approval module at boot. No-op while the flag is OFF (S1): episodes are
 * still ingested + rendered read-only, but nothing is carded or actioned. When the flag
 * is ON (S2) this registers the ingest → card → resolve → reconcile pipeline.
 */
export function registerCostApproval(): void {
  if (!COST_APPROVAL_CARD) {
    log.info('cost-approval: card flag OFF — episodes recorded read-only (S1)');
    return;
  }
  // TODO(S2, pending v5): register the cost_escalation ingest handler, the click
  // interceptor (bridge-first), the CAS-backed decision resolver, and the host-sweep
  // reconciler (card resend / effect re-drive / expiry-dismiss). Gated here so a flag
  // flip is the single activation point.
  log.warn('cost-approval: card flag ON but S2 pipeline not yet wired');
}
