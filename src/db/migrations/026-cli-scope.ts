import type Database from 'better-sqlite3';
import type { Migration } from './index.js';

export const migration026: Migration = {
  version: 26,
  name: 'cli-scope',
  dependsOn: ['container-configs'],
  up(db: Database.Database) {
    db.prepare("ALTER TABLE container_configs ADD COLUMN cli_scope TEXT NOT NULL DEFAULT 'group'").run();
  },
};
