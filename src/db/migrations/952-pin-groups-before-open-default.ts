import type { Migration } from './index.js';

/**
 * Record what each existing group runs on before the open-weights install
 * default takes effect. Up to this release, a group that named no provider
 * ran on Claude and a group with no `weights` ran without the open-weights
 * rule. From this release, an empty provider and empty weights follow the
 * install default (installDefaultProvider / installDefaultWeights in
 * src/model-policy.ts), which is OpenCode with open-weights models. Writing the
 * old meaning into the empty columns keeps every existing group where it is:
 *
 *   - a config row with no provider, of a group with no `agent_provider` of its
 *     own, gets provider `claude`;
 *   - a config row with no weights gets `any`.
 *
 * Consider an eval group that never named a provider: its row reads provider
 * NULL, weights NULL, and it ran Claude. After this migration the row reads
 * `claude`, `any`, and it still runs Claude whatever the install default is.
 * Groups created later keep empty columns and follow the default. A group with
 * no config row yet is left to backfillContainerConfigs, which writes the same
 * values when it creates the row. Session pins already name a provider.
 */
export const migration952: Migration = {
  version: 952,
  name: 'pin-groups-before-open-default',
  async up(db) {
    await db.exec(
      `UPDATE container_configs SET provider = 'claude'
        WHERE COALESCE(provider, '') = ''
          AND agent_group_id IN (SELECT id FROM agent_groups WHERE COALESCE(agent_provider, '') = '')`,
    );
    await db.exec(`UPDATE container_configs SET weights = 'any' WHERE COALESCE(weights, '') = ''`);
  },
};
