/**
 * Portable "does this table have this column?" probe.
 *
 * The fork's helpers asked with `PRAGMA table_info(...)`, which is SQLite-only
 * and unavailable through the async `DbDriver` boundary. Two portable routes:
 * the driver's own `columnOwners` when it implements it, else a zero-row SELECT
 * of the column — every engine rejects an unknown column at prepare time, and
 * `LIMIT 0` means no rows are read on the success path.
 *
 * Used by the additive-column readers (migration 936's `dedupe_key` /
 * `release_recorded_at`) that must behave on a host which has not migrated yet.
 */
import type { DbDriver } from './driver.js';

export async function hasColumn(db: DbDriver, table: string, column: string): Promise<boolean> {
  if (db.columnOwners) return (await db.columnOwners(column)).includes(table);
  try {
    await db.all(`SELECT ${column} FROM ${table} LIMIT 0`);
    return true;
  } catch {
    return false;
  }
}
