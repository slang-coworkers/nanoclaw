import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Operator-driven visibility + pinning on sessions. Non-destructive — the
 * row and its on-disk artifacts stay in place either way; these columns
 * only affect how the dashboard lists and sorts sessions.
 *
 * `hidden_at`:
 *   NULL     — visible (default).
 *   non-null — hidden at that ISO timestamp. Dashboard's default session
 *              listing filters these out; an "expanded" view surfaces them
 *              with an unhide action. A later retention job can prune rows
 *              that have been hidden for > N days.
 *
 * `pinned_at`:
 *   NULL     — unpinned (default).
 *   non-null — pinned at that ISO timestamp. Dashboard sorts pinned rows
 *              to the top of Other Sessions regardless of last-activity.
 */
export const migration022: Migration = {
  version: 22,
  name: 'session-hidden-pinned',
  up(db: Database.Database) {
    const cols = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('hidden_at')) db.exec('ALTER TABLE sessions ADD COLUMN hidden_at TEXT');
    if (!names.has('pinned_at')) db.exec('ALTER TABLE sessions ADD COLUMN pinned_at TEXT');
  },
};
