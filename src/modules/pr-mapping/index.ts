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

registerDeliveryAction('map_pr_session', async (content: Record<string, unknown>, session: Session) => {
  const repo = typeof content.repo === 'string' ? content.repo : null;
  const prNumber = typeof content.pr_number === 'number' ? content.pr_number : null;

  if (!repo || prNumber == null) {
    log.warn('map_pr_session: missing repo or pr_number', { content });
    return;
  }

  const db = getDb();
  // Fix schema if thread_id is NOT NULL (original migration bug — main sessions
  // have thread_id=NULL and INSERT OR IGNORE silently drops the row).
  try {
    const colInfo = db.prepare("PRAGMA table_info(pr_session_mappings)").all() as Array<{ name: string; notnull: number }>;
    const tidCol = colInfo.find((c) => c.name === 'thread_id');
    if (tidCol && tidCol.notnull === 1) {
      db.exec("ALTER TABLE pr_session_mappings RENAME TO _pr_session_mappings_old");
      db.exec(`CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      )`);
      db.exec("INSERT INTO pr_session_mappings SELECT * FROM _pr_session_mappings_old");
      db.exec("DROP TABLE _pr_session_mappings_old");
      db.exec("CREATE INDEX IF NOT EXISTS idx_pr_map_lookup ON pr_session_mappings(repo, pr_number)");
    }
  } catch { /* already fixed or table doesn't exist */ }

  const result = db.prepare(
    `INSERT OR REPLACE INTO pr_session_mappings
       (repo, pr_number, agent_group_id, session_id, thread_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).run(repo, prNumber, session.agent_group_id, session.id, session.thread_id);

  if (result.changes > 0) {
    log.info('PR→session mapping recorded', {
      repo,
      pr: prNumber,
      session: session.id,
      threadId: session.thread_id,
    });
  } else {
    log.warn('PR→session mapping already exists or insert failed', {
      repo,
      pr: prNumber,
      session: session.id,
    });
  }
});
