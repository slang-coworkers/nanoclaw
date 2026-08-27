/**
 * Idempotent `ALTER TABLE ... ADD COLUMN` for portable migrations.
 *
 * The fork's migrations guarded their ADD COLUMNs with a
 * `SELECT count(*) FROM pragma_table_info(...)` probe. `pragma_table_info` is
 * SQLite-specific, so keeping it would have forced every one of those
 * migrations to `sqliteOnly: true` — and `applyMigration` THROWS on a
 * SQLite-only migration whenever the central DB is not SQLite. That trades a
 * real capability for a guard we can express portably instead.
 *
 * Portable version: attempt the ALTER and swallow only the "already exists"
 * error. Every engine reports it (SQLite "duplicate column name", Postgres
 * "already exists", MySQL "Duplicate column name"), and anything else
 * re-throws so a genuine failure still fails the migration.
 *
 * The runner already skips migrations recorded in `schema_version`, so this is
 * belt-and-braces — it matters for the installs that applied these columns
 * before they were tracked, and for a re-run against a hand-repaired DB.
 */
import type { DbDriver } from '../driver.js';

const ALREADY_EXISTS = /duplicate column|already exists/i;

/** Add a column unless the table already has it. Safe to re-run. */
export async function addColumnIfMissing(db: DbDriver, table: string, columnDef: string): Promise<void> {
  try {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (err) {
    if (!ALREADY_EXISTS.test(String(err))) throw err;
  }
}
