/**
 * GitHub webhook event types and delivery to agent sessions.
 *
 * Routing for PR-comment events (issue_comment, pull_request_review_comment):
 *   1. PR mapping hit + owner is *this* instance → write to local session.
 *   2. PR mapping hit + owner is a foreign instance → forward to peer
 *      via INSTANCE_FORWARD_TARGETS (signed with INTERNAL_REGISTER_SECRET,
 *      X-Webhook-Trust=pre-validated). Receiver skips its filters and
 *      delivers locally.
 *   3. No mapping → route to admin (orchestrator) agent group on this
 *      instance. The orchestrator inspects the event and dispatches to
 *      the right coworker via its own ncl-aware logic — no static rules.
 *
 * Routing for issues events (action=opened):
 *   - Always to admin (orchestrator). Issues have no PR number → no mapping
 *     possible, no forward decision to make. The orchestrator decides which
 *     coworker triages.
 *
 * Disjoint-ownership invariant: every instance reaches a non-mapped event
 * via either GitHub directly (this is the canonical router) or a peer
 * forward (the canonical router resolved the mapping for us). We rely on
 * the canonical router being the single source of truth for owner_instance,
 * so a non-canonical instance that receives a GitHub-signed unmapped event
 * is misconfigured upstream — but routing it to its own orchestrator is
 * still the right local action; the operator will see whichever instance
 * picked it up and fix the topology.
 *
 * The host has no GitHub API token, so branch resolution and triage are
 * deferred to the receiving agent (orchestrator), which has GH_TOKEN
 * injected via OneCLI.
 */
import {
  INSTANCE_FORWARD_TARGETS,
  INSTANCE_SLUG,
  INTERNAL_REGISTER_SECRET,
  ROUTE_ISSUES_TO,
  ROUTE_READY_PRS_TO,
} from './config.js';
import { getAdminAgentGroup, getAgentGroupByFolder } from './db/agent-groups.js';
import { getDb } from './db/connection.js';
import { openInboundDb, insertMessage } from './db/session-db.js';
import {
  createSession,
  findSessionByAgentGroup,
  findSessionByAgentThread,
  getSession,
  updateSessionTitle,
} from './db/sessions.js';
import { log } from './log.js';
import { forwardWebhookToPeer } from './modules/pr-mapping/forward.js';
import { prMappingExists } from './modules/pr-mapping/store.js';
import { inboundDbPath, initSessionFolder } from './session-manager.js';
import type { AgentGroup, Session } from './types.js';

export interface GitHubMentionEvent {
  repo: string;
  issueNumber: number;
  commentId: number;
  commentUrl: string;
  commenter: string;
  body: string;
  isPr: boolean;
  /** Raw webhook body, preserved for forwarding to a peer instance when owner_instance is foreign. */
  rawBody?: string;
  /** GitHub event type header, propagated to peer on forward. */
  eventType?: string;
  /** GitHub delivery id, propagated to peer on forward (idempotency tag). */
  deliveryId?: string;
}

/**
 * A non-comment PR activity event (review verdict, resolved review thread,
 * failed CI run) destined for the fixer session that owns the PR. Unlike
 * GitHubMentionEvent there is no orchestrator fallback — these events only
 * make sense on a PR we own, so an unmapped PR is silently dropped.
 */
export interface GitHubPrEvent {
  repo: string;
  prNumber: number;
  /** Logical event name written into the payload: github.pr_review | github.pr_review_thread | github.ci_failed */
  event: string;
  /** Stable idempotency id for the messages_in row, e.g. gh-review-<id>. */
  rowId: string;
  /** Event-specific fields merged into the delivered JSON payload (verdict, body, urls, conclusion, etc.). */
  payload: Record<string, unknown>;
  /** Raw webhook body, preserved for forwarding when the PR is foreign-owned. */
  rawBody?: string;
  /** GitHub event type header, propagated to peer on forward. */
  eventType?: string;
  /** GitHub delivery id (idempotency tag). */
  deliveryId?: string;
  /**
   * True when this event itself addresses the bot (e.g. a review whose body
   * @-mentions it). On an unmapped PR this is first contact — treat it like a
   * mention and fall back to the orchestrator instead of dropping. Events with
   * no addressable text (check_suite, review_thread) leave this false and rely
   * solely on the mapping row.
   */
  mentionsBot?: boolean;
}

export interface GitHubIssueOpenedEvent {
  repo: string;
  issueNumber: number;
  issueUrl: string;
  title: string;
  body: string;
  author: string;
  labels: string[];
  /** Raw webhook body, preserved for forwarding to a peer when ROUTE_ISSUES_TO is set. */
  rawBody?: string;
  /** GitHub event type header, propagated to peer on forward. */
  eventType?: string;
  /** GitHub delivery id (idempotency tag). */
  deliveryId?: string;
}

/**
 * A PR `ready_for_review` (draft→ready) event. Prod forwards these to a peer
 * (ROUTE_READY_PRS_TO); the consumer instance delivers them to its
 * `slang-pr-approver` coworker for review.
 */
export interface GitHubPrReadyForReviewEvent {
  repo: string;
  prNumber: number;
  prUrl: string;
  title: string;
  author: string;
  /** Raw webhook body, preserved for forwarding when ROUTE_READY_PRS_TO is set. */
  rawBody?: string;
  /** GitHub event type header, propagated to peer on forward. */
  eventType?: string;
  /** GitHub delivery id — propagated on forward AND used in the rowId so each
   * draft→ready flip re-fires while same-delivery retries dedup. */
  deliveryId?: string;
}

/**
 * Outcome of a webhook delivery decision. Used by the funnel-entry handler
 * for the JSON response shape and ops log filtering.
 */
export type DeliveryOutcome = 'local' | 'forwarded' | 'dropped' | 'no-session' | 'no-admin-group' | 'no-consumer-group';

/**
 * Internal helper: write an event payload to the admin (orchestrator) agent
 * group. Used as the unmapped-fallback for PR comments and the always-target
 * for issues.
 *
 * Session selection:
 *   - If `mintPerThread` is true and `threadId` is set, mint-or-find a session
 *     keyed on (agent_group_id, thread_id). Each issue becomes its own
 *     orchestrator session so the dashboard renders one tile per issue
 *     instead of collapsing every webhook into the most-recent active
 *     session (which becomes a junk drawer over time).
 *   - Otherwise, fall back to "most recently created active session" — used
 *     by the unmapped-PR-comment path where there's no stable per-event key
 *     worth minting a session for.
 *
 * `displayTitle`, when supplied with a fresh-mint, is stamped onto the new
 * session so the dashboard timeline label reads "<repo> #<num>: <title>"
 * rather than inheriting the first inbound message's text.
 */
function deliverToOrchestrator(args: {
  repo: string;
  issueNumber: number;
  rowId: string;
  threadId: string;
  eventContent: string;
  mintPerThread?: boolean;
  displayTitle?: string;
}): DeliveryOutcome {
  const group: AgentGroup | undefined = getAdminAgentGroup();
  if (!group) {
    log.warn('github-webhook: no admin agent group configured — cannot deliver to orchestrator', {
      repo: args.repo,
    });
    return 'no-admin-group';
  }
  return deliverToAgentGroup(group, args);
}

/**
 * Write an event payload into a specific agent group's inbound.db. Shared by
 * deliverToOrchestrator (admin group) and deliverGitHubPrReadyForReview (the
 * named slang-pr-approver group). Session selection and the idempotency guard
 * are identical to the orchestrator path — see deliverToOrchestrator's doc
 * comment for the mint-per-thread / display-title rationale.
 */
function deliverToAgentGroup(
  group: AgentGroup,
  args: {
    repo: string;
    issueNumber: number;
    rowId: string;
    threadId: string;
    eventContent: string;
    mintPerThread?: boolean;
    displayTitle?: string;
  },
): DeliveryOutcome {
  let session: Session | undefined;
  let minted = false;
  if (args.mintPerThread && args.threadId) {
    session = findSessionByAgentThread(group.id, args.threadId);
    if (!session) {
      session = mintOrchestratorSession(group.id, args.threadId);
      minted = true;
    }
  } else {
    session = findSessionByAgentGroup(group.id);
  }

  if (!session) {
    log.warn('github-webhook: agent group has no active session — dropping', {
      group: group.name,
      repo: args.repo,
      issue: args.issueNumber,
    });
    return 'no-session';
  }

  // Stamp a display title for fresh sessions so the dashboard timeline reads
  // "<repo> #<num>: <title>" instead of inheriting the first inbound's first
  // 80 chars.
  if (minted && args.displayTitle) {
    updateSessionTitle(session.id, args.displayTitle, 'auto');
  }

  const dbPath = inboundDbPath(group.id, session.id);
  const db = openInboundDb(dbPath);
  try {
    // Idempotency guard: GitHub retries deliveries on 5xx and the peer-forwarder
    // retries on transport blips, so we will see duplicate deliveries with the
    // same id. Skip the insert when the row already exists — without this, the
    // PRIMARY KEY collision throws and breaks the response stream, leaving the
    // sender to time out and retry (amplifying the storm).
    const existing = db.prepare('SELECT 1 FROM messages_in WHERE id = ?').get(args.rowId) as { 1: number } | undefined;
    if (existing) {
      log.info('github-webhook: duplicate delivery — already seen, skipping', {
        rowId: args.rowId,
        session: session.id,
        repo: args.repo,
        issue: args.issueNumber,
      });
      return 'local';
    }
    insertMessage(db, {
      id: args.rowId,
      kind: 'webhook',
      timestamp: new Date().toISOString(),
      platformId: `github:${args.repo}:${args.issueNumber}`,
      channelType: 'github',
      threadId: args.threadId,
      content: args.eventContent,
      processAfter: null,
      recurrence: null,
    });
    log.info('github-webhook: delivered to agent group', {
      group: group.name,
      session: session.id,
      repo: args.repo,
      issue: args.issueNumber,
      minted,
    });
    return 'local';
  } finally {
    db.close();
  }
}

/**
 * Mint a fresh orchestrator session bound to a thread_id, so subsequent
 * webhooks on the same thread converge on one session. No messaging-group:
 * webhooks aren't a chat channel, they're host-injected. The session_routing
 * row stays empty; the agent's outbound messages route by their explicit
 * `<message to=...>` destinations, not by the session's default channel.
 */
function mintOrchestratorSession(agentGroupId: string, threadId: string): Session {
  const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: Session = {
    id,
    agent_group_id: agentGroupId,
    messaging_group_id: null,
    thread_id: threadId,
    display_title: null,
    title_source: null,
    title_updated_at: null,
    agent_provider: null,
    status: 'active',
    container_status: 'stopped',
    last_active: null,
    created_at: new Date().toISOString(),
  };
  createSession(session);
  initSessionFolder(agentGroupId, id);
  return session;
}

/**
 * Shared PR-event delivery core: resolve (repo, pr_number) in
 * pr_session_mappings, then either forward to the foreign owner or write to
 * the local mapped session. Returns the DeliveryOutcome when the mapping was
 * resolved (delivered/forwarded/dropped), or `null` when there is NO mapping
 * row — letting the caller pick its own fallback (orchestrator hand-off for
 * mentions; plain drop for review/CI events that only make sense on our PRs).
 *
 * This is the single line PR webhooks travel: an inline comment, a review
 * verdict, a resolved review thread, and a failed CI run on the same PR all
 * land in the same fixer session via this function.
 */
function deliverMappedPrEvent(args: {
  repo: string;
  prNumber: number;
  rowId: string;
  eventContent: string;
  rawBody?: string;
  eventType?: string;
  deliveryId?: string;
}): DeliveryOutcome | null {
  try {
    const centralDb = getDb();
    const mapping = centralDb
      .prepare(
        'SELECT agent_group_id, session_id, thread_id, owner_instance FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      )
      .get(args.repo, args.prNumber) as
      | { agent_group_id: string; session_id: string; thread_id: string | null; owner_instance: string }
      | undefined;

    if (!mapping) return null;

    // Foreign owner — forward the raw webhook to the owning peer.
    if (INSTANCE_SLUG && mapping.owner_instance !== INSTANCE_SLUG) {
      const target = INSTANCE_FORWARD_TARGETS[mapping.owner_instance];
      if (target && args.rawBody && INTERNAL_REGISTER_SECRET) {
        forwardWebhookToPeer({
          url: target,
          secret: INTERNAL_REGISTER_SECRET,
          rawBody: args.rawBody,
          event: args.eventType ?? '',
          delivery: args.deliveryId ?? '',
        });
        log.info('github-webhook: forwarded to foreign owner', {
          repo: args.repo,
          pr: args.prNumber,
          owner: mapping.owner_instance,
          target,
        });
        return 'forwarded';
      }
      log.warn('github-webhook: foreign-owner PR but no forward target — dropping', {
        repo: args.repo,
        pr: args.prNumber,
        owner: mapping.owner_instance,
        haveTarget: Boolean(target),
        haveSecret: Boolean(INTERNAL_REGISTER_SECRET),
        haveBody: Boolean(args.rawBody),
      });
      return 'dropped';
    }

    // Local owner — deliver to the mapped session.
    const mappedSession = getSession(mapping.session_id);
    if (mappedSession) {
      const dbPath = inboundDbPath(mapping.agent_group_id, mapping.session_id);
      const db = openInboundDb(dbPath);
      try {
        // Idempotency guard — see deliverToOrchestrator for rationale.
        const existing = db.prepare('SELECT 1 FROM messages_in WHERE id = ?').get(args.rowId) as
          | { 1: number }
          | undefined;
        if (existing) {
          log.info('github-webhook: duplicate delivery — already seen, skipping', {
            rowId: args.rowId,
            session: mapping.session_id,
            repo: args.repo,
            issue: args.prNumber,
          });
          return 'local';
        }
        insertMessage(db, {
          id: args.rowId,
          kind: 'webhook',
          timestamp: new Date().toISOString(),
          platformId: `github:${args.repo}:${args.prNumber}`,
          channelType: 'github',
          threadId: mapping.thread_id,
          content: args.eventContent,
          processAfter: null,
          recurrence: null,
        });
        log.info('github-webhook: delivered via PR mapping', {
          repo: args.repo,
          pr: args.prNumber,
          session: mapping.session_id,
          threadId: mapping.thread_id,
        });
        return 'local';
      } finally {
        db.close();
      }
    }
    // Mapping row exists but its session is gone — treat as no mapping so the
    // caller's fallback runs (orchestrator for mentions; drop for PR events).
    return null;
  } catch {
    // pr_session_mappings table may not exist yet (pre-migration) — no mapping.
    return null;
  }
}

/**
 * Write a GitHub mention event into the target agent group's inbound.db,
 * or forward to a peer instance when the PR is foreign-owned, or hand off
 * to the orchestrator when no mapping exists.
 */
export function deliverGitHubMention(event: GitHubMentionEvent): DeliveryOutcome {
  const eventContent = JSON.stringify({
    event: 'github.pr_mention',
    repo: event.repo,
    issue_number: event.issueNumber,
    is_pr: event.isPr,
    comment_id: event.commentId,
    comment_url: event.commentUrl,
    commenter: event.commenter,
    body: event.body,
  });

  // Dev-route comments on plain issues (not PRs) to a peer when configured.
  // Symmetric to deliverGitHubIssueOpened's ROUTE_ISSUES_TO path so a follow-up
  // comment on an issue whose OPEN was forwarded lands at the same peer
  // (otherwise the comment falls through to the canonical instance's
  // pr_session_mappings lookup, misses, and gets dumped into the local
  // orchestrator's general chat instead of the issue's chain). Restricted to
  // !isPr because PR review/comment ownership is governed by pr_session_mappings,
  // which has explicit owner_instance routing already.
  if (!event.isPr && ROUTE_ISSUES_TO && INSTANCE_SLUG && ROUTE_ISSUES_TO !== INSTANCE_SLUG) {
    const target = INSTANCE_FORWARD_TARGETS[ROUTE_ISSUES_TO];
    if (target && event.rawBody && INTERNAL_REGISTER_SECRET) {
      forwardWebhookToPeer({
        url: target,
        secret: INTERNAL_REGISTER_SECRET,
        rawBody: event.rawBody,
        event: event.eventType ?? 'issue_comment',
        delivery: event.deliveryId ?? '',
      });
      log.info('github-webhook: dev-routed issue comment to peer', {
        repo: event.repo,
        issue: event.issueNumber,
        peer: ROUTE_ISSUES_TO,
        target,
      });
      return 'forwarded';
    }
    log.warn('github-webhook: ROUTE_ISSUES_TO set but cannot forward issue comment — dropping', {
      repo: event.repo,
      issue: event.issueNumber,
      peer: ROUTE_ISSUES_TO,
      haveTarget: Boolean(target),
      haveSecret: Boolean(INTERNAL_REGISTER_SECRET),
      haveBody: Boolean(event.rawBody),
    });
    return 'dropped';
  }

  // Check PR→session mapping first — routes webhooks to the session that
  // created the PR (foreign owner → forward; local owner → mapped session).
  // Returns null only when there's no usable mapping, in which case we fall
  // through to the orchestrator hand-off below.
  const mapped = deliverMappedPrEvent({
    repo: event.repo,
    prNumber: event.issueNumber,
    rowId: `gh-${event.commentId}`,
    eventContent,
    rawBody: event.rawBody,
    eventType: event.eventType,
    deliveryId: event.deliveryId,
  });
  if (mapped) return mapped;

  // No mapping. Hand off to the orchestrator. The orchestrator inspects
  // the event (repo, body, paths, labels) and uses ncl to enumerate
  // destinations, then dispatches to the right coworker. No static rules —
  // the orchestrator's instructions own this routing.
  //
  // Thread/session identity MUST match the open-event handlers so a follow-up
  // comment rejoins the existing chain instead of orphaning into a fresh
  // session. An issue uses `gh-issue-<repo>-<num>` (deliverGitHubIssueOpened);
  // a PR mention with no mapping uses `gh-pr-<repo>-<num>` so every foreign PR
  // gets its own resumable orchestrator session/tile. Both mint-per-thread; a
  // bare `String(num)` thread with no mintPerThread would land the comment in
  // the most-recent active session (a junk drawer that holds none of the
  // chain's history).
  const threadId = event.isPr
    ? `gh-pr-${event.repo}-${event.issueNumber}`
    : `gh-issue-${event.repo}-${event.issueNumber}`;
  return deliverToOrchestrator({
    repo: event.repo,
    issueNumber: event.issueNumber,
    rowId: `gh-${event.commentId}`,
    threadId,
    eventContent,
    mintPerThread: true,
    displayTitle: `${event.repo} #${event.issueNumber}`,
  });
}

/**
 * Deliver a GitHub `issues` event (action=opened) to the orchestrator —
 * or forward to a peer instance when ROUTE_ISSUES_TO is set.
 *
 * Issues have no PR number, so there's no mapping path. Default routing
 * is to the local admin (orchestrator) group for triage. While the
 * issue-triage path is being shaped, ROUTE_ISSUES_TO=lego on prod
 * forwards every issue to lego for development testing instead — same
 * trust-channel mechanism as PR-comment forwards (X-Webhook-Trust=
 * pre-validated, signed with INTERNAL_REGISTER_SECRET).
 */
export function deliverGitHubIssueOpened(event: GitHubIssueOpenedEvent): DeliveryOutcome {
  // Dev-route every issue to a peer when configured. Fires before the
  // local-orchestrator branch so prod-side issue triage can be redirected
  // to lego while we iterate. Off by default; set ROUTE_ISSUES_TO=<slug>
  // on the canonical instance to enable.
  if (ROUTE_ISSUES_TO && INSTANCE_SLUG && ROUTE_ISSUES_TO !== INSTANCE_SLUG) {
    const target = INSTANCE_FORWARD_TARGETS[ROUTE_ISSUES_TO];
    if (target && event.rawBody && INTERNAL_REGISTER_SECRET) {
      forwardWebhookToPeer({
        url: target,
        secret: INTERNAL_REGISTER_SECRET,
        rawBody: event.rawBody,
        event: event.eventType ?? 'issues',
        delivery: event.deliveryId ?? '',
      });
      log.info('github-webhook: dev-routed issue to peer', {
        repo: event.repo,
        issue: event.issueNumber,
        peer: ROUTE_ISSUES_TO,
        target,
      });
      return 'forwarded';
    }
    // Configured but missing target/secret/body — drop with warn so the
    // operator notices a misconfig instead of silently falling through
    // to local orchestrator (which would defeat the dev-routing intent).
    log.warn('github-webhook: ROUTE_ISSUES_TO set but cannot forward — dropping', {
      repo: event.repo,
      issue: event.issueNumber,
      peer: ROUTE_ISSUES_TO,
      haveTarget: Boolean(target),
      haveSecret: Boolean(INTERNAL_REGISTER_SECRET),
      haveBody: Boolean(event.rawBody),
    });
    return 'dropped';
  }

  const eventContent = JSON.stringify({
    event: 'github.issue_opened',
    repo: event.repo,
    issue_number: event.issueNumber,
    issue_url: event.issueUrl,
    title: event.title,
    author: event.author,
    labels: event.labels,
    body: event.body,
  });

  return deliverToOrchestrator({
    repo: event.repo,
    issueNumber: event.issueNumber,
    rowId: `gh-issue-${event.repo}-${event.issueNumber}`,
    threadId: `gh-issue-${event.repo}-${event.issueNumber}`,
    eventContent,
    mintPerThread: true,
    displayTitle: event.title
      ? `${event.repo} #${event.issueNumber}: ${event.title}`
      : `${event.repo} #${event.issueNumber}`,
  });
}

/**
 * Deliver a PR `ready_for_review` (draft→ready) event.
 *
 *   - Forward branch: when ROUTE_READY_PRS_TO is set (and names a different
 *     instance), forward the raw webhook to that peer — same trust channel as
 *     ROUTE_ISSUES_TO. Prod uses this to hand ready PRs to lego. Misconfig
 *     (missing target/secret/body) drops with a warn so the operator notices,
 *     matching deliverGitHubIssueOpened's behavior.
 *   - Local branch: deliver to the `slang-pr-approver` coworker so it can
 *     review the PR. Mint-per-thread on `gh-pr-<repo>-<num>` so the approver's
 *     work on one PR converges to a single session/tile. The rowId embeds the
 *     GitHub delivery id, so every draft→ready flip re-fires while retries of
 *     the same delivery dedup via the shared idempotency guard. If the approver
 *     group doesn't exist yet, warn and return `no-consumer-group` (no throw).
 */
export function deliverGitHubPrReadyForReview(event: GitHubPrReadyForReviewEvent): DeliveryOutcome {
  // Forward to a peer when configured (prod → lego). Fires before local
  // delivery so the canonical instance ships ready PRs to the consumer.
  if (ROUTE_READY_PRS_TO && INSTANCE_SLUG && ROUTE_READY_PRS_TO !== INSTANCE_SLUG) {
    const target = INSTANCE_FORWARD_TARGETS[ROUTE_READY_PRS_TO];
    if (target && event.rawBody && INTERNAL_REGISTER_SECRET) {
      forwardWebhookToPeer({
        url: target,
        secret: INTERNAL_REGISTER_SECRET,
        rawBody: event.rawBody,
        event: event.eventType ?? 'pull_request',
        delivery: event.deliveryId ?? '',
      });
      log.info('github-webhook: dev-routed ready-for-review PR to peer', {
        repo: event.repo,
        pr: event.prNumber,
        peer: ROUTE_READY_PRS_TO,
        target,
      });
      return 'forwarded';
    }
    log.warn('github-webhook: ROUTE_READY_PRS_TO set but cannot forward — dropping', {
      repo: event.repo,
      pr: event.prNumber,
      peer: ROUTE_READY_PRS_TO,
      haveTarget: Boolean(target),
      haveSecret: Boolean(INTERNAL_REGISTER_SECRET),
      haveBody: Boolean(event.rawBody),
    });
    return 'dropped';
  }

  // Local consumer: hand the PR to the slang-pr-approver coworker.
  const group = getAgentGroupByFolder('slang-pr-approver');
  if (!group) {
    log.warn('github-webhook: slang-pr-approver group not found — cannot deliver ready-for-review PR', {
      repo: event.repo,
      pr: event.prNumber,
    });
    return 'no-consumer-group';
  }

  const eventContent = JSON.stringify({
    event: 'github.pr_ready_for_review',
    repo: event.repo,
    pr_number: event.prNumber,
    pr_url: event.prUrl,
    title: event.title,
    author: event.author,
    task: `PR ${event.repo}#${event.prNumber} is ready for review. Review it and post your verdict.`,
  });

  return deliverToAgentGroup(group, {
    repo: event.repo,
    issueNumber: event.prNumber,
    // Delivery id in the rowId → each draft→ready flip is a distinct row and
    // re-fires; retries of the same delivery collide and dedup.
    rowId: `gh-pr-ready-${event.repo}-${event.prNumber}-${event.deliveryId ?? ''}`,
    threadId: `gh-pr-${event.repo}-${event.prNumber}`,
    eventContent,
    mintPerThread: true,
    displayTitle: event.title ? `${event.repo} #${event.prNumber}: ${event.title}` : `${event.repo} #${event.prNumber}`,
  });
}

/**
 * Deliver a non-comment PR activity event (review verdict, resolved review
 * thread, failed CI run) to the fixer session that owns the PR — the same
 * pr_session_mappings path that inline review comments already travel, so all
 * PR feedback converges on one session.
 *
 * Unlike deliverGitHubMention there is NO orchestrator fallback: a review or
 * CI event is only meaningful on a PR we own. If there's no mapping (a review
 * on some unrelated public PR, or our session was reaped), we drop it rather
 * than dumping it into the orchestrator's general chat as noise. The webhook
 * server's gate already ensures these events arrive only for real PRs; the
 * mapping is the "this PR is ours" predicate.
 */
export function deliverGitHubPrEvent(event: GitHubPrEvent): DeliveryOutcome {
  const eventContent = JSON.stringify({
    event: event.event,
    repo: event.repo,
    issue_number: event.prNumber,
    is_pr: true,
    ...event.payload,
  });

  const mapped = deliverMappedPrEvent({
    repo: event.repo,
    prNumber: event.prNumber,
    rowId: event.rowId,
    eventContent,
    rawBody: event.rawBody,
    eventType: event.eventType,
    deliveryId: event.deliveryId,
  });
  if (mapped) return mapped;

  // No live mapped session. Two sub-cases, distinguished by whether a
  // pr_session_mappings ROW exists (the row persists even after its session is
  // reaped):
  //
  //   • Row exists → the bot was pulled into this PR (a coworker created it, or
  //     an @-mention routed it through report_pr_created). The session was just
  //     reaped. Fall back to the orchestrator on the PR's canonical thread —
  //     it re-mints the session and re-runs /slang-github-webhook, which owns
  //     the PR and handles the review/CI event directly. Mirrors the mention
  //     fallback so a CI/review event on a PR we own never silently drops.
  //
  //   • No row → the bot was never involved (a stranger PR we weren't mentioned
  //     on). A review/CI event there is repo-wide noise, not work — drop it.
  //
  // The mapping row is the "@nv-slang-bot was pulled in" predicate: it is the
  // only way a non-bot PR ever acquires one, and bot-authored PRs always have
  // one — so both follow the same path. `mentionsBot` covers first contact via
  // an event whose own text addresses the bot (a review @-mention) before any
  // mapping row exists.
  if (event.mentionsBot || prMappingExists(getDb(), event.repo, event.prNumber)) {
    log.info('github-webhook: PR event addressed to bot or owned but unrouted — orchestrator fallback', {
      repo: event.repo,
      pr: event.prNumber,
      event: event.event,
      mentionsBot: Boolean(event.mentionsBot),
    });
    return deliverToOrchestrator({
      repo: event.repo,
      issueNumber: event.prNumber,
      rowId: event.rowId,
      threadId: `gh-pr-${event.repo}-${event.prNumber}`,
      eventContent,
      mintPerThread: true,
      displayTitle: `${event.repo} #${event.prNumber}`,
    });
  }

  log.info('github-webhook: PR event with no mapping — dropping', {
    repo: event.repo,
    pr: event.prNumber,
    event: event.event,
  });
  return 'dropped';
}
