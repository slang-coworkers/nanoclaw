import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

export const migration927: Migration = {
  version: 927,
  name: 'pr-mapping-owner-instance',
  dependsOn: ['pr-session-mappings'],
  async up(db) {
    await addColumnIfMissing(db, 'pr_session_mappings', "owner_instance TEXT NOT NULL DEFAULT 'prod'");
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_pr_map_owner ON pr_session_mappings(owner_instance)`);
  },
};
