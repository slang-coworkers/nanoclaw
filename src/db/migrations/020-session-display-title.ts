import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

export const migration020: Migration = {
  version: 20,
  name: 'session-display-title',
  up(db: Database.Database) {
    const cols = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('display_title')) db.exec('ALTER TABLE sessions ADD COLUMN display_title TEXT');
    if (!names.has('title_source')) db.exec('ALTER TABLE sessions ADD COLUMN title_source TEXT');
    if (!names.has('title_updated_at')) db.exec('ALTER TABLE sessions ADD COLUMN title_updated_at TEXT');
  },
};
