/**
 * Cross-instance webhook forwarding.
 *
 * The canonical router (typically prod) receives every GitHub webhook
 * delivery. When a delivery names a PR owned by a different instance
 * (per pr_session_mappings.owner_instance), the router re-signs the raw
 * body with INTERNAL_REGISTER_SECRET and POSTs it to the peer's
 * /webhook/github with X-Webhook-Trust=pre-validated. The peer's funnel
 * sees that header, validates the peer signature, and skips its filters
 * (mention check, action check, etc.) since the canonical router has
 * already made the routing decision.
 *
 * Fire-and-forget: a forward failure means the next webhook on the same
 * PR will fall through to orchestrator dispatch. Acceptable degradation.
 */
import { log } from '../../log.js';
import {
  signTrustedBody,
  TRUST_SIGNATURE_HEADER,
  WEBHOOK_TRUST_HEADER,
  WEBHOOK_TRUST_VALUE,
} from './register-client.js';

export interface ForwardWebhookArgs {
  url: string;
  secret: string;
  rawBody: string;
  event: string;
  delivery: string;
}

export function forwardWebhookToPeer(args: ForwardWebhookArgs): void {
  const { url, secret, rawBody, event, delivery } = args;
  if (!url || !secret) {
    log.warn('webhook-forward: missing url or secret — skipping', { url: !!url, secret: !!secret });
    return;
  }

  const sig = signTrustedBody(secret, rawBody);
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': event,
      'X-GitHub-Delivery': delivery,
      [TRUST_SIGNATURE_HEADER]: sig,
      [WEBHOOK_TRUST_HEADER]: WEBHOOK_TRUST_VALUE,
    },
    body: rawBody,
  })
    .then((r) => {
      if (!r.ok) {
        log.warn('webhook-forward: peer returned non-OK', { url, status: r.status, delivery });
      } else {
        log.info('webhook-forward: delivered to peer', { url, delivery });
      }
    })
    .catch((err: unknown) => {
      log.warn('webhook-forward: peer request failed', { url, delivery, error: String(err) });
    });
}
