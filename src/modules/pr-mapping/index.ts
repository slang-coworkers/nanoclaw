/**
 * PR→Session mapping module.
 *
 * When a container agent creates a GitHub PR, it calls `report_pr_created`
 * which writes a `map_pr_session` system action to outbound. This handler
 * records the mapping in the central DB so that subsequent GitHub webhooks
 * for that PR route to the correct session (instead of creating an orphan
 * session with the PR number as thread_id).
 */
import { registerDeliveryAction } from '../../delivery.js';
import { getDb } from '../../db/connection.js';
import { log } from '../../log.js';
import type { Session } from '../../types.js';

registerDeliveryAction(
  'map_pr_session',
  async (content: Record<string, unknown>, session: Session) => {
    const repo = typeof content.repo === 'string' ? content.repo : null;
    const prNumber = typeof content.pr_number === 'number' ? content.pr_number : null;

    if (!repo || prNumber == null) {
      log.warn('map_pr_session: missing repo or pr_number', { content });
      return;
    }

    const db = getDb();
    db.prepare(
      `INSERT OR IGNORE INTO pr_session_mappings
       (repo, pr_number, agent_group_id, session_id, thread_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    ).run(repo, prNumber, session.agent_group_id, session.id, session.thread_id);

    log.info('PR→session mapping recorded', {
      repo,
      pr: prNumber,
      session: session.id,
      threadId: session.thread_id,
    });
  },
);
