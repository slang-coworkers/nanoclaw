import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Sidebar grouping dimension for the dashboard coworker list. Additive,
 * non-destructive, display-only; idempotent so it is safe under the merged
 * deployment schema. Backfills the column that createAgentGroup already writes.
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
