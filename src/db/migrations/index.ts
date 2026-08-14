import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import type Database from 'better-sqlite3';

import { log } from '../../log.js';

export interface Migration {
  version: number;
  name: string;
  /**
   * Names of migrations that MUST run before this one — e.g. a migration
   * that references a column added by another migration should list that
   * other migration's `name` here. The loader topologically sorts so
   * declared dependencies always run first, even when `version` numbers
   * would otherwise interleave (numeric migrations vs `module-*` files
   * hand-picking version-number gaps).
   *
   * If a migration assumes an older migration's schema and doesn't
   * declare it here, the assumption is a latent bug: it works today only
   * because someone happened to pick the right version number. Declare
   * the edge.
   */
  dependsOn?: string[];
  up: (db: Database.Database) => void;
  /**
   * Run with foreign_keys=OFF. Required for table recreates (SQLite can't
   * drop a table-level constraint without DROP+RENAME, and DROP fails FK
   * integrity when child rows exist). PRAGMA foreign_keys is a no-op inside
   * a transaction, so the runner toggles it around the transaction and runs
   * PRAGMA foreign_key_check inside it so violations roll the migration back.
   */
  disableForeignKeys?: boolean;
}

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
    .filter(
      (f) => /^(\d+|module)-.*\.(js|ts)$/.test(f) && !f.endsWith('.d.ts') && !/\.(test|spec)\.(js|ts)$/.test(f),
    )
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

/** Row shape of PRAGMA foreign_key_check — JSON identity is a stable before/after diff key. */
interface FkViolation {
  table: string;
  rowid: number | null;
  parent: string;
  fkid: number;
}

const fkIdentity = (v: FkViolation): string =>
  JSON.stringify({ table: v.table, rowid: v.rowid, parent: v.parent, fkid: v.fkid });

export function runMigrations(db: Database.Database, list: Migration[] = migrations): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name    TEXT NOT NULL,
      applied TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_version_name ON schema_version(name);
  `);

  const applied = new Set<string>(
    (db.prepare('SELECT name FROM schema_version').all() as { name: string }[]).map((r) => r.name),
  );
  const pending = list.filter((m) => !applied.has(m.name));
  if (pending.length === 0) return;

  log.info('Running migrations', {
    from: applied.size,
    to: applied.size + pending.length,
    count: pending.length,
  });

  for (const m of pending) {
    // Table recreates need FK enforcement off for the DROP+RENAME window. The
    // pragma must be toggled OUTSIDE the transaction (no-op inside one);
    // foreign_key_check runs INSIDE so a violating recreate rolls back.
    if (m.disableForeignKeys) db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        // Snapshot violations BEFORE up(): a live DB can carry latent FK
        // orphans; the migration must only fail for violations it INTRODUCED.
        const preexisting = m.disableForeignKeys
          ? new Set((db.pragma('foreign_key_check') as FkViolation[]).map(fkIdentity))
          : null;
        m.up(db);
        if (m.disableForeignKeys && preexisting) {
          const violations = db.pragma('foreign_key_check') as FkViolation[];
          const introduced = violations.filter((v) => !preexisting.has(fkIdentity(v)));
          if (introduced.length > 0) {
            throw new Error(`migration ${m.name} left FK violations: ${JSON.stringify(introduced.slice(0, 5))}`);
          }
        }
        const next = (
          db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS v FROM schema_version').get() as { v: number }
        ).v;
        db.prepare('INSERT INTO schema_version (version, name, applied) VALUES (?, ?, ?)').run(
          next,
          m.name,
          new Date().toISOString(),
        );
      })();
    } finally {
      if (m.disableForeignKeys) db.pragma('foreign_keys = ON');
    }
    log.info('Migration applied', { version: m.version, name: m.name });
  }
}
