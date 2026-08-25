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
  APPROVER_CI_GATE,
  INSTANCE_FORWARD_TARGETS,
  INSTANCE_SLUG,
  INTERNAL_REGISTER_SECRET,
  ROUTE_ISSUES_TO,
  ROUTE_READY_PRS_TO,
} from './config.js';
import { getAdminAgentGroup } from './db/agent-groups.js';
import { getDb } from './db/connection.js';
import { openInboundDb, insertMessage } from './mailbox/sqlite/session-db.js';
import {
  createSession,
  findSessionByAgentGroup,
  findSessionByAgentThread,
  getSession,
  updateSessionTitle,
} from './db/sessions.js';
import { log } from './log.js';
import { getDecisionSessionsForPr, recordHumanVerdict } from './modules/approval-ledger/store.js';
import { forwardWebhookToPeer } from './modules/pr-mapping/forward.js';
import { prMappingExists } from './modules/pr-mapping/store.js';
import { deleteParked, parkReviewable } from './modules/pending-reviewable/store.js';
import { getAgentGroup } from './db/agent-groups.js';
import { inboundDbPath } from './mailbox/sqlite/paths.js';
import { initSessionFolder } from './session-manager.js';
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
 * A PR that has become reviewable: draft→ready (`ready_for_review`), opened
 * directly non-draft (`opened`), or a new push to a ready PR (`synchronize`).
 * Prod forwards these to a peer (ROUTE_READY_PRS_TO); the consumer instance
 * routes them to the PR's owning session (pr_session_mappings) or, when
 * unmapped, to the orchestrator — the same unified flow as PR mentions.
 */
export interface GitHubPrReviewableEvent {
  repo: string;
  prNumber: number;
  prUrl: string;
  title: string;
  author: string;
  /** Which action made the PR reviewable: ready_for_review | opened | synchronize. */
  reason: string;
  /** Raw webhook body, preserved for forwarding when ROUTE_READY_PRS_TO is set. */
  rawBody?: string;
  /** GitHub event type header, propagated to peer on forward. */
  eventType?: string;
  /** GitHub delivery id — propagated on forward AND used in the rowId so each
   * reviewable event (flip / push) re-fires while same-delivery retries dedup. */
  deliveryId?: string;
  /** PR head sha. Required to park under the CI gate (the head CI must pass on)
   * and to key the parked row's debounce. Empty when unknown (gate skipped). */
  headSha?: string;
}

/**
 * Outcome of a webhook delivery decision. Used by the funnel-entry handler
 * for the JSON response shape and ops log filtering.
 */
export type DeliveryOutcome =
  | 'local'
  | 'forwarded'
  | 'dropped'
  | 'no-session'
  | 'no-admin-group'
  | 'parked'
  | 'released';

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
async function deliverToOrchestrator(args: {
  repo: string;
  issueNumber: number;
  rowId: string;
  threadId: string;
  eventContent: string;
  mintPerThread?: boolean;
  displayTitle?: string;
}): Promise<DeliveryOutcome> {
  const group: AgentGroup | undefined = await getAdminAgentGroup();
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
async function deliverToAgentGroup(
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
): Promise<DeliveryOutcome> {
  let session: Session | undefined;
  let minted = false;
  if (args.mintPerThread && args.threadId) {
    session = await findSessionByAgentThread(group.id, args.threadId);
    if (!session) {
      session = await mintOrchestratorSession(group.id, args.threadId);
      minted = true;
    }
  } else {
    session = await findSessionByAgentGroup(group.id);
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
    await updateSessionTitle(session.id, args.displayTitle, 'auto');
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
async function mintOrchestratorSession(agentGroupId: string, threadId: string): Promise<Session> {
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
  await createSession(session);
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
async function deliverMappedPrEvent(args: {
  repo: string;
  prNumber: number;
  rowId: string;
  eventContent: string;
  rawBody?: string;
  eventType?: string;
  deliveryId?: string;
}): Promise<DeliveryOutcome | null> {
  try {
    const centralDb = getDb();
    const mapping = await centralDb.get<{
      agent_group_id: string;
      session_id: string;
      thread_id: string | null;
      owner_instance: string;
    }>(
      'SELECT agent_group_id, session_id, thread_id, owner_instance FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      args.repo,
      args.prNumber,
    );

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
    const mappedSession = await getSession(mapping.session_id);
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
export async function deliverGitHubMention(event: GitHubMentionEvent): Promise<DeliveryOutcome> {
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
  const mapped = await deliverMappedPrEvent({
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
  return await deliverToOrchestrator({
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
export async function deliverGitHubIssueOpened(event: GitHubIssueOpenedEvent): Promise<DeliveryOutcome> {
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

  return await deliverToOrchestrator({
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
 * Deliver a PR "reviewable" event (draft→ready, opened non-draft, or a new
 * push to a ready PR) to the orchestrator, which mints a per-PR session and —
 * via the slang-github-webhook skill — forwards to the right reviewer coworker.
 *
 *   - Forward branch: when ROUTE_READY_PRS_TO is set (and names a different
 *     instance), forward the raw webhook to that peer — same trust channel as
 *     ROUTE_ISSUES_TO. Prod uses this to hand reviewable PRs to lego. Misconfig
 *     (missing target/secret/body) drops with a warn so the operator notices,
 *     matching deliverGitHubIssueOpened's behavior.
 *   - Orchestrator branch: ALWAYS deliver to the admin (orchestrator) group on
 *     the PR's canonical thread `gh-pr-<repo>-<num>`, minting the session per
 *     thread. The orchestrator owns routing to the reviewer coworker — we don't
 *     look up pr_session_mappings here; a reviewable PR always merits a review.
 *
 * The rowId embeds the GitHub delivery id, so every flip/push re-fires while
 * retries of the same delivery dedup via the shared idempotency guard.
 */
export async function deliverGitHubPrReviewable(event: GitHubPrReviewableEvent): Promise<DeliveryOutcome> {
  // Forward to a peer when configured (prod → lego). Fires before local
  // routing so the canonical instance ships reviewable PRs to the consumer.
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
      log.info('github-webhook: dev-routed reviewable PR to peer', {
        repo: event.repo,
        pr: event.prNumber,
        reason: event.reason,
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

  // CI gate: park instead of deliver. A reviewable event does not mint an
  // approver session until a required CI check_suite reports success for this
  // head (see the check_suite success handler → releaseParkedReviewable). The
  // parked row is keyed on (repo, pr) with last-writer-wins, so a burst of
  // synchronize pushes collapses to one decision on the settled+green head —
  // this is the debounce that replaces the per-push re-fire (delivery-id rowId).
  // Requires a head sha to know which CI to wait on; without one we fall through
  // to immediate delivery rather than park a PR we could never release.
  if (APPROVER_CI_GATE && event.headSha) {
    await parkReviewable(getDb(), {
      repo: event.repo,
      prNumber: event.prNumber,
      headSha: event.headSha,
      reason: event.reason,
      rawEventJson: JSON.stringify({
        repo: event.repo,
        prNumber: event.prNumber,
        prUrl: event.prUrl,
        title: event.title,
        author: event.author,
        reason: event.reason,
        rawBody: event.rawBody,
        eventType: event.eventType,
        deliveryId: event.deliveryId,
        headSha: event.headSha,
      }),
    });
    return 'parked';
  }

  const eventContent = JSON.stringify({
    event: 'github.pr_ready_for_review',
    repo: event.repo,
    issue_number: event.prNumber,
    is_pr: true,
    reason: event.reason,
    pr_url: event.prUrl,
    title: event.title,
    author: event.author,
    task: `PR ${event.repo}#${event.prNumber} is ready for review (${event.reason}). Route it to the project's *-pr-approver coworker (never a reviewer/fixer).`,
  });

  // Always to the orchestrator on the PR's canonical thread. Delivery id in the
  // rowId → each flip/push is a distinct row and re-fires; retries of the same
  // delivery collide and dedup.
  return await deliverToOrchestrator({
    repo: event.repo,
    issueNumber: event.prNumber,
    rowId: `gh-pr-ready-${event.repo}-${event.prNumber}-${event.deliveryId ?? ''}`,
    threadId: `gh-pr-${event.repo}-${event.prNumber}`,
    eventContent,
    mintPerThread: true,
    displayTitle: event.title ? `${event.repo} #${event.prNumber}: ${event.title}` : `${event.repo} #${event.prNumber}`,
  });
}

/**
 * Release a PR parked by the CI gate: reconstruct the reviewable event from the
 * stored JSON and deliver it now (CI has gone green for its head). Called from
 * the check_suite success handler with the parked row. The reconstructed event
 * carries no headSha, so re-entering deliverGitHubPrReviewable does NOT re-park
 * — it flows straight to the orchestrator delivery, minting the one fresh
 * approver session for this settled+green head.
 */
export async function releaseParkedReviewable(rawEventJson: string): Promise<DeliveryOutcome> {
  let saved: Record<string, unknown>;
  try {
    saved = JSON.parse(rawEventJson) as Record<string, unknown>;
  } catch {
    log.warn('ci-gate: parked row has unparseable event JSON — cannot release');
    return 'dropped';
  }
  // Deliberately omit headSha so deliverGitHubPrReviewable skips the park branch
  // and delivers. Peer-forward still applies if ROUTE_READY_PRS_TO is set.
  const outcome = await deliverGitHubPrReviewable({
    repo: String(saved.repo ?? ''),
    prNumber: Number(saved.prNumber ?? 0),
    prUrl: String(saved.prUrl ?? ''),
    title: String(saved.title ?? ''),
    author: String(saved.author ?? ''),
    reason: String(saved.reason ?? 'synchronize'),
    rawBody: typeof saved.rawBody === 'string' ? saved.rawBody : undefined,
    eventType: typeof saved.eventType === 'string' ? saved.eventType : undefined,
    deliveryId: typeof saved.deliveryId === 'string' ? saved.deliveryId : undefined,
  });
  log.info('ci-gate: released parked reviewable PR after CI green', {
    repo: String(saved.repo ?? ''),
    pr: Number(saved.prNumber ?? 0),
    outcome,
  });
  return outcome === 'local' ? 'released' : outcome;
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
/**
 * Terminal PR events (merged / closed) also feed the approver's learning loop.
 * The approval_decisions ledger records which approver session decided this PR
 * (agent_group_id + thread_id, keyed on gh-pr-<repo>-<num>); we deliver the
 * outcome there so the approver can join the human verdict onto its R0 row and
 * distill an abstract learning ("changes of this shape warrant probing X").
 *
 * This is a SIDE delivery, independent of the fixer routing: it never changes
 * the primary DeliveryOutcome, never mints a session (a reaped approver session
 * has nothing to resume — the ledger row already persists for the offline
 * scorer), and is a silent no-op when no approver decided this PR. Deduped on
 * (agent_group_id, thread_id) so an R0..Rn multi-decision PR wakes the session
 * once.
 */
async function notifyApproverOfTerminalPr(event: GitHubPrEvent, eventContent: string): Promise<void> {
  try {
    const rows = await getDecisionSessionsForPr(getDb(), event.repo, event.prNumber);
    if (rows.length === 0) return;

    // Stamp the verdict HERE, deterministically, before waking anyone.
    //
    // The outcome is a fact the host already holds: github-webhook-server picks
    // `pr_merged` vs `pr_closed` straight off the payload, and the decision rows
    // are loaded above. Yet the join used to depend on an LLM turn choosing to
    // call the `record_human_verdict` MCP tool after being woken — so a bounced,
    // distracted, or summarising turn silently lost the record. That put the
    // measurement of whether the approver can replace a human inside the
    // approver's own best-effort behaviour.
    //
    // Mapping is the one the approver SKILL.md already specifies: merged =>
    // APPROVED-equivalent, closed-unmerged => CHANGES_REQUESTED-equivalent.
    // recordHumanVerdict is first-verdict-wins, so an earlier real observation
    // (e.g. a human's CHANGES_REQUESTED on pr_review) is never overwritten.
    // This is now the ONLY path that may stamp a verdict — the container-side
    // `record_human_verdict` action is denied by the guard, because an agent
    // reporting the human's opinion of its own work is the one input the
    // calibration metric cannot tolerate being self-asserted. The agent is
    // still woken below, but only for the half that genuinely needs judgment:
    // distilling the learning.
    try {
      // The PR's final head, when the payload carries it. Passing the real head
      // is what lets recordHumanVerdict distinguish exact from head_advanced; a
      // missing head falls through to the fallback path, which is the honest
      // answer when we cannot tell.
      const headSha = typeof event.payload.head_sha === 'string' ? event.payload.head_sha : '';
      // The delivery id is the provenance key: it names the GitHub event that
      // observed the human, and makes a webhook redelivery (routine) an
      // idempotent no-op rather than a second observation.
      await recordHumanVerdict(
        getDb(),
        event.repo,
        event.prNumber,
        headSha,
        event.event === 'github.pr_merged' ? 'MERGED' : 'CLOSED_UNMERGED',
        { kind: 'github_webhook', eventId: event.deliveryId ?? `${event.event}:${event.rowId}` },
      );
    } catch (err) {
      log.warn('github-webhook: deterministic verdict join failed (non-fatal)', {
        repo: event.repo,
        pr: event.prNumber,
        err: err instanceof Error ? err.message : String(err),
      });
    }

    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.thread_id) continue;
      const key = `${row.agent_group_id} ${row.thread_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const group = await getAgentGroup(row.agent_group_id);
      if (!group) continue;
      // mintPerThread:false — only deliver to a session that still exists; a
      // reaped approver session isn't re-minted for a backward-looking learning
      // signal (the ledger already carries the row for offline scoring).
      const session = await findSessionByAgentThread(group.id, row.thread_id);
      if (!session) {
        log.info('github-webhook: approver session gone — terminal PR learning skipped', {
          repo: event.repo,
          pr: event.prNumber,
          group: group.name,
          thread: row.thread_id,
        });
        continue;
      }
      const dbPath = inboundDbPath(group.id, session.id);
      const db = openInboundDb(dbPath);
      try {
        const rowId = `${event.rowId}-approver`;
        const existing = db.prepare('SELECT 1 FROM messages_in WHERE id = ?').get(rowId);
        if (existing) continue;
        insertMessage(db, {
          id: rowId,
          kind: 'webhook',
          timestamp: new Date().toISOString(),
          platformId: `github:${event.repo}:${event.prNumber}`,
          channelType: 'github',
          threadId: row.thread_id,
          content: eventContent,
          processAfter: null,
          recurrence: null,
        });
        log.info('github-webhook: terminal PR delivered to approver for learning', {
          repo: event.repo,
          pr: event.prNumber,
          group: group.name,
          session: session.id,
          event: event.event,
        });
      } finally {
        db.close();
      }
    }
  } catch (err) {
    log.warn('github-webhook: approver learning-loop delivery failed (non-fatal)', {
      repo: event.repo,
      pr: event.prNumber,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function deliverGitHubPrEvent(event: GitHubPrEvent): Promise<DeliveryOutcome> {
  const eventContent = JSON.stringify({
    event: event.event,
    repo: event.repo,
    issue_number: event.prNumber,
    is_pr: true,
    ...event.payload,
  });

  // Terminal events (merged/closed) also feed the approver's learning loop, in
  // addition to the fixer routing below. Independent side-channel.
  if (event.event === 'github.pr_merged' || event.event === 'github.pr_closed') {
    await notifyApproverOfTerminalPr(event, eventContent);
    // GC the CI-gate park slot. A parked reviewable row is released only by a
    // later check_suite=success for its head — which a finished PR will never
    // emit — so without this the row is immortal. Prod 2026-08-05 had 112 parked
    // rows of which 74 (71 merged, 3 closed) could never fire again; the table
    // only ever grew. Terminal is the one moment we know the wait is pointless.
    try {
      await deleteParked(getDb(), event.repo, event.prNumber);
    } catch (err) {
      log.warn('github-webhook: parked-row GC failed (non-fatal)', {
        repo: event.repo,
        pr: event.prNumber,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const mapped = await deliverMappedPrEvent({
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
  if (event.mentionsBot || (await prMappingExists(getDb(), event.repo, event.prNumber))) {
    log.info('github-webhook: PR event addressed to bot or owned but unrouted — orchestrator fallback', {
      repo: event.repo,
      pr: event.prNumber,
      event: event.event,
      mentionsBot: Boolean(event.mentionsBot),
    });
    return await deliverToOrchestrator({
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
