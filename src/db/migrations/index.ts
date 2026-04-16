import type Database from 'better-sqlite3';

import { log } from '../../log.js';
import { migration001 } from './001-initial.js';
import { migration002 } from './002-chat-sdk-state.js';
import { migration003 } from './003-pending-approvals.js';
import { migration004 } from './004-agent-destinations.js';
import { migration005 } from './005-pending-credentials.js';
import { migration006 } from './006-coworker-fields.js';
import { migration007 } from './007-hook-events.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied TEXT NOT NULL
    );
  `);

  const currentVersion =
    (db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null })?.v ?? 0;

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  log.info('Running migrations', {
    from: currentVersion,
    to: pending[pending.length - 1].version,
    count: pending.length,
  });

  for (const m of pending) {
    db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_version (version, name, applied) VALUES (?, ?, ?)').run(
        m.version,
        m.name,
        new Date().toISOString(),
      );
    })();
    log.info('Migration applied', { version: m.version, name: m.name });
  }
}
