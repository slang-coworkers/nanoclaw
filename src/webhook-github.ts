/**
 * GitHub webhook event types and delivery to agent sessions.
 *
 * Three delivery paths in priority order:
 *   1. PR mapping hit + owner is *this* instance → write to local session.
 *   2. PR mapping hit + owner is a foreign instance → forward to peer
 *      via INSTANCE_FORWARD_TARGETS (signed with INTERNAL_REGISTER_SECRET,
 *      X-Webhook-Trust=pre-validated). Receiver skips its filters and
 *      delivers locally.
 *   3. No mapping → fall through to legacy admin-group / branch fallback,
 *      gated by WEBHOOK_REQUIRE_MAPPING for non-canonical instances.
 *
 * The host has no GitHub API token, so branch resolution is deferred to the
 * receiving agent (orchestrator), which has GH_TOKEN injected via OneCLI.
 */
import { INSTANCE_FORWARD_TARGETS, INSTANCE_SLUG, INTERNAL_REGISTER_SECRET } from './config.js';
import { getAdminAgentGroup, getAgentGroupByFolder } from './db/agent-groups.js';
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
  /** Head branch from the webhook payload (present in pull_request_review_comment; null for issue_comment). */
  prBranch: string | null;
  /** Raw webhook body, preserved for forwarding to a peer instance when owner_instance is foreign. */
  rawBody?: string;
  /** GitHub event type header, propagated to peer on forward. */
  eventType?: string;
  /** GitHub delivery id, propagated to peer on forward (idempotency tag). */
  deliveryId?: string;
}

/**
 * Resolve target agent group from PR branch name.
 * Convention: dev/<folder-name>/... → look up by folder.
 * Falls back to the admin (orchestrator) group.
 */
export function resolveAgentGroupFromBranch(branch: string | null | undefined): AgentGroup | undefined {
  if (branch) {
    const match = /^dev\/([^/]+)\//.exec(branch);
    if (match) {
      const group = getAgentGroupByFolder(match[1]);
      if (group) return group;
    }
  }
  return getAdminAgentGroup();
}

/**
 * Outcome of a webhook delivery decision. Used by the funnel-entry handler
 * to decide whether to also fire the eyes reaction (only on local delivery)
 * and what the JSON response should say.
 */
export type DeliveryOutcome = 'local' | 'forwarded' | 'dropped' | 'no-session' | 'no-admin-group';

/**
 * Write a GitHub mention event into the target agent group's inbound.db,
 * or forward to a peer instance when the PR is foreign-owned.
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

  // When WEBHOOK_REQUIRE_MAPPING is set, only act on PRs this instance originated
  // (i.e. has a row in pr_session_mappings). Used by dev instances that share a
  // webhook target with prod so they don't double-reply on PRs they didn't create.
  if (process.env.WEBHOOK_REQUIRE_MAPPING === '1') {
    log.info('github-webhook: no PR mapping, dropping (WEBHOOK_REQUIRE_MAPPING=1)', {
      repo: event.repo,
      pr: event.issueNumber,
    });
    return 'dropped';
  }

  // Fallback: resolve by branch name or admin group
  const group = resolveAgentGroupFromBranch(event.prBranch);
  if (!group) {
    log.warn('github-webhook: no admin agent group configured — cannot deliver', { repo: event.repo });
    return 'no-admin-group';
  }

  const session = findSessionByAgentGroup(group.id);
  if (!session) {
    log.warn('github-webhook: no active session for agent group — dropping', {
      group: group.name,
      repo: event.repo,
      issue: event.issueNumber,
    });
    return 'no-session';
  }

  const dbPath = inboundDbPath(group.id, session.id);
  const db = openInboundDb(dbPath);
  try {
    insertMessage(db, {
      id: `gh-${event.commentId}`,
      kind: 'webhook',
      timestamp: new Date().toISOString(),
      platformId: `github:${event.repo}:${event.issueNumber}`,
      channelType: 'github',
      threadId: String(event.issueNumber),
      content: eventContent,
      processAfter: null,
      recurrence: null,
    });
    log.info('github-webhook: delivered', {
      group: group.name,
      session: session.id,
      repo: event.repo,
      issue: event.issueNumber,
    });
    return 'local';
  } finally {
    db.close();
  }
}
