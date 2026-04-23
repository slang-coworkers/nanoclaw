import type { Migration } from './index.js';

export const migration014: Migration = {
  version: 14,
  name: 'agent-routing',
  up(db) {
    db.exec(`ALTER TABLE agent_groups ADD COLUMN routing TEXT NOT NULL DEFAULT 'direct'`);

    // Backfill: agents with no messaging_group_agents row are internal-only
    db.exec(`
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
