import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { SqliteDriver } from '../drivers/sqlite.js';
import { migration930 } from './930-pending-reviewable-prs.js';
import { migration951 } from './951-pending-reviewable-ordering.js';

/** Return a database with the table as migration 930 created it. */
async function parkTableAt930(): Promise<{ raw: Database.Database; db: SqliteDriver }> {
  const raw = new Database(':memory:');
  const db = new SqliteDriver(raw);
  if (migration930.sqliteOnly) throw new Error('migration930 is portable — expected the DbDriver signature');
  await migration930.up(db);
  return { raw, db };
}

function insertParked(raw: Database.Database, prNumber: number, rawEventJson: string): void {
  raw
    .prepare(
      `INSERT INTO pending_reviewable_prs (repo, pr_number, head_sha, reason, raw_event_json, parked_at)
       VALUES ('shader-slang/slang', ?, 'abc', 'synchronize', ?, '2026-11-16T06:51:30.000Z')`,
    )
    .run(prNumber, rawEventJson);
}

async function up(db: SqliteDriver): Promise<void> {
  if (migration951.sqliteOnly) throw new Error('migration951 is portable — expected the DbDriver signature');
  await migration951.up(db);
}

describe('migration951 — pending_reviewable_prs ordering', () => {
  it('backfills pr_updated_at from the stored webhook body, normalized', async () => {
    const { raw, db } = await parkTableAt930();
    const body = JSON.stringify({ action: 'synchronize', pull_request: { updated_at: '2026-11-15T18:51:44Z' } });
    insertParked(raw, 14495, JSON.stringify({ rawBody: body, headSha: 'abc' }));

    await up(db);

    expect(raw.prepare('SELECT pr_updated_at, released_at FROM pending_reviewable_prs').get()).toEqual({
      pr_updated_at: '2026-11-15T18:51:44.000Z',
      released_at: null,
    });
  });

  it('leaves pr_updated_at NULL when the stored row has no readable timestamp', async () => {
    const { raw, db } = await parkTableAt930();
    insertParked(raw, 1, '{}');
    insertParked(raw, 2, 'not json');
    insertParked(raw, 3, JSON.stringify({ rawBody: '{"pull_request":{}}' }));

    await up(db);

    const rows = raw.prepare('SELECT pr_updated_at FROM pending_reviewable_prs ORDER BY pr_number').all();
    expect(rows).toEqual([{ pr_updated_at: null }, { pr_updated_at: null }, { pr_updated_at: null }]);
  });

  it('is safe to re-run', async () => {
    const { db } = await parkTableAt930();
    await up(db);
    await expect(up(db)).resolves.toBeUndefined();
  });
});
