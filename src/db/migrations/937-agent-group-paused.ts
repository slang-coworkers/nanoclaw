import type { Migration } from './index.js';

/**
 * `paused` — an operator kill switch for an agent group.
 *
 * When 1, the host refuses to spawn a container for ANY of the group's
 * sessions, at the single choke point every wake path funnels through
 * (`wakeContainer` in container-runner.ts). This is deliberately enforced
 * there, not at the router: a group's traffic arrives by four independent
 * paths — router @mention fanout, agent-to-agent / host-direct delivery
 * (pending-reviewable release invites), the 60s host-sweep waking on due
 * messages, and scheduled-task fires — and only the first consults wirings.
 * A wiring-level pause was observed on slang-coworkers prod (2026-08-13) to
 * leave the a2a and sweep paths fully live, because they never look at
 * wirings. Gating the spawn itself is the only pause that all four honour.
 *
 * Inbound messages still accumulate in the session DBs while paused, so no
 * work is lost — unpausing (`paused = 0`) lets the next sweep pick them up.
 *
 * Default 0 (not paused) preserves existing behaviour for every current row.
 */
export const migration937: Migration = {
  version: 937,
  name: 'agent-group-paused',
  up(db) {
    const hasCol = (
      db.prepare("SELECT count(*) as c FROM pragma_table_info('agent_groups') WHERE name = 'paused'").get() as {
        c: number;
      }
    ).c;
    if (!hasCol) {
      db.exec(`ALTER TABLE agent_groups ADD COLUMN paused INTEGER NOT NULL DEFAULT 0`);
    }
  },
};
