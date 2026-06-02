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
import { INSTANCE_FORWARD_TARGETS, INSTANCE_SLUG, INTERNAL_REGISTER_SECRET, ROUTE_ISSUES_TO } from './config.js';
import { getAdminAgentGroup } from './db/agent-groups.js';
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
 * Outcome of a webhook delivery decision. Used by the funnel-entry handler
 * for the JSON response shape and ops log filtering.
 */
export type DeliveryOutcome = 'local' | 'forwarded' | 'dropped' | 'no-session' | 'no-admin-group';

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
    log.warn('github-webhook: orchestrator agent group has no active session — dropping', {
      group: group.name,
      repo: args.repo,
      issue: args.issueNumber,
    });
    return 'no-session';
  }

  // Stamp a display title for fresh issue sessions so the dashboard
  // timeline reads "<repo> #<num>: <title>" instead of inheriting the
  // first inbound's first 80 chars (which historically left the legacy
  // √121 self-loop test as the visible label).
  if (minted && args.displayTitle) {
    updateSessionTitle(session.id, args.displayTitle, 'auto');
  }

  const dbPath = inboundDbPath(group.id, session.id);
  const db = openInboundDb(dbPath);
  try {
    // Idempotency guard: row id is `gh-issue-<repo>-<num>` (or `gh-<commentId>`
    // for PR mentions). GitHub retries deliveries on 5xx and the peer-forwarder
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
    log.info('github-webhook: delivered to orchestrator', {
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

  // Check PR→session mapping first — routes webhooks to the session that created the PR.
  // When the owner is a foreign instance, hand off to the forwarder instead of writing locally.
  try {
    const centralDb = getDb();
    const mapping = centralDb
      .prepare(
        'SELECT agent_group_id, session_id, thread_id, owner_instance FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
      )
      .get(event.repo, event.issueNumber) as
      | { agent_group_id: string; session_id: string; thread_id: string | null; owner_instance: string }
      | undefined;

    if (mapping) {
      // Foreign owner — forward.
      if (INSTANCE_SLUG && mapping.owner_instance !== INSTANCE_SLUG) {
        const target = INSTANCE_FORWARD_TARGETS[mapping.owner_instance];
        if (target && event.rawBody && INTERNAL_REGISTER_SECRET) {
          forwardWebhookToPeer({
            url: target,
            secret: INTERNAL_REGISTER_SECRET,
            rawBody: event.rawBody,
            event: event.eventType ?? '',
            delivery: event.deliveryId ?? '',
          });
          log.info('github-webhook: forwarded to foreign owner', {
            repo: event.repo,
            pr: event.issueNumber,
            owner: mapping.owner_instance,
            target,
          });
          return 'forwarded';
        }
        // Owner is foreign but we have no forward target / no secret /
        // missing body. Drop with a warn so the operator notices a
        // misconfig — silent fall-through would deliver a foreign PR to
        // our own session, breaking the disjoint-ownership invariant.
        log.warn('github-webhook: foreign-owner PR but no forward target — dropping', {
          repo: event.repo,
          pr: event.issueNumber,
          owner: mapping.owner_instance,
          haveTarget: Boolean(target),
          haveSecret: Boolean(INTERNAL_REGISTER_SECRET),
          haveBody: Boolean(event.rawBody),
        });
        return 'dropped';
      }

      // Local owner — deliver to the mapped session.
      const mappedSession = getSession(mapping.session_id);
      if (mappedSession) {
        const dbPath = inboundDbPath(mapping.agent_group_id, mapping.session_id);
        const db = openInboundDb(dbPath);
        const rowId = `gh-${event.commentId}`;
        try {
          // Idempotency guard — see deliverToOrchestrator for rationale.
          const existing = db.prepare('SELECT 1 FROM messages_in WHERE id = ?').get(rowId) as { 1: number } | undefined;
          if (existing) {
            log.info('github-webhook: duplicate delivery — already seen, skipping', {
              rowId,
              session: mapping.session_id,
              repo: event.repo,
              issue: event.issueNumber,
            });
            return 'local';
          }
          insertMessage(db, {
            id: rowId,
            kind: 'webhook',
            timestamp: new Date().toISOString(),
            platformId: `github:${event.repo}:${event.issueNumber}`,
            channelType: 'github',
            threadId: mapping.thread_id,
            content: eventContent,
            processAfter: null,
            recurrence: null,
          });
          log.info('github-webhook: delivered via PR mapping', {
            repo: event.repo,
            pr: event.issueNumber,
            session: mapping.session_id,
            threadId: mapping.thread_id,
          });
          return 'local';
        } finally {
          db.close();
        }
      }
    }
  } catch {
    // pr_session_mappings table may not exist yet (pre-migration) — fall through
  }

  // No mapping. Hand off to the orchestrator. The orchestrator inspects
  // the event (repo, body, paths, labels) and uses ncl to enumerate
  // destinations, then dispatches to the right coworker. No static rules —
  // the orchestrator's instructions own this routing.
  return deliverToOrchestrator({
    repo: event.repo,
    issueNumber: event.issueNumber,
    rowId: `gh-${event.commentId}`,
    threadId: String(event.issueNumber),
    eventContent,
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
