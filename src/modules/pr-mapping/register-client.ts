/**
 * HMAC signing for trusted cross-instance traffic.
 *
 * The same secret (INTERNAL_REGISTER_SECRET) signs two independent flows:
 *
 *   1. POST /internal/register-pr   — write a PR→session mapping on the
 *                                     canonical instance from a remote one.
 *   2. POST /webhook/github         — forward a GitHub webhook from the
 *                                     receiving instance (prod) to the
 *                                     instance that owns the PR (lego).
 *                                     Marked with X-Webhook-Trust header so
 *                                     the funnel skips its filters.
 *
 * Both flows use the same header (X-Internal-Signature-256) so the verify
 * helper has one code path. They are distinguished by URL path on the
 * receiver side — /internal/register-pr writes to the mappings table;
 * /webhook/github with X-Webhook-Trust=pre-validated delivers to a session.
 */
import crypto from 'crypto';

import type { PrMappingWrite } from './store.js';

export const TRUST_SIGNATURE_HEADER = 'x-internal-signature-256';
export const WEBHOOK_TRUST_HEADER = 'x-webhook-trust';
export const WEBHOOK_TRUST_VALUE = 'pre-validated';

/** @deprecated use TRUST_SIGNATURE_HEADER */
export const REGISTER_SIGNATURE_HEADER = TRUST_SIGNATURE_HEADER;

export interface RegisterPrRequest {
  repo: string;
  pr_number: number;
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
}

export function signTrustedBody(secret: string, rawBody: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

/** @deprecated use signTrustedBody */
export const signRegisterBody = signTrustedBody;

export function verifyTrustedSignature(secret: string, rawBody: string, sigHeader: string): boolean {
  const expected = signTrustedBody(secret, rawBody);
  try {
    const maxLen = Math.max(expected.length, sigHeader.length);
    const a = Buffer.alloc(maxLen, 0);
    const b = Buffer.alloc(maxLen, 0);
    Buffer.from(expected).copy(a);
    Buffer.from(sigHeader).copy(b);
    return crypto.timingSafeEqual(a, b) && expected === sigHeader;
  } catch {
    return false;
  }
}

export function writeToRequest(w: PrMappingWrite): RegisterPrRequest {
  return {
    repo: w.repo,
    pr_number: w.prNumber,
    owner_instance: w.ownerInstance,
    agent_group_id: w.agentGroupId,
    session_id: w.sessionId,
    thread_id: w.threadId,
  };
}

export async function postRegisterPr(url: string, secret: string, w: PrMappingWrite): Promise<void> {
  const body = JSON.stringify(writeToRequest(w));
  const sig = signTrustedBody(secret, body);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [TRUST_SIGNATURE_HEADER]: sig,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`register-pr non-OK: ${res.status}`);
  }
}
