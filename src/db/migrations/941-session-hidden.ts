import { addColumnIfMissing } from './column-guard.js';
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
export const migration941: Migration = {
  // Numbered 941, not 022, for the reason 88c1bf5a reserved the 900+ range:
  // this is a FORK migration and version 22 is already taken on nv-main by
  // 022-messaging-group-detached. `name` is deliberately UNCHANGED — it is the
  // permanent applied identity in `schema_version`, so a renumber must never
  // touch it or every install would re-run this as a brand-new migration.
  version: 941,
  name: 'session-hidden-pinned',
  async up(db) {
    await addColumnIfMissing(db, 'sessions', 'hidden_at TEXT');
    await addColumnIfMissing(db, 'sessions', 'pinned_at TEXT');
  },
};
