import type { Migration } from './index.js';

export const migration924: Migration = {
  version: 924,
  name: 'agent-overlays',
  dependsOn: ['disable-overlays'],
  up(db) {
    const hasCol = (
      db.prepare("SELECT count(*) as c FROM pragma_table_info('agent_groups') WHERE name = 'overlays'").get() as {
        c: number;
      }
    ).c;
    if (!hasCol) {
      db.exec(`ALTER TABLE agent_groups ADD COLUMN overlays TEXT`);
    }
  },
};
