import type { Migration } from './index.js';

/**
 * Per-group model policy on `container_configs` (src/model-policy.ts): the
 * small, router and critic models, and `weights` ("open" = open-weights models
 * only). NULL = the install default for that role, as for `model`.
 */
export const migration948: Migration = {
  version: 948,
  name: 'container-config-model-policy',
  async up(db) {
    await db.exec(`
      ALTER TABLE container_configs ADD COLUMN small_model TEXT;
      ALTER TABLE container_configs ADD COLUMN router_model TEXT;
      ALTER TABLE container_configs ADD COLUMN critic_model TEXT;
      ALTER TABLE container_configs ADD COLUMN weights TEXT;
    `);
  },
};
