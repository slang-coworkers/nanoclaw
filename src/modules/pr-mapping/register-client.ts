/**
 * HTTP client for posting PR→session registrations from a non-canonical
 * instance to the canonical one. Body is HMAC-SHA256 signed with
 * INTERNAL_REGISTER_SECRET (separate from the GitHub webhook secret so
 * leaks of one don't compromise the other).
 */
import crypto from 'crypto';

import type { PrMappingWrite } from './store.js';

export const REGISTER_SIGNATURE_HEADER = 'x-internal-signature-256';

export interface RegisterPrRequest {
  repo: string;
  pr_number: number;
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
}

export function signRegisterBody(secret: string, rawBody: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
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
  const sig = signRegisterBody(secret, body);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [REGISTER_SIGNATURE_HEADER]: sig,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`register-pr non-OK: ${res.status}`);
  }
}
