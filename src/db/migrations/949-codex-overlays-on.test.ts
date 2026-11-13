import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { SqliteDriver } from '../drivers/sqlite.js';
import { migration949 } from './949-codex-overlays-on.js';

async function run(raw: Database.Database): Promise<void> {
  if (migration949.sqliteOnly) throw new Error('migration949 is portable — expected the DbDriver signature');
  await migration949.up(new SqliteDriver(raw));
}

describe('migration949 — overlays back on for Codex groups', () => {
  it('clears the switch on Codex groups only', async () => {
    const db = new Database(':memory:');
    db.exec(
      `CREATE TABLE agent_groups (id TEXT PRIMARY KEY, agent_provider TEXT, disable_overlays INTEGER NOT NULL DEFAULT 0)`,
    );
    const add = db.prepare('INSERT INTO agent_groups (id, agent_provider, disable_overlays) VALUES (?, ?, ?)');
    add.run('codex-off', 'codex', 1);
    add.run('codex-on', 'codex', 0);
    add.run('claude-off', null, 1);
    add.run('opencode-off', 'opencode', 1);

    await run(db);
    await run(db); // idempotent

    const rows = db.prepare('SELECT id, disable_overlays FROM agent_groups ORDER BY id').all();
    expect(rows).toEqual([
      { id: 'claude-off', disable_overlays: 1 },
      { id: 'codex-off', disable_overlays: 0 },
      { id: 'codex-on', disable_overlays: 0 },
      { id: 'opencode-off', disable_overlays: 1 },
    ]);
  });
});
