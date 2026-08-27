import type { Migration } from './index.js';

/**
 * Append-only history for critique-gate escalations.
 *
 * Before this table there was no history at all: a resolved approval row is
 * DELETED by the response handler, so the only record of an escalation ever
 * having happened was a line in `logs/nanoclaw.log` — a 64 MB multi-day file
 * with time-only stamps. Answering "are we getting more of these, and from
 * whom" required grepping it and decoding epoch-ms out of approval ids.
 *
 * Every transition in the escalation lifecycle appends one row here:
 *
 *   self_heal    the host nudged the agent to run the critique itself
 *                (no human involved) — the expected path for stale/missing
 *   self_healed  a critique round landed after a nudge; requirement met
 *   carded       escalated to a human approval card
 *   expired      a carded escalation went moot and was auto-retracted
 *   approved     an admin granted the bypass (ENFORCEMENT RELEASED)
 *   rejected     an admin refused the bypass
 *   failed_open  the in-container gate allowed a delivery with the
 *                requirement still unmet (ENFORCEMENT RELEASED)
 *
 * The two ENFORCEMENT RELEASED events are the point of the table: today a
 * container-side fail-open writes to stderr and the container is `--rm`'d, so
 * a release is invisible to the host forever. Anything that opens the gate
 * must leave a durable, queryable trace.
 */
export const migration932: Migration = {
  version: 932,
  name: 'critique-escalation-events',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS critique_escalation_events (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id     TEXT NOT NULL,
        agent_group_id TEXT,
        approval_id    TEXT,                 -- set for carded/approved/rejected/expired
        event          TEXT NOT NULL,        -- see the lifecycle list above
        class          TEXT,                 -- missing | stale | failed
        reason         TEXT,                 -- the gate's DENIAL_REASON, verbatim
        hit            TEXT,                 -- the delivery surface (e.g. "PR creation")
        repo           TEXT,
        pr_number      INTEGER,
        attempt        INTEGER,              -- self-heal attempt number, 1-based
        created_at     TEXT NOT NULL,
        requested_at   INTEGER               -- escalation file's epoch-s, joins events of one escalation
      );
      CREATE INDEX IF NOT EXISTS idx_critique_esc_created
        ON critique_escalation_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_critique_esc_session
        ON critique_escalation_events(session_id, requested_at);
      CREATE INDEX IF NOT EXISTS idx_critique_esc_event
        ON critique_escalation_events(event, created_at);
    `);
  },
};
