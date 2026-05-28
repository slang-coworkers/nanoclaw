/**
 * pr_session_mappings write path — shared between the in-process delivery
 * action handler and the HTTP register-PR endpoint.
 *
 * The table on the canonical instance (prod) is the source of truth for
 * "which session owns PR (repo, pr_number)". Non-canonical instances
 * (lego) post here over HTTP via /internal/register-pr; canonical
 * registrations from local agents call this directly.
 *
 * INSERT OR REPLACE is intentional: last-writer-wins. When the row's
 * owner_instance changes we emit a warn — a legitimate ownership flip is
 * rare (fork pickup, reroute), and the log line is the audit trail.
 */
import type Database from 'better-sqlite3';

import { log } from '../../log.js';

export interface PrMappingWrite {
  repo: string;
  prNumber: number;
  ownerInstance: string;
  agentGroupId: string;
  sessionId: string;
  threadId: string | null;
}

export interface PrMappingExisting {
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
}

/** Migrate the legacy NOT NULL thread_id schema in place if needed. */
function ensureThreadIdNullable(db: Database.Database): void {
  try {
    const colInfo = db.prepare('PRAGMA table_info(pr_session_mappings)').all() as Array<{
      name: string;
      notnull: number;
    }>;
    const tidCol = colInfo.find((c) => c.name === 'thread_id');
    const ownerCol = colInfo.find((c) => c.name === 'owner_instance');
    if (!tidCol || tidCol.notnull !== 1) return;
    db.exec('ALTER TABLE pr_session_mappings RENAME TO _pr_session_mappings_old');
    if (ownerCol) {
      db.exec(`CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL,
        owner_instance TEXT NOT NULL DEFAULT 'prod',
        PRIMARY KEY (repo, pr_number)
      )`);
    } else {
      db.exec(`CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      )`);
    }
    db.exec('INSERT INTO pr_session_mappings SELECT * FROM _pr_session_mappings_old');
    db.exec('DROP TABLE _pr_session_mappings_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_pr_map_lookup ON pr_session_mappings(repo, pr_number)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_pr_map_owner ON pr_session_mappings(owner_instance)');
  } catch {
    /* already fixed or table doesn't exist */
  }
}

/**
 * Upsert a PR→session mapping. Returns the prior owner_instance if the
 * row existed (caller can decide whether the change is a transfer or a
 * no-op refresh).
 */
export function upsertPrMapping(db: Database.Database, w: PrMappingWrite): { priorOwner: string | null } {
  ensureThreadIdNullable(db);

  const prior = db
    .prepare(
      'SELECT owner_instance, agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
    )
    .get(w.repo, w.prNumber) as PrMappingExisting | undefined;

  db.prepare(
    `INSERT OR REPLACE INTO pr_session_mappings
     (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
  ).run(w.repo, w.prNumber, w.agentGroupId, w.sessionId, w.threadId, w.ownerInstance);

  if (prior && prior.owner_instance !== w.ownerInstance) {
    log.warn('pr-mapping ownership changed', {
      repo: w.repo,
      pr: w.prNumber,
      from: prior.owner_instance,
      to: w.ownerInstance,
      newSession: w.sessionId,
    });
  }

  return { priorOwner: prior?.owner_instance ?? null };
}
