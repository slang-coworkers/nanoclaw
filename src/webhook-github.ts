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
import { INSTANCE_FORWARD_TARGETS, INSTANCE_SLUG, INTERNAL_REGISTER_SECRET } from './config.js';
import { getAdminAgentGroup } from './db/agent-groups.js';
import { getDb } from './db/connection.js';
import { openInboundDb, insertMessage } from './db/session-db.js';
import { findSessionByAgentGroup, getSession } from './db/sessions.js';
import { log } from './log.js';
import { forwardWebhookToPeer } from './modules/pr-mapping/forward.js';
import { inboundDbPath } from './session-manager.js';
import type { AgentGroup } from './types.js';

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
 * group's active session. Used as the unmapped-fallback for PR comments and
 * the always-target for issues. Returns DeliveryOutcome.
 */
function deliverToOrchestrator(args: {
  repo: string;
  issueNumber: number;
  rowId: string;
  threadId: string;
  eventContent: string;
}): DeliveryOutcome {
  const group: AgentGroup | undefined = getAdminAgentGroup();
  if (!group) {
    log.warn('github-webhook: no admin agent group configured — cannot deliver to orchestrator', {
      repo: args.repo,
    });
    return 'no-admin-group';
  }

  const session = findSessionByAgentGroup(group.id);
  if (!session) {
    log.warn('github-webhook: orchestrator agent group has no active session — dropping', {
      group: group.name,
      repo: args.repo,
      issue: args.issueNumber,
    });
    return 'no-session';
  }

  const dbPath = inboundDbPath(group.id, session.id);
  const db = openInboundDb(dbPath);
  try {
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
    });
    return 'local';
  } finally {
    db.close();
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
        try {
          insertMessage(db, {
            id: `gh-${event.commentId}`,
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
 * Deliver a GitHub `issues` event (action=opened) to the orchestrator.
 * Issues have no PR number, so there's no mapping path — they always go
 * to the admin group for triage.
 */
export function deliverGitHubIssueOpened(event: GitHubIssueOpenedEvent): DeliveryOutcome {
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
    threadId: String(event.issueNumber),
    eventContent,
  });
}
