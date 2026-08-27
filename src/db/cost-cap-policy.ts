/**
 * Accessor for `cost_cap_policy` — the runtime-configurable Tier-2 cost cap.
 *
 * See migration `938-cost-cap-policy`. One row per scope keyed by `group_folder`:
 * the empty string `''` is the fleet-wide row (its `ceiling_usd` is the fleet
 * ceiling); a non-empty folder is a per-group override (`ceiling_usd` and/or
 * `cap_usd`). NULL amounts mean "no DB override — fall through to env/thresholds".
 *
 * READS are fail-soft: `getCostCapPolicy` / `listCostCapPolicies` return
 * empty/undefined when the DB is uninitialized or the table is missing, so the
 * cost resolvers (`resolveCostCapT2Usd`, `resolveCostCeilingT2Usd`) can call them
 * unconditionally and simply fall back to the env/thresholds chain — preserving
 * back-compat and keeping hermetic (no-DB) tests green. WRITES require an
 * initialized DB (they run host-side, behind the guarded `ncl cost-cap` gate).
 */
import type { DbDriver } from './driver.js';

import { getDb, hasTable } from './connection.js';

/** Sentinel `group_folder` value for the fleet-wide row (no real folder is empty). */
export const FLEET_SCOPE = '';

export interface CostCapPolicyRow {
  /** '' = fleet-wide; otherwise the agent group's workspace folder. */
  group_folder: string;
  /** Tier-2 hard ceiling override (USD). NULL = no override; 0 = explicitly no ceiling. */
  ceiling_usd: number | null;
  /** Per-session cap override (USD). NULL = no override. Only meaningful on group rows. */
  cap_usd: number | null;
  updated_at: string;
  updated_by: string | null;
}

const COLS = 'group_folder, ceiling_usd, cap_usd, updated_at, updated_by';

/** The DB iff it is initialized and the table exists; otherwise null (fail-soft). */
async function readableDb(): Promise<DbDriver | null> {
  try {
    const db = getDb();
    return (await hasTable(db, 'cost_cap_policy')) ? db : null;
  } catch {
    return null; // DB not initialized (e.g. a hermetic unit test)
  }
}

/** Normalize an optional folder to the row key ('' = fleet). */
function scopeKey(groupFolder?: string | null): string {
  return groupFolder && groupFolder.length > 0 ? groupFolder : FLEET_SCOPE;
}

/** Read one policy row (fleet when `groupFolder` is empty/undefined). Fail-soft. */
export async function getCostCapPolicy(groupFolder?: string | null): Promise<CostCapPolicyRow | undefined> {
  const db = await readableDb();
  if (!db) return undefined;
  return db.get<CostCapPolicyRow>(`SELECT ${COLS} FROM cost_cap_policy WHERE group_folder = ?`, scopeKey(groupFolder));
}

/** All policy rows (fleet first, then group overrides by folder). Fail-soft → []. */
export async function listCostCapPolicies(): Promise<CostCapPolicyRow[]> {
  const db = await readableDb();
  if (!db) return [];
  return db.all<CostCapPolicyRow>(
    `SELECT ${COLS} FROM cost_cap_policy ORDER BY (group_folder = '') DESC, group_folder ASC`,
  );
}

/**
 * Upsert a policy row. Only the provided amounts change — an omitted
 * `ceilingUsd` / `capUsd` leaves that column as it was (a fresh row's omitted
 * column is NULL). Requires an initialized DB. Returns the resulting row.
 */
export async function setCostCapPolicy(opts: {
  groupFolder?: string | null;
  ceilingUsd?: number;
  capUsd?: number;
  updatedBy?: string | null;
}): Promise<CostCapPolicyRow> {
  const db = getDb();
  const key = scopeKey(opts.groupFolder);
  const existing = await db.get<CostCapPolicyRow>(`SELECT ${COLS} FROM cost_cap_policy WHERE group_folder = ?`, key);

  const ceiling = opts.ceilingUsd !== undefined ? opts.ceilingUsd : (existing?.ceiling_usd ?? null);
  const cap = opts.capUsd !== undefined ? opts.capUsd : (existing?.cap_usd ?? null);
  const row: CostCapPolicyRow = {
    group_folder: key,
    ceiling_usd: ceiling,
    cap_usd: cap,
    updated_at: new Date().toISOString(),
    updated_by: opts.updatedBy ?? null,
  };

  await db.run(
    `INSERT INTO cost_cap_policy (group_folder, ceiling_usd, cap_usd, updated_at, updated_by)
     VALUES (@group_folder, @ceiling_usd, @cap_usd, @updated_at, @updated_by)
     ON CONFLICT(group_folder) DO UPDATE SET
       ceiling_usd = @ceiling_usd,
       cap_usd     = @cap_usd,
       updated_at  = @updated_at,
       updated_by  = @updated_by`,
    row,
  );

  return row;
}

/** Delete a policy row (restores env/thresholds fallback). Returns true if a row was removed. */
export async function clearCostCapPolicy(groupFolder?: string | null): Promise<boolean> {
  const db = getDb();
  const result = await db.run('DELETE FROM cost_cap_policy WHERE group_folder = ?', scopeKey(groupFolder));
  return result.changes > 0;
}
