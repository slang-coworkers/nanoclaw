import type { Migration } from './index.js';

/**
 * Turn overlays back on for Codex groups. Group init used to force
 * `disable_overlays = 1` on every Codex group, because Codex once ran no
 * settings hooks and its overlay gates could not work. Codex now runs the gate
 * scripts as managed hooks (container/codex-hooks.toml), so that init step is
 * gone, and this one-time reset undoes what it wrote: a Codex group's selected
 * overlays (plan-gate, critique-gate, eval-sandbox) apply as on other backends.
 * An operator who wants a Codex group without overlays sets the switch again
 * with `ncl groups update --disable-overlays 1`.
 */
export const migration949: Migration = {
  version: 949,
  name: 'codex-overlays-on',
  async up(db) {
    await db.exec(
      `UPDATE agent_groups SET disable_overlays = 0 WHERE agent_provider = 'codex' AND disable_overlays = 1`,
    );
  },
};
