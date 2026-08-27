import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

export const migration916: Migration = {
  version: 916,
  name: 'disable-overlays',
  async up(db) {
    await addColumnIfMissing(db, 'agent_groups', 'disable_overlays INTEGER NOT NULL DEFAULT 0');
  },
};
