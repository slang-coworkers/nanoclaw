import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, initSqliteTestDb } from '../db/connection.js';
import { sqliteRaw } from './drivers/sqlite.js';
import { runMigrations } from './index.js';

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface TableInfo {
  name: string;
}

interface IndexInfo {
  name: string;
}

beforeEach(async () => {
  await initSqliteTestDb();
});

afterEach(async () => {
  await closeDb();
});

describe('migration 006 — coworker fields', () => {
  it('adds coworker_type and allowed_mcp_tools columns to agent_groups', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const columns = sqliteRaw(db).prepare('PRAGMA table_info(agent_groups)').all() as ColumnInfo[];
    const names = columns.map((c) => c.name);

    expect(names).toContain('coworker_type');
    expect(names).toContain('allowed_mcp_tools');

    const coworker = columns.find((c) => c.name === 'coworker_type')!;
    expect(coworker.type.toUpperCase()).toBe('TEXT');
    expect(coworker.notnull).toBe(0); // nullable — old rows predate the column

    const tools = columns.find((c) => c.name === 'allowed_mcp_tools')!;
    expect(tools.type.toUpperCase()).toBe('TEXT');
    expect(tools.notnull).toBe(0);
  });

  it('records version 6 in schema_version', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const row = sqliteRaw(db).prepare("SELECT name FROM schema_version WHERE name = 'coworker-fields'").get() as
      | { name: string }
      | undefined;
    expect(row?.name).toBe('coworker-fields');
  });
});

describe('migration 007 — hook_events table', () => {
  it('creates the hook_events table with the documented columns', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const table = sqliteRaw(db)
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hook_events'")
      .get() as TableInfo | undefined;
    expect(table).toBeDefined();

    const columns = sqliteRaw(db).prepare('PRAGMA table_info(hook_events)').all() as ColumnInfo[];
    const names = columns.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        'agent_id',
        'agent_type',
        'created_at',
        'cwd',
        'event',
        'extra',
        'group_folder',
        'id',
        'message',
        'session_id',
        'timestamp',
        'tool',
        'tool_input',
        'tool_response',
        'tool_use_id',
        'transcript_path',
      ].sort(),
    );

    const id = columns.find((c) => c.name === 'id')!;
    expect(id.pk).toBe(1);

    // NOT NULL invariants for the host-ingest contract (hook-event POST body).
    const groupFolder = columns.find((c) => c.name === 'group_folder')!;
    expect(groupFolder.notnull).toBe(1);
    const event = columns.find((c) => c.name === 'event')!;
    expect(event.notnull).toBe(1);
    const ts = columns.find((c) => c.name === 'timestamp')!;
    expect(ts.notnull).toBe(1);
  });

  it('creates indexes on group_folder, session_id, tool_use_id, and timestamp', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const indexes = sqliteRaw(db)
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='hook_events'")
      .all() as IndexInfo[];
    const indexNames = indexes.map((i) => i.name);

    expect(indexNames).toContain('idx_he_group');
    expect(indexNames).toContain('idx_he_session');
    expect(indexNames).toContain('idx_he_tool_use');
    expect(indexNames).toContain('idx_he_ts');
  });

  it('inserts default timestamps for created_at', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    sqliteRaw(db)
      .prepare(`INSERT INTO hook_events (group_folder, event, timestamp) VALUES (?, ?, ?)`)
      .run('test-group', 'PreToolUse', Date.now());

    const row = sqliteRaw(db).prepare('SELECT created_at FROM hook_events LIMIT 1').get() as { created_at: string };
    expect(typeof row.created_at).toBe('string');
    expect(row.created_at.length).toBeGreaterThan(0);
  });

  it('records hook-events in schema_version', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const row = sqliteRaw(db).prepare("SELECT name FROM schema_version WHERE name = 'hook-events'").get() as
      | { name: string }
      | undefined;
    expect(row?.name).toBe('hook-events');
  });
});

describe('migration 027 — pr-mapping owner_instance', () => {
  it('adds owner_instance column with default prod', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const columns = sqliteRaw(db).prepare('PRAGMA table_info(pr_session_mappings)').all() as ColumnInfo[];
    const owner = columns.find((c) => c.name === 'owner_instance');

    expect(owner).toBeDefined();
    expect(owner!.type.toUpperCase()).toBe('TEXT');
    expect(owner!.notnull).toBe(1);

    // existing rows (if any) should backfill to 'prod' via the ALTER TABLE default
    sqliteRaw(db)
      .prepare(
        `INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at)
       VALUES ('foo/bar', 1, 'g1', 's1', 't1', datetime('now'))`,
      )
      .run();
    const row = sqliteRaw(db).prepare("SELECT owner_instance FROM pr_session_mappings WHERE repo = 'foo/bar'").get() as
      | { owner_instance: string }
      | undefined;
    expect(row?.owner_instance).toBe('prod');
  });

  it('creates idx_pr_map_owner index', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const indexes = sqliteRaw(db).prepare('PRAGMA index_list(pr_session_mappings)').all() as IndexInfo[];
    expect(indexes.map((i) => i.name)).toContain('idx_pr_map_owner');
  });

  it('records pr-mapping-owner-instance in schema_version', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);

    const row = sqliteRaw(db)
      .prepare("SELECT name FROM schema_version WHERE name = 'pr-mapping-owner-instance'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('pr-mapping-owner-instance');
  });
});

describe('runMigrations', () => {
  it('applies migrations in order and is idempotent', async () => {
    const db = await initSqliteTestDb();
    await runMigrations(db);
    const firstCount = (sqliteRaw(db).prepare('SELECT COUNT(*) as c FROM schema_version').get() as { c: number }).c;

    await runMigrations(db);
    const secondCount = (sqliteRaw(db).prepare('SELECT COUNT(*) as c FROM schema_version').get() as { c: number }).c;

    expect(firstCount).toBe(secondCount);
    expect(firstCount).toBeGreaterThanOrEqual(7);
  });
});
