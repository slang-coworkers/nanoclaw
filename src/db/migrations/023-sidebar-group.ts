import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Sidebar grouping dimension for the dashboard coworker list.
 *
 * `sidebar_group`:
 *   NULL or 'prod' — the shared "prod" group (default for all existing
 *                    coworkers; no behavior change on upgrade).
 *   any other value — a user id (e.g. "dashboard:user1"). The coworker is
 *                     grouped under that user in the dashboard sidebar.
 *
 * Additive and non-destructive — display-only; does not affect routing or
 * access control. Idempotent so it is safe under the merged deployment
 * schema where other branches may already have added the column.
 */
export const migration023: Migration = {
  version: 23,
  name: 'sidebar-group',
  up(db: Database.Database) {
    const cols = db.prepare('PRAGMA table_info(agent_groups)').all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('sidebar_group')) db.exec('ALTER TABLE agent_groups ADD COLUMN sidebar_group TEXT');
  },
};
