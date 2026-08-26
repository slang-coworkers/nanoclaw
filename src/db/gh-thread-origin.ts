/**
 * Read/write helpers for the gh_thread_origin table.
 *
 * See src/db/migrations/940-gh-thread-origin.ts for schema + rationale.
 */
import { getDb } from './connection.js';
import { log } from '../log.js';

export interface GhThreadOrigin {
  thread_id: string;
  repo: string;
  number: number;
  kind: 'issue' | 'pr';
  author: string;
  created_at: string;
}

/**
 * Record who filed the GitHub issue/PR behind a canonical `gh-issue-`/`gh-pr-`
 * thread chain. Called once, host-side, at the moment webhook delivery mints
 * a fresh per-thread orchestrator session (src/webhook-github.ts) — the only
 * point this data is available; it is never reconstructed later.
 *
 * INSERT OR IGNORE: the author of a GitHub issue/PR is an immutable fact
 * once observed, so a second call for the same thread_id (shouldn't happen —
 * minting only occurs when no session existed yet — but harmless either way)
 * never overwrites the first observation. Never throws: a missing table
 * (pre-migration) or a transient DB error just means the dashboard shows no
 * author for this thread, not a broken webhook delivery.
 */
export async function recordGhThreadOrigin(origin: {
  threadId: string;
  repo: string;
  number: number;
  kind: 'issue' | 'pr';
  author: string;
}): Promise<void> {
  if (!origin.threadId || !origin.repo || !origin.number || !origin.author) return;
  try {
    // `INSERT … WHERE NOT EXISTS` rather than `INSERT OR IGNORE` (SQLite-only),
    // and an ISO timestamp parameter rather than `datetime('now')`, so this
    // reads the same on any backend the async driver is composed against.
    await getDb().run(
      `INSERT INTO gh_thread_origin (thread_id, repo, number, kind, author, created_at)
       SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM gh_thread_origin WHERE thread_id = ?)`,
      origin.threadId,
      origin.repo,
      origin.number,
      origin.kind,
      origin.author,
      new Date().toISOString(),
      origin.threadId,
    );
  } catch (err) {
    log.warn('gh-thread-origin: record failed (non-fatal)', {
      threadId: origin.threadId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Look up the origin row for a single thread_id. Never throws. */
export async function getGhThreadOrigin(threadId: string): Promise<GhThreadOrigin | undefined> {
  try {
    return await getDb().get<GhThreadOrigin>('SELECT * FROM gh_thread_origin WHERE thread_id = ?', threadId);
  } catch {
    return undefined;
  }
}
