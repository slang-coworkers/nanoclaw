import type { Migration } from './index.js';

/**
 * Drop self-referential a2a lineage rows (recipient_session_id ===
 * source_session_id).
 *
 * Such a row is a 1-cycle: the ancestor walk in `performAgentRoute`
 * (findAncestorRoute) follows recipient → source upward, and a self-edge
 * makes a session its own parent. The runtime is protected (the walk is
 * bounded by ANCESTOR_HOP_LIMIT + a visited set, so it drops on the cycle
 * rather than looping) — but the corrupt rows still block legitimate
 * ancestor routing for the affected sessions and any that chain into them.
 *
 * These rows predate the write-side guards (the L2 self-target drop in
 * agent-route.ts and the recordSource self-referential guard); this migration
 * clears the historical residue. It is idempotent and a no-op on installs
 * that never used agent-to-agent (empty table) or that have no self-edges.
 */
export const migration925: Migration = {
  version: 925,
  name: 'a2a-drop-self-referential-sources',
  dependsOn: ['a2a-session-sources'],
  async up(db) {
    if (!(await db.hasTable('a2a_session_sources'))) return;
    await db.run('DELETE FROM a2a_session_sources WHERE recipient_session_id = source_session_id');
  },
};
