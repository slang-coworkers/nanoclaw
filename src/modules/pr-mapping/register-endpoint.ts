/**
 * Receiver for cross-instance PR→session registrations. Mounted under
 * `/internal/register-pr` on the GitHub webhook server (same listener,
 * different path). Validates an HMAC over the raw body using
 * INTERNAL_REGISTER_SECRET and writes through the shared upsert path.
 *
 * Lives here, not in github-webhook-server.ts, so the webhook file stays
 * the single-purpose webhook handler and this endpoint can grow its own
 * concerns (e.g. eventually a deregister path) without bloating that one.
 */
import type { IncomingMessage, ServerResponse } from 'http';

import { INSTANCE_SLUG, VALID_INSTANCE_SLUGS } from '../../config.js';
import { getDb } from '../../db/connection.js';
import { getSession } from '../../db/sessions.js';
import { log } from '../../log.js';
import { TRUST_SIGNATURE_HEADER, verifyTrustedSignature } from './register-client.js';
import { claimPrMapping } from './store.js';

const MAX_BODY_SIZE = 64 * 1024; // 64 KB; payload is small JSON

function readRawBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    let exceeded = false;
    req.on('data', (chunk: Buffer | string) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE && !exceeded) {
        exceeded = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'payload too large' }));
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      if (!exceeded) resolve(body);
    });
    req.on('error', () => {
      if (!exceeded) resolve(null);
    });
  });
}

interface RegisterBody {
  repo: unknown;
  pr_number: unknown;
  owner_instance: unknown;
  agent_group_id: unknown;
  session_id: unknown;
  thread_id: unknown;
}

function writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

export async function handleRegisterPr(req: IncomingMessage, res: ServerResponse, secret: string): Promise<void> {
  if (!secret) {
    log.warn('register-pr: INTERNAL_REGISTER_SECRET unset — refusing all requests');
    writeJson(res, 503, { error: 'register endpoint disabled' });
    return;
  }

  const rawBody = await readRawBody(req, res);
  if (rawBody === null) return;

  const sigHeader = String(req.headers[TRUST_SIGNATURE_HEADER] ?? '');
  if (!verifyTrustedSignature(secret, rawBody, sigHeader)) {
    log.warn('register-pr: invalid or missing signature');
    writeJson(res, 401, { error: 'invalid signature' });
    return;
  }

  let parsed: RegisterBody;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    writeJson(res, 400, { error: 'invalid json' });
    return;
  }

  const repo = typeof parsed.repo === 'string' ? parsed.repo.trim() : '';
  const prNumber = typeof parsed.pr_number === 'number' ? parsed.pr_number : NaN;
  const ownerInstance = typeof parsed.owner_instance === 'string' ? parsed.owner_instance.trim() : '';
  const agentGroupId = typeof parsed.agent_group_id === 'string' ? parsed.agent_group_id.trim() : '';
  const sessionId = typeof parsed.session_id === 'string' ? parsed.session_id.trim() : '';
  const threadId = typeof parsed.thread_id === 'string' ? parsed.thread_id : null;

  if (!repo || !Number.isFinite(prNumber) || prNumber <= 0 || !ownerInstance || !agentGroupId || !sessionId) {
    writeJson(res, 400, {
      error: 'missing required fields',
      required: ['repo', 'pr_number', 'owner_instance', 'agent_group_id', 'session_id'],
    });
    return;
  }

  if (!(VALID_INSTANCE_SLUGS as readonly string[]).includes(ownerInstance)) {
    log.warn('register-pr: rejected unknown owner_instance', {
      repo,
      pr: prNumber,
      owner_instance: ownerInstance,
    });
    writeJson(res, 400, {
      error: 'unknown owner_instance',
      allowed: [...VALID_INSTANCE_SLUGS],
    });
    return;
  }

  // A LOCAL claim arriving over the wire is the one case this endpoint can
  // check: the ids belong to this install's DB, so they must resolve and the
  // session must belong to the group it claims. Foreign claims carry the
  // PEER's ids — opaque here by design, which is what `owner_instance` is for
  // — so there is nothing to validate and validating would break the flow.
  if (ownerInstance === INSTANCE_SLUG) {
    const local = getSession(sessionId);
    if (!local || local.agent_group_id !== agentGroupId) {
      log.error('register-pr: rejected a local claim whose session does not belong to the claimed group', {
        repo,
        pr: prNumber,
        agent_group_id: agentGroupId,
        session_id: sessionId,
        sessionExists: Boolean(local),
      });
      writeJson(res, 403, { error: 'session does not belong to the claimed agent group' });
      return;
    }
  }

  const claim = claimPrMapping(getDb(), { repo, prNumber, ownerInstance, agentGroupId, sessionId, threadId });

  if (claim.outcome === 'rejected') {
    // 409, not 200-with-a-lie: the peer has to be able to tell that its
    // registration did not take, or it reports a wired PR that is not wired.
    writeJson(res, 409, {
      error: 'pr already claimed',
      held_by: { owner_instance: claim.prior.owner_instance, agent_group_id: claim.prior.agent_group_id },
      remedy: `ncl pr-mappings remap --repo ${repo} --pr ${prNumber} …`,
    });
    return;
  }

  log.info('register-pr: mapping recorded', {
    repo,
    pr: prNumber,
    owner: ownerInstance,
    session: sessionId,
    outcome: claim.outcome,
  });
  writeJson(res, 200, { ok: true, outcome: claim.outcome });
}
