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
  APPROVER_CI_GATE,
  CI_GATE_REQUIRED_SUITE,
  CI_GATE_REQUIRED_CHECK_RUN,
  GITHUB_WEBHOOK_BOT_MENTION,
  GITHUB_WEBHOOK_PORT,
  GITHUB_WEBHOOK_SECRET,
  INSTANCE_FORWARD_TARGETS,
  INSTANCE_SLUG,
  INTERNAL_REGISTER_SECRET,
  ROUTE_ISSUES_TO,
} from './config.js';
import { getDb } from './db/connection.js';
import { issueSessionExists } from './db/sessions.js';
import { readEnvFile } from './env.js';
import { log } from './log.js';
import {
  TRUST_SIGNATURE_HEADER,
  WEBHOOK_TRUST_HEADER,
  WEBHOOK_TRUST_VALUE,
  verifyTrustedSignature,
} from './modules/pr-mapping/register-client.js';
import { handleRegisterPr } from './modules/pr-mapping/register-endpoint.js';
import { requiredCheckRunGreen } from './modules/pending-reviewable/ci-check.js';
import { deleteParked, findParkedByHead } from './modules/pending-reviewable/store.js';
import { prMappingExists } from './modules/pr-mapping/store.js';
import {
  deliverGitHubIssueOpened,
  deliverGitHubMention,
  deliverGitHubPrEvent,
  deliverGitHubPrReviewable,
  releaseParkedReviewable,
} from './webhook-github.js';

const MAX_BODY_SIZE = 512 * 1024; // 512 KB

/**
 * GitHub event types this server processes. The App is subscribed to these
 * (Settings → Permissions & events → Subscribe to events). check_suite stays
 * here so the handler is live the moment the event is subscribed + the Checks
 * permission is re-approved per org — until then GitHub simply never delivers
 * it, and an accepted-but-undelivered event is harmless.
 */
const ACCEPTED_EVENTS = new Set<string>([
  'issue_comment',
  'pull_request_review_comment',
  'issues',
  'pull_request',
  'pull_request_review',
  'pull_request_review_thread',
  'check_suite',
]);

/**
 * Our bot's GitHub logins — events it authored are echoes, not feedback to act
 * on. The bot comments under TWO identities: the GitHub App (`nv-slang-bot[bot]`,
 * the common case via the installation token) and the user PAT (`nv-slang-bot`,
 * no `[bot]` suffix — used for cross-fork PRs into contributor branches). Both
 * must be recognized as self, or the host self-reacts (👀) on a comment the bot
 * posted under the user identity.
 */
const BOT_LOGINS = new Set(['nv-slang-bot[bot]', 'nv-slang-bot']);

function isBotLogin(login: string): boolean {
  return BOT_LOGINS.has(login);
}

function loginOf(obj: unknown): string {
  const user = (obj as Record<string, unknown> | undefined)?.user as Record<string, unknown> | undefined;
  return typeof user?.login === 'string' ? user.login : '';
}

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
 * Auth: GH_TOKEN is a GitHub App installation token (~1h TTL) rotated
 * hourly by cron into the `.env` file. systemd reads EnvironmentFile only
 * at process start, so `process.env.GH_TOKEN` is frozen at boot and goes
 * stale within the hour — every reaction then 401s silently. We therefore
 * re-read GH_TOKEN from `.env` at CALL time (falling back to process.env),
 * consuming the refresh the cron already writes. Without it, skip with a
 * warn so a misconfigured install doesn't flood logs with 401s.
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

  // Re-read at call time: the cron-rotated .env holds the current token,
  // while process.env.GH_TOKEN is frozen at process start (see doc above).
  const token = readEnvFile(['GH_TOKEN']).GH_TOKEN || process.env.GH_TOKEN;
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
    if (typeof eventType !== 'string' || !ACCEPTED_EVENTS.has(eventType)) {
      writeJson(res, 200, {
        ok: true,
        skipped: true,
        reason: 'unhandled event type',
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

      const outcome = await deliverGitHubIssueOpened({
        repo: repoFullName,
        issueNumber,
        issueUrl,
        title,
        body,
        author,
        labels,
        rawBody,
        eventType: String(eventType),
        deliveryId: String(req.headers['x-github-delivery'] ?? ''),
      });
      writeJson(res, 200, { ok: true, outcome });
      return;
    }

    // PR closed / merged — the terminal signal for a PR-bearing fix chain.
    // Routes to the owning fixer session via pr_session_mappings so it can run
    // its cleanup step (worktree remove). Only `closed` matters — other actions
    // (opened/synchronize/edited) carry no cleanup signal.
    if (eventType === 'pull_request') {
      // A PR becoming "reviewable" — route to the orchestrator (which mints a
      // per-PR session and forwards to the reviewer coworker via the
      // slang-github-webhook skill), or forward to a peer when
      // ROUTE_READY_PRS_TO is set. Three actions qualify, all handled before
      // the non-closed skip below:
      //   • ready_for_review       — draft → ready
      //   • opened      && !draft  — opened directly non-draft
      //   • synchronize && !draft  — new commits pushed to a ready PR
      // No sender filter: all sources (human or bot) are treated the same.
      const reviewablePr = payload.pull_request as Record<string, unknown> | undefined;
      const isDraft = reviewablePr?.draft === true;
      const isReviewable =
        payload.action === 'ready_for_review' ||
        (payload.action === 'opened' && !isDraft) ||
        (payload.action === 'synchronize' && !isDraft);
      if (isReviewable) {
        const reviewablePrNumber = typeof reviewablePr?.number === 'number' ? reviewablePr.number : 0;
        if (!repoFullName || !reviewablePrNumber) {
          log.warn('github-webhook: malformed reviewable pull_request payload', {
            repo: repoFullName,
            prNumber: reviewablePrNumber,
            action: String(payload.action),
          });
          writeJson(res, 400, { error: 'malformed payload' });
          return;
        }
        const reviewableHead = (reviewablePr?.head as Record<string, unknown> | undefined) ?? {};
        const outcome = await deliverGitHubPrReviewable({
          repo: repoFullName,
          prNumber: reviewablePrNumber,
          prUrl: typeof reviewablePr?.html_url === 'string' ? reviewablePr.html_url : '',
          title: typeof reviewablePr?.title === 'string' ? reviewablePr.title : '',
          author: loginOf(reviewablePr),
          reason: String(payload.action),
          rawBody,
          eventType: String(eventType),
          deliveryId: String(req.headers['x-github-delivery'] ?? ''),
          headSha: typeof reviewableHead.sha === 'string' ? reviewableHead.sha : '',
        });
        writeJson(res, 200, { ok: true, outcome });
        return;
      }
      if (payload.action !== 'closed') {
        writeJson(res, 200, { ok: true, skipped: true, reason: `pull_request action ${String(payload.action)}` });
        return;
      }
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      const prNumber = typeof pr?.number === 'number' ? pr.number : 0;
      const merged = pr?.merged === true;
      const mergedBy =
        typeof (pr?.merged_by as Record<string, unknown> | undefined)?.login === 'string'
          ? String((pr!.merged_by as Record<string, unknown>).login)
          : '';
      if (!repoFullName || !prNumber) {
        log.warn('github-webhook: malformed pull_request payload', { repo: repoFullName, prNumber });
        writeJson(res, 400, { error: 'malformed payload' });
        return;
      }
      const outcome = await deliverGitHubPrEvent({
        repo: repoFullName,
        prNumber,
        event: merged ? 'github.pr_merged' : 'github.pr_closed',
        rowId: `gh-pr-${merged ? 'merged' : 'closed'}-${prNumber}`,
        payload: {
          state: merged ? 'merged' : 'closed',
          merged,
          pr_url: typeof pr?.html_url === 'string' ? pr.html_url : '',
          merged_by: mergedBy,
          // The head the PR actually ended on. Carried so the deterministic
          // verdict join can tell "we judged the final commit" (exact) from "the
          // PR moved past every head we judged" (head_advanced) — which is the
          // whole point of join_mode. Without it every join looks exact.
          head_sha:
            typeof (pr?.head as Record<string, unknown> | undefined)?.sha === 'string'
              ? String((pr!.head as Record<string, unknown>).sha)
              : '',
        },
        rawBody,
        eventType: String(eventType),
        deliveryId: String(req.headers['x-github-delivery'] ?? ''),
      });
      writeJson(res, 200, { ok: true, outcome });
      return;
    }

    // PR review verdict (Approve / Request changes / Comment + summary body).
    // Routed to the owning fixer session via pr_session_mappings. We skip the
    // bare "commented" review that wraps inline comments (each already routed
    // as its own pull_request_review_comment) — delivering it too would wake
    // the fixer an extra time per review with no new signal. A review is worth
    // delivering when it carries a verdict (approved/changes_requested) or a
    // non-empty summary body.
    if (eventType === 'pull_request_review') {
      if (payload.action !== 'submitted') {
        writeJson(res, 200, { ok: true, skipped: true, reason: 'review action not submitted' });
        return;
      }
      const review = payload.review as Record<string, unknown> | undefined;
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      const prNumber = typeof pr?.number === 'number' ? pr.number : 0;
      const state = typeof review?.state === 'string' ? review.state.toLowerCase() : '';
      const reviewBody = typeof review?.body === 'string' ? review.body : '';
      const reviewId = typeof review?.id === 'number' ? review.id : 0;
      const reviewer = loginOf(review);

      if (isBotLogin(reviewer)) {
        writeJson(res, 200, { ok: true, skipped: true, reason: 'own-bot review' });
        return;
      }
      if (state === 'commented' && !reviewBody.trim()) {
        // Pure inline-comment wrapper — the comments routed individually.
        writeJson(res, 200, { ok: true, skipped: true, reason: 'empty commented review (inline-only)' });
        return;
      }
      if (!repoFullName || !prNumber || !reviewId) {
        log.warn('github-webhook: malformed pull_request_review payload', { repo: repoFullName, prNumber });
        writeJson(res, 400, { error: 'malformed payload' });
        return;
      }
      const outcome = await deliverGitHubPrEvent({
        repo: repoFullName,
        prNumber,
        event: 'github.pr_review',
        rowId: `gh-review-${reviewId}`,
        payload: {
          review_state: state,
          body: reviewBody,
          reviewer,
          review_url: typeof review?.html_url === 'string' ? review.html_url : '',
        },
        // A review whose body @-mentions the bot is first contact even on a PR
        // with no mapping yet — let deliverGitHubPrEvent fall back to the
        // orchestrator instead of dropping.
        mentionsBot: reviewBody.toLowerCase().includes(GITHUB_WEBHOOK_BOT_MENTION.toLowerCase()),
        rawBody,
        eventType: String(eventType),
        deliveryId: String(req.headers['x-github-delivery'] ?? ''),
      });
      writeJson(res, 200, { ok: true, outcome });
      return;
    }

    // PR review thread resolved / unresolved — a deliberate reviewer action
    // ("I accept this fix" / "re-opening this"). Routed to the owning fixer.
    if (eventType === 'pull_request_review_thread') {
      if (payload.action !== 'resolved' && payload.action !== 'unresolved') {
        writeJson(res, 200, { ok: true, skipped: true, reason: 'review_thread action not resolved/unresolved' });
        return;
      }
      const thread = payload.thread as Record<string, unknown> | undefined;
      const pr = payload.pull_request as Record<string, unknown> | undefined;
      const prNumber = typeof pr?.number === 'number' ? pr.number : 0;
      const sender =
        typeof (payload.sender as Record<string, unknown> | undefined)?.login === 'string'
          ? String((payload.sender as Record<string, unknown>).login)
          : '';
      // Identify the thread by its first comment id (threads have no stable id
      // in the payload; the first comment is stable for idempotency).
      const comments = Array.isArray(thread?.comments) ? (thread!.comments as Record<string, unknown>[]) : [];
      const firstCommentId = typeof comments[0]?.id === 'number' ? (comments[0].id as number) : 0;
      const path = typeof comments[0]?.path === 'string' ? (comments[0].path as string) : '';

      if (isBotLogin(sender)) {
        writeJson(res, 200, { ok: true, skipped: true, reason: 'own-bot review thread' });
        return;
      }
      if (!repoFullName || !prNumber || !firstCommentId) {
        log.warn('github-webhook: malformed pull_request_review_thread payload', { repo: repoFullName, prNumber });
        writeJson(res, 400, { error: 'malformed payload' });
        return;
      }
      const outcome = await deliverGitHubPrEvent({
        repo: repoFullName,
        prNumber,
        event: 'github.pr_review_thread',
        rowId: `gh-revthread-${firstCommentId}-${String(payload.action)}`,
        payload: {
          thread_action: String(payload.action),
          path,
          sender,
        },
        rawBody,
        eventType: String(eventType),
        deliveryId: String(req.headers['x-github-delivery'] ?? ''),
      });
      writeJson(res, 200, { ok: true, outcome });
      return;
    }

    // check_suite — CI run completed. Two live paths (the App IS subscribed and
    // the Checks permission IS granted in prod — the failure path below has been
    // delivering for a while):
    //   • failure / timed_out → route `github.ci_failed` to the owning fixer.
    //   • success (+ APPROVER_CI_GATE) → RELEASE a reviewable PR parked pending
    //     CI, if this suite is the required build suite for the parked head.
    if (eventType === 'check_suite') {
      if (payload.action !== 'completed') {
        writeJson(res, 200, { ok: true, skipped: true, reason: 'check_suite action not completed' });
        return;
      }
      const suite = payload.check_suite as Record<string, unknown> | undefined;
      const conclusion = typeof suite?.conclusion === 'string' ? suite.conclusion.toLowerCase() : '';
      const headSha = typeof suite?.head_sha === 'string' ? suite.head_sha : '';

      // --- CI-green release: the approver CI gate's release trigger ----------
      if (conclusion === 'success' && APPROVER_CI_GATE && repoFullName && headSha) {
        // Guard the documented false-safe: a trivial suite (CLA/lint/CodeRabbit)
        // can go green while the real build never dispatched. Only the required
        // build suite releases. Match on the suite's App slug or name substring;
        // when CI_GATE_REQUIRED_SUITE is unset, any success releases (loosest).
        const app = (suite?.app as Record<string, unknown> | undefined) ?? {};
        const appSlug = String(app.slug ?? '').toLowerCase();
        const appName = String(app.name ?? '').toLowerCase();
        const req_ = CI_GATE_REQUIRED_SUITE;
        const suiteMatches = !req_ || appSlug === req_ || appName.includes(req_);
        if (!suiteMatches) {
          writeJson(res, 200, {
            ok: true,
            skipped: true,
            reason: `check_suite success but not required suite (${appSlug || appName || 'unknown'})`,
          });
          return;
        }
        const parked = await findParkedByHead(getDb(), repoFullName, headSha);
        if (!parked) {
          writeJson(res, 200, { ok: true, skipped: true, reason: 'check_suite success but no PR parked at this head' });
          return;
        }
        // Precise gate: if this repo has a required check-RUN configured, the
        // suite going green isn't enough — query gh for that specific run (e.g.
        // slang's `check-ci` build roll-up) and only release if it's green. Any
        // github-actions suite finishing fires this handler; we keep the parked
        // row and wait for the one where the named run is actually done. Repos
        // not in the map fall through on the suite-slug gate above.
        const requiredRun = CI_GATE_REQUIRED_CHECK_RUN[repoFullName];
        if (requiredRun) {
          const green = await requiredCheckRunGreen(repoFullName, headSha, requiredRun);
          if (!green) {
            writeJson(res, 200, {
              ok: true,
              skipped: true,
              reason: `check_suite success but required check-run ${requiredRun} not green yet`,
            });
            return;
          }
        }
        const outcome = await releaseParkedReviewable(parked.rawEventJson);
        await deleteParked(getDb(), repoFullName, parked.prNumber);
        writeJson(res, 200, { ok: true, outcome, released: { pr: parked.prNumber, head: headSha } });
        return;
      }

      if (conclusion !== 'failure' && conclusion !== 'timed_out') {
        writeJson(res, 200, { ok: true, skipped: true, reason: `check_suite conclusion ${conclusion || 'none'}` });
        return;
      }
      const suiteId = typeof suite?.id === 'number' ? suite.id : 0;
      const prs = Array.isArray(suite?.pull_requests) ? (suite!.pull_requests as Record<string, unknown>[]) : [];
      const prNumber = prs.length && typeof prs[0]?.number === 'number' ? (prs[0].number as number) : 0;
      if (!repoFullName || !prNumber || !suiteId) {
        // A check_suite with no associated PR (push to a branch with no PR) —
        // nothing to route. Not malformed, just not for us.
        writeJson(res, 200, { ok: true, skipped: true, reason: 'check_suite has no associated PR' });
        return;
      }
      const outcome = await deliverGitHubPrEvent({
        repo: repoFullName,
        prNumber,
        event: 'github.ci_failed',
        rowId: `gh-checks-${suiteId}`,
        payload: {
          conclusion,
          head_sha: headSha,
          check_suite_url: typeof suite?.url === 'string' ? suite.url : '',
        },
        rawBody,
        eventType: String(eventType),
        deliveryId: String(req.headers['x-github-delivery'] ?? ''),
      });
      writeJson(res, 200, { ok: true, outcome });
      return;
    }

    // Comment events: action filter, then mention check.
    if (payload.action !== 'created') {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'action not created' });
      return;
    }

    const comment = payload.comment as Record<string, unknown> | undefined;
    const commentBody = typeof comment?.body === 'string' ? comment.body : '';
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

    // Own-bot guard: drop our own comment events outright (mirrors the
    // isBotLogin returns on the pull_request_review / _review_thread paths
    // above). The bot's own comments are never work for the bot — without
    // this, a comment we post on a dev-routed issue (willDevRouteToPeer) or
    // on a PR we own (isOwnedPr) passes the mention gate below, gets
    // forwarded/processed, and the host self-reacts with 👀 on our own
    // comment. Matches BOTH bot identities (App + user PAT). Skip the whole
    // path: no forward, no session wake, no react.
    if (isBotLogin(loginOf(comment))) {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'own-bot comment' });
      return;
    }

    // Does this comment address the bot directly? Computed once and reused
    // by both the mention gate and the 👀-reaction decision below.
    const mentionsBot = commentBody.toLowerCase().includes(GITHUB_WEBHOOK_BOT_MENTION.toLowerCase());

    // Mention gate, with three ownership-based exemptions. The default is to
    // drop a comment that doesn't @-mention the bot (otherwise we'd react to
    // every human comment on every public issue/PR — noise). But when we have
    // an explicit ownership signal, the bot IS the audience and a reply must
    // be processed even without an @-mention:
    //
    //   (a) willDevRouteToPeer — a follow-up comment on a plain ISSUE (not a
    //       PR) whose OPEN we dev-route to a peer. The peer drives the chain
    //       and needs every human reply. Mirrors the !isPr + ROUTE_ISSUES_TO
    //       branch in deliverGitHubMention; without this the comment is dropped
    //       here and never reaches that forward.
    //   (b) isOwnedPr — a comment on a PR that exists in pr_session_mappings
    //       (any owner). The mapping is the "this PR is ours" signal; a review
    //       reply on our bot's own PR is for us. deliverGitHubMention already
    //       routes it correctly (local-owner → mapped session; foreign-owner →
    //       forward) — the gate just must not drop it first.
    //   (c) isParticipantIssue — a follow-up comment on a plain ISSUE we are
    //       already driving (an active session keyed on the canonical
    //       `gh-issue-<repo>-<num>` thread exists). This is the issue-side
    //       mirror of isOwnedPr: a reply to our own triage comment is for us
    //       even without an @-mention. Without it, an author answering a
    //       maintainer-decision question we posted is silently dropped and the
    //       chain stalls forever waiting on a webhook that was filtered.
    //       deliverGitHubMention already rejoins the existing chain (same
    //       `gh-issue-` thread + mintPerThread), so the gate just must not drop
    //       it first. Only consulted when (a) doesn't already forward the issue.
    //
    // A comment on an un-mapped public PR or an issue we've never touched stays
    // gated — no ownership signal, no noise.
    const willDevRouteToPeer =
      !isPr && Boolean(ROUTE_ISSUES_TO) && Boolean(INSTANCE_SLUG) && ROUTE_ISSUES_TO !== INSTANCE_SLUG;

    let isOwnedPr = false;
    if (isPr && repoFullName && issueNumber) {
      try {
        isOwnedPr = await prMappingExists(getDb(), repoFullName, issueNumber);
      } catch {
        /* DB unavailable — fall back to mention-gated (safe default) */
      }
    }

    let isParticipantIssue = false;
    if (!isPr && !willDevRouteToPeer && repoFullName && issueNumber) {
      isParticipantIssue = await issueSessionExists(repoFullName, issueNumber);
    }

    if (!isPeerForward && !willDevRouteToPeer && !isOwnedPr && !isParticipantIssue && !mentionsBot) {
      writeJson(res, 200, { ok: true, skipped: true, reason: 'bot not mentioned' });
      return;
    }

    if (!repoFullName || !issueNumber || !commentId) {
      log.warn('github-webhook: malformed payload', { repo: repoFullName, issueNumber, commentId });
      writeJson(res, 400, { error: 'malformed payload' });
      return;
    }

    const outcome = await deliverGitHubMention({
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

    // 👀 ack — only on comments the bot is actually going to work on, i.e.
    // ones addressed to us: an @-mention, or a reply on a PR we own. We may
    // ALSO forward a dev-routed issue's follow-up comments (willDevRouteToPeer)
    // for chain context even when they don't mention us — those get processed
    // but earn no 👀, since the human wasn't talking to the bot. The own-bot
    // guard above already removed our own comments from this path entirely.
    //
    // Still skipped on peer-forward inbound (the canonical router reacted
    // before forwarding, so the peer must not double-react) and on
    // dropped/no-session outcomes (nothing picked up the work).
    //
    // Posted by the host (not the coworker) so the ack is independent of
    // container wake-state. The skill's Step 0 stays as a backup; GitHub
    // returns 422 on duplicate reactions, which the skill swallows.
    //
    // The `issues` event type takes a separate code path above and never
    // reaches here (issues themselves don't accept reactions on the body
    // anyway — only on comments inside them).
    const addressedToBot = mentionsBot || isOwnedPr || isParticipantIssue;
    if (!isPeerForward && addressedToBot && (outcome === 'local' || outcome === 'forwarded')) {
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
