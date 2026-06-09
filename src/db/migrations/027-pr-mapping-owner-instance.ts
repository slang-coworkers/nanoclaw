import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration027: Migration = {
  version: 27,
  name: 'pr-mapping-owner-instance',
  dependsOn: ['pr-session-mappings'],
  up(db: Database.Database) {
    const cols = db.prepare('PRAGMA table_info(pr_session_mappings)').all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'owner_instance')) {
      db.exec(`ALTER TABLE pr_session_mappings ADD COLUMN owner_instance TEXT NOT NULL DEFAULT 'prod'`);
    }
    db.exec(`CREATE INDEX IF NOT EXISTS idx_pr_map_owner ON pr_session_mappings(owner_instance)`);
  },
};
