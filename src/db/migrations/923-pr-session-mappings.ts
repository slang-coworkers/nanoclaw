import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration923: Migration = {
  version: 923,
  name: 'pr-session-mappings',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pr_session_mappings (
        repo            TEXT NOT NULL,
        pr_number       INTEGER NOT NULL,
        agent_group_id  TEXT NOT NULL,
        session_id      TEXT NOT NULL,
        thread_id       TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      );
      CREATE INDEX IF NOT EXISTS idx_pr_map_lookup ON pr_session_mappings(repo, pr_number);
    `);
  },
};
