import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { migration937 } from './937-agent-group-paused.js';

function baseAgentGroups(): Database.Database {
  const db = new Database(':memory:');
  // The real table has many columns; the migration only touches `paused`, so a
  // minimal shape is enough to prove the ALTER and its default.
  db.exec(`CREATE TABLE agent_groups (id TEXT PRIMARY KEY, folder TEXT NOT NULL)`);
  return db;
}

describe('migration937 — agent_groups.paused', () => {
  it('adds the paused column as NOT NULL DEFAULT 0', () => {
    const db = baseAgentGroups();
    db.prepare('INSERT INTO agent_groups (id, folder) VALUES (?, ?)').run('ag-1', 'orchestrator');

    migration937.up(db);

    const col = db
      .prepare("SELECT name, type, \"notnull\", dflt_value FROM pragma_table_info('agent_groups') WHERE name='paused'")
      .get() as { name: string; type: string; notnull: number; dflt_value: string } | undefined;
    expect(col).toBeDefined();
    expect(col!.type).toBe('INTEGER');
    expect(col!.notnull).toBe(1);
    expect(String(col!.dflt_value)).toBe('0');
  });

  it('backfills existing rows to 0 (not paused) — no behaviour change for current groups', () => {
    const db = baseAgentGroups();
    db.prepare('INSERT INTO agent_groups (id, folder) VALUES (?, ?)').run('ag-1', 'orchestrator');
    db.prepare('INSERT INTO agent_groups (id, folder) VALUES (?, ?)').run('ag-2', 'slang-fixer');

    migration937.up(db);

    const rows = db.prepare('SELECT paused FROM agent_groups ORDER BY id').all() as { paused: number }[];
    expect(rows.map((r) => r.paused)).toEqual([0, 0]);
  });

  it('is idempotent — re-running does not throw or duplicate the column', () => {
    const db = baseAgentGroups();
    migration937.up(db);
    expect(() => migration937.up(db)).not.toThrow();
    const n = (
      db.prepare("SELECT count(*) AS c FROM pragma_table_info('agent_groups') WHERE name='paused'").get() as {
        c: number;
      }
    ).c;
    expect(n).toBe(1);
  });

  it('a paused row round-trips 0/1', () => {
    const db = baseAgentGroups();
    migration937.up(db);
    db.prepare('INSERT INTO agent_groups (id, folder, paused) VALUES (?, ?, 1)').run('ag-9', 'paused-group');
    const paused = (db.prepare('SELECT paused FROM agent_groups WHERE id=?').get('ag-9') as { paused: number }).paused;
    expect(paused).toBe(1);
  });
});
