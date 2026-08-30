/**
 * Orphan-dir reconciler. DELETE /api/coworkers/<folder> without
 * `deleteData=1` preserves the `groups/<folder>/` directory so work-in-
 * progress reports/critiques aren't destroyed along with the DB row.
 * Over time those orphans accumulate. This module scans at host startup
 * and emits a single WARN listing any folders on disk that have no
 * matching `agent_groups.folder` — operators can review via `logs/` and
 * delete with explicit intent (e.g. `rm -rf groups/<folder>`).
 *
 * Never auto-deletes: there is no reliable way to distinguish "empty
 * stub" from "user committed half a day of work in here", and getting
 * it wrong silently destroys work.
 */
import fs from 'fs';

import { GROUPS_DIR } from './config.js';
import type { DbDriver } from './db/driver.js';
import { log } from './log.js';

export async function findOrphanGroupDirs(db: DbDriver): Promise<string[]> {
  if (!fs.existsSync(GROUPS_DIR)) return [];
  const known = new Set<string>(
    (await db.all<{ folder: string }>('SELECT folder FROM agent_groups')).map((r) => r.folder),
  );
  const orphans: string[] = [];
  for (const entry of fs.readdirSync(GROUPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.')) continue;
    if (!known.has(entry.name)) orphans.push(entry.name);
  }
  return orphans.sort();
}

export async function logOrphanGroupDirs(db: DbDriver): Promise<void> {
  const orphans = await findOrphanGroupDirs(db);
  if (orphans.length === 0) return;
  log.warn('Orphan group directories detected — delete manually if not needed', {
    count: orphans.length,
    folders: orphans,
    hint: `rm -rf ${orphans.map((f) => `groups/${f}`).join(' ')}`,
  });
}
