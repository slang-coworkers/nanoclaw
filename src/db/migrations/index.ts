import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import type Database from 'better-sqlite3';

import { log } from '../../log.js';
import type { DbDriver } from '../driver.js';
import { sqliteRaw } from '../drivers/sqlite.js';

interface MigrationBase {
  version: number;
  /** Permanent applied identity. Never rename a migration after release. */
  name: string;
  /**
   * Names of migrations that MUST run before this one. The loader
   * topologically sorts so declared dependencies always run first, even when
   * `version` numbers would otherwise interleave (numeric migrations vs
   * `module-*` files hand-picking version-number gaps).
   */
  dependsOn?: string[];
  /**
   * Run with foreign_keys=OFF. Required for table recreates (SQLite can't
   * drop a table-level UNIQUE without DROP+RENAME, and DROP fails FK
   * integrity when child rows exist — see migration 011's header).
   * PRAGMA foreign_keys is a no-op inside a transaction, so the runner
   * toggles it around the transaction and runs PRAGMA foreign_key_check
   * inside it, so violations roll the migration back.
   */
  disableForeignKeys?: boolean;
}

export interface PortableMigration extends MigrationBase {
  sqliteOnly?: false;
  up: (db: DbDriver) => void | Promise<void>;
}

export interface SqliteOnlyMigration extends MigrationBase {
  sqliteOnly: true;
  up: (db: Database.Database) => void | Promise<void>;
}

export type Migration = PortableMigration | SqliteOnlyMigration;

export type MigrationMode = 'auto' | 'validate' | 'migrate';

export interface MigrationRunOptions {
  mode?: MigrationMode;
}

/**
 * Public module migrations use a core-reserved, owner-qualified identity so
 * independent modules may reuse local migration names without colliding.
 */
export type ModuleMigrationName = `module:${string}:${string}`;
export type ModuleMigration = (Omit<PortableMigration, 'name'> | Omit<SqliteOnlyMigration, 'name'>) & {
  name: ModuleMigrationName;
};

// Migrations are discovered at module load from adjacent files named
// `<version>-<slug>.{ts,js}` (e.g. `007-hook-events.ts`). This means a
// project branch can add a migration by dropping a file in this directory
// without editing any central registry — keeping the registry out of the
// merge path when two project branches ship alongside one another.
//
// Each migration file must export exactly one value whose shape matches
// the `Migration` interface. The export name is irrelevant — we pick it
// by shape, so conventional names like `migration007` still work.
function isMigration(value: unknown): value is Migration {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Migration).version === 'number' &&
    typeof (value as Migration).name === 'string' &&
    typeof (value as Migration).up === 'function'
  );
}

async function loadMigrations(): Promise<Migration[]> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const files = fs
    .readdirSync(here)
    // A migration file is `<version>-<slug>.{ts,js}`. Exclude `.d.ts` type
    // stubs and — critically — `.test.ts` / `.spec.ts` co-located test files:
    // those match the version-slug shape but export test suites, not a
    // Migration, and loading one throws "does not export a Migration-shaped
    // value", which fails migration setup for EVERY suite that runs migrations.
    .filter((f) => /^(\d+|module)-.*\.(js|ts)$/.test(f) && !f.endsWith('.d.ts') && !/\.(test|spec)\.(js|ts)$/.test(f))
    .sort();

  const out: Migration[] = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(here, file)).href);
    const found = Object.values(mod).find(isMigration);
    if (!found) {
      throw new Error(`Migration file ${file} does not export a Migration-shaped value`);
    }
    out.push(found);
  }

  const names = new Set(out.map((m) => m.name));
  for (const m of out) {
    for (const dep of m.dependsOn ?? []) {
      if (!names.has(dep)) {
        throw new Error(
          `Migration '${m.name}' declares dependsOn '${dep}' but no migration with that name is registered`,
        );
      }
    }
  }

  // Topological sort: primary key is dependsOn, tiebreaker is version.
  // This is what actually makes the registry safe when numeric migrations
  // and module-* migrations pick version numbers from overlapping ranges
  // (numeric uses 1..n; module-* has historically picked 3/4/7 at random).
  // With dependsOn, a migration's prerequisites are declared, not assumed.
  const byName = new Map(out.map((m) => [m.name, m]));
  const remaining = new Set(out.map((m) => m.name));
  const sorted: Migration[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .map((n) => byName.get(n) as Migration)
      .filter((m) => (m.dependsOn ?? []).every((d) => !remaining.has(d)))
      .sort((a, b) => a.version - b.version);
    if (ready.length === 0) {
      throw new Error(`Migration dependency cycle among: ${[...remaining].join(', ')}`);
    }
    for (const m of ready) {
      sorted.push(m);
      remaining.delete(m.name);
    }
  }

  const versions = sorted.map((m) => m.version);
  const dupes = versions.filter((v, i) => versions.indexOf(v) !== i);
  if (dupes.length > 0) {
    throw new Error(`Duplicate migration versions: ${dupes.join(', ')}`);
  }

  return sorted;
}

export const migrations: Migration[] = await loadMigrations();

/**
 * Migrations contributed by self-registering modules.
 *
 * When multiple migrations are pending, built-in migrations run first. Module
 * migrations are not interleaved with built-ins by `version`; they follow the
 * deterministic import order of their owning modules because the modules
 * barrel uses explicit side-effect imports.
 */
const moduleMigrations: Migration[] = [];
const MODULE_MIGRATION_NAME_RE = /^module:[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._-]*$/;

export function registerMigration(migration: ModuleMigration): void {
  if (!MODULE_MIGRATION_NAME_RE.test(migration.name)) {
    throw new Error(
      `Module migration "${migration.name}" must use "module:<module-id>:<migration-id>" and remain stable after release`,
    );
  }
  if ([...migrations, ...moduleMigrations].some((candidate) => candidate.name === migration.name)) {
    throw new Error(`Migration "${migration.name}" already registered`);
  }
  moduleMigrations.push(migration);
}

export function getRegisteredMigrations(): readonly Migration[] {
  return [...migrations, ...moduleMigrations];
}

/** Row shape of PRAGMA foreign_key_check. Child rowids are stable across a
 *  parent-table recreate (child tables aren't touched), so this JSON identity
 *  is a reliable before/after diff key. */
interface FkViolation {
  table: string;
  rowid: number | null;
  parent: string;
  fkid: number;
}

const fkIdentity = (v: FkViolation): string =>
  JSON.stringify({ table: v.table, rowid: v.rowid, parent: v.parent, fkid: v.fkid });

export async function runMigrations(
  db: DbDriver,
  list: readonly Migration[] = getRegisteredMigrations(),
  options: MigrationRunOptions = {},
): Promise<void> {
  const mode =
    options.mode === undefined || options.mode === 'auto'
      ? db.dialect === 'sqlite'
        ? 'migrate'
        : 'validate'
      : options.mode;

  if (mode === 'validate') {
    if (!(await db.hasTable('schema_version'))) {
      throw new Error('Central DB schema is not initialized; run `pnpm run migrate` with the migration role');
    }
    const applied = new Set((await db.all<{ name: string }>('SELECT name FROM schema_version')).map((row) => row.name));
    const pending = list.filter((migration) => !applied.has(migration.name));
    if (pending.length > 0) {
      throw new Error(
        `Central DB has pending migrations (${pending.map((migration) => migration.name).join(', ')}); run \`pnpm run migrate\``,
      );
    }
    return;
  }

  const migrate = async (): Promise<void> => {
    await db.migrationHooks?.bootstrapSchema?.(db);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name    TEXT NOT NULL,
        applied TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_version_name ON schema_version(name);
    `);

    // Uniqueness is keyed on `name`, not `version`. This lets module
    // migrations (added later by install skills) pick arbitrary version
    // numbers without coordinating across modules. `version` stays on
    // the Migration object as an ordering hint within the barrel array;
    // the stored `version` column is auto-assigned at insert time as an
    // applied-order number.
    const applied = new Set((await db.all<{ name: string }>('SELECT name FROM schema_version')).map((row) => row.name));
    const pending = list.filter((migration) => !applied.has(migration.name));
    if (pending.length === 0) return;

    log.info('Running migrations', { count: pending.length });
    for (const migration of pending) await applyMigration(db, migration);
  };

  if (db.migrationHooks?.withMigrationLock) await db.migrationHooks.withMigrationLock(migrate);
  else await migrate();
}

async function applyMigration(db: DbDriver, migration: Migration): Promise<void> {
  const override = db.migrationHooks?.migrationOverrides?.get(migration.name);
  const sqliteOnly = override ? false : migration.sqliteOnly === true;
  const disableForeignKeys = override ? false : migration.disableForeignKeys === true;
  if ((sqliteOnly || disableForeignKeys) && db.dialect !== 'sqlite') {
    throw new Error(`Migration "${migration.name}" is SQLite-only; port it or provide a backend migration override`);
  }

  const raw = sqliteOnly || disableForeignKeys ? sqliteRaw(db) : null;
  // Table recreates need FK enforcement off for the DROP+RENAME window.
  // The pragma must be toggled OUTSIDE the transaction (it's a silent
  // no-op inside one); foreign_key_check runs INSIDE so a violating
  // recreate rolls back atomically with nothing committed.
  if (disableForeignKeys) raw!.pragma('foreign_keys = OFF');
  try {
    await db.transaction(async () => {
      // Snapshot violations BEFORE up() runs: live DBs can carry latent
      // FK orphans. A migration must fail only for violations it introduces.
      const preexisting = disableForeignKeys
        ? new Set((raw!.pragma('foreign_key_check') as FkViolation[]).map(fkIdentity))
        : null;
      if (override) await override.up(db);
      else if (migration.sqliteOnly) await migration.up(raw!);
      else await migration.up(db);
      if (disableForeignKeys && preexisting) {
        const violations = raw!.pragma('foreign_key_check') as FkViolation[];
        const introduced = violations.filter((violation) => !preexisting.has(fkIdentity(violation)));
        const carried = violations.length - introduced.length;
        if (carried > 0) {
          log.warn('Pre-existing FK violations carried through migration (not introduced by it)', {
            migration: migration.name,
            count: carried,
          });
        }
        if (introduced.length > 0) {
          throw new Error(`migration ${migration.name} left FK violations: ${JSON.stringify(introduced.slice(0, 5))}`);
        }
      }
      const next = (await db.get<{ v: number }>('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM schema_version'))!.v;
      await db.run(
        'INSERT INTO schema_version (version, name, applied) VALUES (?, ?, ?)',
        next,
        migration.name,
        new Date().toISOString(),
      );
    });
  } finally {
    if (disableForeignKeys) raw!.pragma('foreign_keys = ON');
  }
  log.info('Migration applied', { name: migration.name });
}
