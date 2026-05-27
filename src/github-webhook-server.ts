/**
 * GitHub webhook receiver — dedicated HTTP server on GITHUB_WEBHOOK_PORT.
 *
 * Separate from dashboard-ingress (127.0.0.1 only) so this port can be
 * exposed publicly via brev without exposing the dashboard chat endpoint.
 * Security: HMAC-SHA256 (X-Hub-Signature-256) validation before any processing.
 */
import crypto from 'crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';

import { GITHUB_WEBHOOK_BOT_MENTION, GITHUB_WEBHOOK_PORT, GITHUB_WEBHOOK_SECRET } from './config.js';
import { log } from './log.js';
import { deliverGitHubMention } from './webhook-github.js';

const MAX_BODY_SIZE = 512 * 1024; // 512 KB
const FANOUT_HEADER = 'x-webhook-fanout';

export interface GitHubWebhookServerHandle {
  server: Server;
  stop(): Promise<void>;
}

/**
 * Forward an authenticated webhook delivery to peer instances. Set via env var
 * WEBHOOK_FANOUT_URLS as a comma-separated list of `URL|SECRET` pairs (the
 * peer's GITHUB_WEBHOOK_SECRET, used to re-sign the body so the receiver's
 * existing HMAC check passes). If `|SECRET` is omitted, falls back to this
 * instance's GITHUB_WEBHOOK_SECRET (only useful when peers share a secret).
 *
 * Used to share App-webhook deliveries across instances when only one URL is
 * registered with the App but multiple instances need to react. Fire-and-
 * forget: failures are logged but never block the response to GitHub.
 */
function fanOutWebhook(rawBody: string, headers: { event: string; delivery: string }): void {
  const list = (process.env.WEBHOOK_FANOUT_URLS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (list.length === 0) return;

  for (const entry of list) {
    const [url, peerSecret] = entry.split('|', 2);
    const secret = peerSecret || GITHUB_WEBHOOK_SECRET;
    if (!url || !secret) {
      log.warn('github-webhook: fan-out entry missing url or secret', { entry: url });
      continue;
    }
    const peerSig = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': headers.event,
        'X-GitHub-Delivery': headers.delivery,
        'X-Hub-Signature-256': peerSig,
        [FANOUT_HEADER]: '1',
      },
      body: rawBody,
    })
      .then((r) => {
        if (!r.ok) {
          log.warn('github-webhook: fan-out non-OK', { url, status: r.status });
        }
      })
      .catch((err: unknown) => {
        log.warn('github-webhook: fan-out failed', { url, error: String(err) });
      });
  }
}

/**
 * Post a 👀 reaction on the triggering comment so the human sees their
 * @mention was received. Opt-in via env var `GITHUB_WEBHOOK_REACT_ON_RECEIPT=1`,
 * defaults off.
 *
 * Auth: the host process calls api.github.com directly (not through OneCLI —
 * that proxy only fires for outbound traffic from agent containers). It uses
 * `GH_TOKEN` from the environment, which the existing refresh cron writes
 * every 30 min from a GitHub App installation token. Without that token we
 * skip with a warn so a missing-credential install doesn't flood logs with
 * 401s.
 *
 * Fire-and-forget — never blocks the 200 OK to GitHub. Failures (network,
 * non-OK, already-reacted 422) are warn-logged and swallowed.
 */
export async function postEyesReaction(repo: string, eventType: string, commentId: number): Promise<void> {
  if (process.env.GITHUB_WEBHOOK_REACT_ON_RECEIPT !== '1') return;
  if (!repo || !commentId) return;

  const token = process.env.GH_TOKEN;
  if (!token) {
    log.warn('github-webhook: eyes reaction skipped (GH_TOKEN not set)', { repo });
    return;
  }

  // Endpoint differs by event type — pull_request_review_comment uses /pulls/comments,
  // every other comment-shaped event uses /issues/comments.
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
    if (!res.ok && res.status !== 200 && res.status !== 201) {
      log.warn('github-webhook: eyes reaction non-OK', { url, status: res.status });
    }
  } catch (err) {
    log.warn('github-webhook: eyes reaction failed', { url, error: String(err) });
  }
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

export function startGitHubWebhookServer(): GitHubWebhookServerHandle {
  if (!GITHUB_WEBHOOK_SECRET) {
    log.warn('GITHUB_WEBHOOK_SECRET not set — webhook server will reject all requests');
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST' || req.url !== '/webhook/github') {
      writeJson(res, 404, { error: 'not found' });
      return;
    }

    const eventType = req.headers['x-github-event'];
    if (eventType !== 'issue_comment' && eventType !== 'pull_request_review_comment') {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'not issue_comment or pull_request_review_comment' });
      return;
    }

    // Read raw body before any parsing — HMAC is over the raw bytes
    const rawBody = await readRawBody(req, res);
    if (rawBody === null) return;

    // Validate HMAC before touching the payload
    const sigHeader = String(req.headers['x-hub-signature-256'] ?? '');
    if (!GITHUB_WEBHOOK_SECRET || !verifySignature(GITHUB_WEBHOOK_SECRET, rawBody, sigHeader)) {
      log.warn('github-webhook: invalid or missing signature');
      writeJson(res, 401, { error: 'invalid signature' });
      return;
    }

    // Fan-out to peer instances. Skip if this request is itself a fan-out
    // delivery (avoids loops when peers reciprocate by mistake).
    if (req.headers[FANOUT_HEADER] !== '1') {
      fanOutWebhook(rawBody, {
        event: String(eventType),
        delivery: String(req.headers['x-github-delivery'] ?? ''),
      });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      writeJson(res, 400, { error: 'invalid json' });
      return;
    }

    if (payload.action !== 'created') {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'action not created' });
      return;
    }

    const comment = payload.comment as Record<string, unknown> | undefined;
    const repository = payload.repository as Record<string, unknown> | undefined;
    const commentBody = typeof comment?.body === 'string' ? comment.body : '';

    if (!commentBody.toLowerCase().includes(GITHUB_WEBHOOK_BOT_MENTION.toLowerCase())) {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'bot not mentioned' });
      return;
    }

    const repo = typeof repository?.full_name === 'string' ? repository.full_name : '';
    const commentId = typeof comment?.id === 'number' ? comment.id : 0;

    let issueNumber: number;
    let isPr: boolean;
    let prBranch: string | null;

    if (eventType === 'pull_request_review_comment') {
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      issueNumber = typeof pr?.number === 'number' ? pr.number : 0;
      isPr = true;
      prBranch =
        typeof (pr?.head as Record<string, unknown> | undefined)?.ref === 'string'
          ? String((pr!.head as Record<string, unknown>).ref)
          : null;
    } else {
      const issue = payload.issue as Record<string, unknown> | undefined;
      issueNumber = typeof issue?.number === 'number' ? issue.number : 0;
      isPr = Boolean(issue?.pull_request);
      // issue_comment events don't include the branch; orchestrator resolves via gh api
      prBranch = null;
    }

    if (!repo || !issueNumber || !commentId) {
      log.warn('github-webhook: malformed payload', { repo, issueNumber, commentId });
      writeJson(res, 400, { error: 'malformed payload' });
      return;
    }

    deliverGitHubMention({
      repo,
      issueNumber,
      commentId,
      commentUrl: typeof comment?.html_url === 'string' ? comment.html_url : '',
      commenter:
        typeof (comment?.user as Record<string, unknown> | undefined)?.login === 'string'
          ? String((comment!.user as Record<string, unknown>).login)
          : '',
      body: commentBody,
      isPr,
      prBranch,
    });

    // 👀 acknowledgement — once the mention has been queued for delivery,
    // post an "eyes" reaction on the triggering comment so the human can see
    // their @mention was received and is being worked on. Fire-and-forget;
    // failures must never block the 200 OK we owe GitHub.
    void postEyesReaction(repo, eventType as string, commentId);

    writeJson(res, 200, { ok: true });
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
