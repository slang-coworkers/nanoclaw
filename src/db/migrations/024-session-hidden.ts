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
 *
 * Renumbered 22 -> 24 when upstream took 022/023. `name` is deliberately
 * unchanged: it is the applied identity in schema_version, so touching it would
 * re-run this on installs that already have the columns.
 *
 * Bare ALTERs, no PRAGMA probe: post-boundary migrations must be portable
 * (portability.test.ts bans PRAGMA), and the runner already applies each
 * migration exactly once per install by `name`.
 */
export const migration024: Migration = {
  version: 24,
  name: 'session-hidden-pinned',
  async up(db) {
    await db.exec('ALTER TABLE sessions ADD COLUMN hidden_at TEXT');
    await db.exec('ALTER TABLE sessions ADD COLUMN pinned_at TEXT');
  },
};
