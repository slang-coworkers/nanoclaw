import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

export const migration915: Migration = {
  version: 915,
  name: 'agent-routing',
  // Backfill references `is_admin`, added by 006-coworker-fields. Declare
  // the edge so the loader's topo-sort guarantees 006 runs first, even if
  // a future registry picks overlapping version numbers.
  dependsOn: ['coworker-fields'],
  async up(db) {
    await addColumnIfMissing(db, 'agent_groups', "routing TEXT NOT NULL DEFAULT 'direct'");

    // Backfill: agents with no messaging_group_agents row are internal-only
    await db.exec(`
      UPDATE agent_groups SET routing = 'internal'
      WHERE id NOT IN (
        SELECT DISTINCT agent_group_id FROM messaging_group_agents mga
        JOIN messaging_groups mg ON mga.messaging_group_id = mg.id
        WHERE mg.channel_type || ':' || mg.platform_id LIKE 'dashboard:' || agent_groups.folder || '%'
          OR mg.platform_id LIKE '%' || agent_groups.folder
      ) AND is_admin = 0
    `);
  },
};
