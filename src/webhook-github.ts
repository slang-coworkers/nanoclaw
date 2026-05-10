/**
 * GitHub webhook event types and delivery to agent sessions.
 *
 * The host has no GitHub API token, so branch resolution is deferred to the
 * receiving agent (orchestrator), which has GH_TOKEN injected via OneCLI.
 */
import { getAdminAgentGroup, getAgentGroupByFolder } from './db/agent-groups.js';
import { getDb } from './db/connection.js';
import { openInboundDb, insertMessage } from './db/session-db.js';
import { findSessionByAgentGroup, getSession } from './db/sessions.js';
import { inboundDbPath } from './session-manager.js';
import { log } from './log.js';
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
 * Write a GitHub mention event into the target agent group's inbound.db.
 * Resolves to the orchestrator (admin group) when no branch match is found.
 * The orchestrator fragment then calls `gh api` to fetch the PR branch and
 * forwards to the coworker that owns it.
 */
export function deliverGitHubMention(event: GitHubMentionEvent): void {
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

  // Check PR→session mapping first — routes webhooks to the session that created the PR
  try {
    const centralDb = getDb();
    const mapping = centralDb
      .prepare('SELECT agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?')
      .get(event.repo, event.issueNumber) as
      | { agent_group_id: string; session_id: string; thread_id: string }
      | undefined;

    if (mapping) {
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
          return;
        } finally {
          db.close();
        }
      }
    }
  } catch {
    // pr_session_mappings table may not exist yet (pre-migration) — fall through
  }

  // Fallback: resolve by branch name or admin group
  const group = resolveAgentGroupFromBranch(event.prBranch);
  if (!group) {
    log.warn('github-webhook: no admin agent group configured — cannot deliver', { repo: event.repo });
    return;
  }

  const session = findSessionByAgentGroup(group.id);
  if (!session) {
    log.warn('github-webhook: no active session for agent group — dropping', {
      group: group.name,
      repo: event.repo,
      issue: event.issueNumber,
    });
    return;
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
  } finally {
    db.close();
  }
}
