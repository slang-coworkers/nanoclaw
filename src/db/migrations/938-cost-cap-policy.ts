import type { Migration } from './index.js';

/**
 * `cost_cap_policy` — runtime-configurable Tier-2 cost cap (NanoClaw #1 cost cap).
 *
 * Until now the Tier-2 hard ceiling lived ONLY in `NANOCLAW_COST_T2_CEILING_USD`
 * (a static `.env` value read at spawn) and the per-session cap auto-sourced from
 * `data/cost-thresholds.json`. Neither could be changed without a redeploy /
 * file edit. This table lets an elevated operator (or the `cli_scope=global`
 * orchestrator) set the values at runtime via `ncl cost-cap set`; the host reads
 * them at the next container spawn and materializes them into container.json.
 *
 * One row per scope, keyed by `group_folder`:
 *   - `group_folder = ''` (the empty string) is the FLEET-WIDE row. Its
 *     `ceiling_usd` is the fleet Tier-2 hard ceiling. (`''` is a safe sentinel:
 *     no real agent-group folder is empty, so it never collides with a group row.)
 *   - `group_folder = '<folder>'` is a PER-GROUP override — `ceiling_usd` and/or
 *     `cap_usd` override the fleet ceiling / auto-sourced cap for that one group.
 *     The folder is the group's workspace folder, matching the keys of
 *     `cost-thresholds.json` `perGroupP90Usd` (the resolvers key on folder).
 *
 * Both amount columns are NULLable: NULL means "no DB override — fall through to
 * the env / thresholds / default chain". A stored value (including `ceiling_usd`
 * = 0, meaning "explicitly no ceiling") is an operator override that wins over
 * the env var. `ncl cost-cap clear` deletes a row to restore env-fallback.
 *
 * The env var remains a back-compat fallback: an install with no rows behaves
 * exactly as before.
 */
export const migration938: Migration = {
  version: 938,
  name: 'cost-cap-policy',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cost_cap_policy (
        group_folder TEXT PRIMARY KEY,
        ceiling_usd  REAL,
        cap_usd      REAL,
        updated_at   TEXT NOT NULL,
        updated_by   TEXT
      )
    `);
  },
};
