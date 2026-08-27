import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

/**
 * Human-readable session titles. The slug (`main · dusky-meadow-drifts`)
 * is deterministic from the session id but carries no semantic meaning —
 * operators still have to open the session to see what it's about. The
 * three columns here let the dashboard render a short task description
 * alongside the slug:
 *   display_title     — 3-10 word task-shaped string (e.g. "Review PR #155")
 *   title_source      — 'auto' | 'heuristic' | 'manual'
 *                       'auto'      = placeholder until a real title lands
 *                       'heuristic' = derived from prompt + tool-call signals
 *                       'manual'    = operator override; never re-derived
 *   title_updated_at  — ISO timestamp of the last write, for race ordering
 *
 * Version 021 because 020 is already taken by a2a-session-sources.
 */
export const migration921: Migration = {
  version: 921,
  name: 'session-display-title',
  async up(db) {
    await addColumnIfMissing(db, 'sessions', 'display_title TEXT');
    await addColumnIfMissing(db, 'sessions', 'title_source TEXT');
    await addColumnIfMissing(db, 'sessions', 'title_updated_at TEXT');
  },
};
