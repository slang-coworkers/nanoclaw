import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

export const migration924: Migration = {
  version: 924,
  name: 'agent-overlays',
  dependsOn: ['disable-overlays'],
  async up(db) {
    await addColumnIfMissing(db, 'agent_groups', 'overlays TEXT');
  },
};
