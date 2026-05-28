/**
 * GitHub webhook receiver — dedicated HTTP server on GITHUB_WEBHOOK_PORT.
 *
 * Separate from dashboard-ingress (127.0.0.1 only) so this port can be
 * exposed publicly via brev without exposing the dashboard chat endpoint.
 * Security: HMAC-SHA256 (X-Hub-Signature-256) validation before any processing.
 */
import crypto from 'crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';

import {
  GITHUB_WEBHOOK_BOT_MENTION,
  GITHUB_WEBHOOK_PORT,
  GITHUB_WEBHOOK_SECRET,
  INSTANCE_FORWARD_TARGETS,
  INSTANCE_SLUG,
  INTERNAL_REGISTER_SECRET,
} from './config.js';
import { log } from './log.js';
import {
  TRUST_SIGNATURE_HEADER,
  WEBHOOK_TRUST_HEADER,
  WEBHOOK_TRUST_VALUE,
  verifyTrustedSignature,
} from './modules/pr-mapping/register-client.js';
import { handleRegisterPr } from './modules/pr-mapping/register-endpoint.js';
import { deliverGitHubIssueOpened, deliverGitHubMention } from './webhook-github.js';

const MAX_BODY_SIZE = 512 * 1024; // 512 KB

export interface GitHubWebhookServerHandle {
  server: Server;
  stop(): Promise<void>;
}

function writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readRawBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    let exceeded = false;
    req.on('data', (chunk: Buffer | string) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE && !exceeded) {
        exceeded = true;
        writeJson(res, 413, { error: 'payload too large' });
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

/** Constant-time HMAC-SHA256 comparison against GitHub's X-Hub-Signature-256 header. */
function verifySignature(secret: string, rawBody: string, sigHeader: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
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

/**
 * Post a 👀 reaction on the triggering comment so the human sees their
 * @mention was received and is being processed. Fires on the canonical
 * instance the moment we accept a GitHub-signed webhook — independent
 * of whether a coworker container is awake. The skill's Step 0 still
 * fires when the agent runs (idempotent — GitHub returns 422 on dup,
 * which the skill swallows with `|| echo`).
 *
 * Auth: uses GH_TOKEN from the host environment (rotated by cron from
 * a GitHub App installation token). Without it, skip with a warn so a
 * misconfigured install doesn't flood logs with 401s.
 *
 * Skipped on peer-forward inbound: the canonical router already posted
 * 👀 before forwarding, so the peer doesn't double-react. Skipped on
 * `issues` events: GitHub doesn't support reactions on issues themselves
 * (only on comments inside them).
 *
 * Fire-and-forget — never blocks the 200 OK we owe GitHub. Failures
 * (network, non-OK, already-reacted 422) are warn-logged and swallowed.
 */
export async function postEyesReaction(repo: string, eventType: string, commentId: number): Promise<void> {
  if (!repo || !commentId) return;

  const token = process.env.GH_TOKEN;
  if (!token) {
    log.warn('github-webhook: eyes reaction skipped (GH_TOKEN not set)', { repo });
    return;
  }

  // Endpoint differs by event type — pull_request_review_comment uses
  // /pulls/comments/<id>, every other comment-shaped event uses
  // /issues/comments/<id>.
  const sub = eventType === 'pull_request_review_comment' ? 'pulls' : 'issues';
  const url = `https://api.github.com/repos/${repo}/${sub}/comments/${commentId}/reactions`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: 'eyes' }),
    });
    if (!res.ok && res.status !== 200 && res.status !== 201 && res.status !== 422) {
      // 422 = already reacted (idempotent); anything else is worth a warn.
      log.warn('github-webhook: eyes reaction non-OK', { url, status: res.status });
    }
  } catch (err) {
    log.warn('github-webhook: eyes reaction failed', { url, error: String(err) });
  }
}

export function startGitHubWebhookServer(): GitHubWebhookServerHandle {
  if (!GITHUB_WEBHOOK_SECRET) {
    log.warn('GITHUB_WEBHOOK_SECRET not set — webhook server will reject all requests');
  }

  // Canonical-instance health check: prod is the only entry point for the
  // App webhook, so an empty INSTANCE_FORWARD_TARGETS means peer instances
  // (lego, etc.) will never receive any traffic. Loud warn at startup so
  // a misconfig is visible before someone notices missing 👀 reactions.
  if (INSTANCE_SLUG === 'prod' && Object.keys(INSTANCE_FORWARD_TARGETS).length === 0) {
    log.warn(
      'github-webhook: canonical instance has empty INSTANCE_FORWARD_TARGETS — peer instances will receive no traffic',
    );
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'POST' && req.url === '/internal/register-pr') {
      await handleRegisterPr(req, res, INTERNAL_REGISTER_SECRET);
      return;
    }

    if (req.method !== 'POST' || req.url !== '/webhook/github') {
      writeJson(res, 404, { error: 'not found' });
      return;
    }

    const eventType = req.headers['x-github-event'];
    if (eventType !== 'issue_comment' && eventType !== 'pull_request_review_comment' && eventType !== 'issues') {
      writeJson(res, 200, {
        ok: true,
        skipped: true,
        reason: 'not issue_comment, pull_request_review_comment, or issues',
      });
      return;
    }

    // Read raw body before any parsing — HMAC is over the raw bytes
    const rawBody = await readRawBody(req, res);
    if (rawBody === null) return;

    // Two trust paths:
    //   - GitHub-signed (X-Hub-Signature-256): the normal entry. Body is
    //     unfiltered; we apply the action/mention filters below.
    //   - Peer-signed (X-Webhook-Trust + X-Internal-Signature-256): a
    //     foreign-owned forward from the canonical router. The router
    //     already validated and decided this is for us, so we skip the
    //     filters and go straight to mapping-based delivery.
    const isPeerForward = req.headers[WEBHOOK_TRUST_HEADER] === WEBHOOK_TRUST_VALUE;
    if (isPeerForward) {
      const trustSig = String(req.headers[TRUST_SIGNATURE_HEADER] ?? '');
      if (!INTERNAL_REGISTER_SECRET || !verifyTrustedSignature(INTERNAL_REGISTER_SECRET, rawBody, trustSig)) {
        log.warn('github-webhook: peer-forward with invalid trust signature');
        writeJson(res, 401, { error: 'invalid trust signature' });
        return;
      }
    } else {
      const sigHeader = String(req.headers['x-hub-signature-256'] ?? '');
      if (!GITHUB_WEBHOOK_SECRET || !verifySignature(GITHUB_WEBHOOK_SECRET, rawBody, sigHeader)) {
        log.warn('github-webhook: invalid or missing signature');
        writeJson(res, 401, { error: 'invalid signature' });
        return;
      }
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      writeJson(res, 400, { error: 'invalid json' });
      return;
    }

    const repository = payload.repository as Record<string, unknown> | undefined;
    const repoFullName = typeof repository?.full_name === 'string' ? repository.full_name : '';

    // Issues: action must be 'opened'; no mention check (a fresh issue
    // can't tag the bot — the bot is the audience here, not the actor).
    if (eventType === 'issues') {
      if (payload.action !== 'opened') {
        writeJson(res, 200, { ok: true, skipped: true, reason: 'issues action not opened' });
        return;
      }
      const issue = payload.issue as Record<string, unknown> | undefined;
      const issueNumber = typeof issue?.number === 'number' ? issue.number : 0;
      const title = typeof issue?.title === 'string' ? issue.title : '';
      const body = typeof issue?.body === 'string' ? issue.body : '';
      const author =
        typeof (issue?.user as Record<string, unknown> | undefined)?.login === 'string'
          ? String((issue!.user as Record<string, unknown>).login)
          : '';
      const issueUrl = typeof issue?.html_url === 'string' ? issue.html_url : '';
      const labelsRaw = Array.isArray(issue?.labels) ? (issue!.labels as Record<string, unknown>[]) : [];
      const labels = labelsRaw.map((l) => (typeof l.name === 'string' ? l.name : '')).filter((s) => s.length > 0);

      if (!repoFullName || !issueNumber) {
        log.warn('github-webhook: malformed issues payload', { repo: repoFullName, issueNumber });
        writeJson(res, 400, { error: 'malformed payload' });
        return;
      }

      const outcome = deliverGitHubIssueOpened({
        repo: repoFullName,
        issueNumber,
        issueUrl,
        title,
        body,
        author,
        labels,
        deliveryId: String(req.headers['x-github-delivery'] ?? ''),
      });
      writeJson(res, 200, { ok: true, outcome });
      return;
    }

    // Comment events: action filter + mention check (skipped on peer-forward)
    if (payload.action !== 'created') {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'action not created' });
      return;
    }

    const comment = payload.comment as Record<string, unknown> | undefined;
    const commentBody = typeof comment?.body === 'string' ? comment.body : '';

    if (!isPeerForward && !commentBody.toLowerCase().includes(GITHUB_WEBHOOK_BOT_MENTION.toLowerCase())) {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'bot not mentioned' });
      return;
    }

    const commentId = typeof comment?.id === 'number' ? comment.id : 0;

    let issueNumber: number;
    let isPr: boolean;

    if (eventType === 'pull_request_review_comment') {
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      issueNumber = typeof pr?.number === 'number' ? pr.number : 0;
      isPr = true;
    } else {
      const issue = payload.issue as Record<string, unknown> | undefined;
      issueNumber = typeof issue?.number === 'number' ? issue.number : 0;
      isPr = Boolean(issue?.pull_request);
    }

    if (!repoFullName || !issueNumber || !commentId) {
      log.warn('github-webhook: malformed payload', { repo: repoFullName, issueNumber, commentId });
      writeJson(res, 400, { error: 'malformed payload' });
      return;
    }

    const outcome = deliverGitHubMention({
      repo: repoFullName,
      issueNumber,
      commentId,
      commentUrl: typeof comment?.html_url === 'string' ? comment.html_url : '',
      commenter:
        typeof (comment?.user as Record<string, unknown> | undefined)?.login === 'string'
          ? String((comment!.user as Record<string, unknown>).login)
          : '',
      body: commentBody,
      isPr,
      rawBody,
      eventType: String(eventType),
      deliveryId: String(req.headers['x-github-delivery'] ?? ''),
    });

    // Deterministic 👀 ack: fire whenever the webhook lands somewhere
    // (local session, forwarded to peer, or orchestrator). Skipped on
    // peer-forward inbound — the canonical router already reacted before
    // forwarding, so the peer must not double-react. Skipped on
    // dropped/no-session/no-admin-group outcomes since the user shouldn't
    // get an ack when nothing actually picked up the work.
    //
    // Posted by the host (not the coworker) so the ack is independent of
    // container wake-state. The skill's Step 0 stays as a backup; GitHub
    // returns 422 on duplicate reactions, which the skill swallows.
    //
    // The `issues` event type takes a separate code path above and never
    // reaches here (issues themselves don't accept reactions on the body
    // anyway — only on comments inside them).
    if (!isPeerForward && (outcome === 'local' || outcome === 'forwarded')) {
      void postEyesReaction(repoFullName, String(eventType), commentId);
    }

    writeJson(res, 200, { ok: true, outcome });
  });

  server.listen(GITHUB_WEBHOOK_PORT, '0.0.0.0', () => {
    log.info('GitHub webhook server listening', { port: GITHUB_WEBHOOK_PORT });
  });

  return {
    server,
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
