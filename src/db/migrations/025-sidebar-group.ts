import type { Migration } from './index.js';

/**
 * Sidebar grouping dimension for the dashboard coworker list. Additive,
 * non-destructive, display-only. Backfills the column that createAgentGroup
 * already writes.
 *
 * Renumbered 23 -> 25 when upstream took 022/023. `name` is deliberately
 * unchanged: it is the applied identity in schema_version, so touching it would
 * re-run this on installs that already have the column.
 *
 * Bare ALTER, no PRAGMA probe: post-boundary migrations must be portable
 * (portability.test.ts bans PRAGMA), and the runner already applies each
 * migration exactly once per install by `name`.
 */
export const migration025: Migration = {
  version: 25,
  name: 'sidebar-group',
  async up(db) {
    await db.exec('ALTER TABLE agent_groups ADD COLUMN sidebar_group TEXT');
  },
};
