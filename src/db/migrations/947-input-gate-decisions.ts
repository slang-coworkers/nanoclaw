import type { Migration } from './index.js';

/**
 * `input_gate_decisions` — one append-only row per GitHub delivery the host
 * input gate evaluated (threat model §5 P0-1, "one gate, two checks").
 *
 * Shadow mode writes what the gate WOULD decide next to what routing actually
 * did (`current_outcome`), so the operator can measure how much traffic each
 * rule would stop before anything is enforced. Rows are never updated.
 *
 * GDPR: ids and evidence KINDS only. `actor_login` is kept beside the numeric
 * id so a reader can interpret the log; no names, emails or locations are
 * stored. Retention is an open decision (input-gate design Q8).
 */
export const migration947: Migration = {
  version: 947,
  name: 'input-gate-decisions',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS input_gate_decisions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id     TEXT NOT NULL,
        mode            TEXT NOT NULL,
        surface         TEXT NOT NULL,
        event           TEXT NOT NULL,
        repo            TEXT,
        number          INTEGER,
        actor_id        INTEGER,
        actor_login     TEXT,
        actor_type      TEXT,
        starts_work     INTEGER NOT NULL,
        tier            TEXT NOT NULL,
        tier_via        TEXT,
        evidence        TEXT NOT NULL,
        eligibility     TEXT NOT NULL,
        outcome         TEXT NOT NULL,
        reason          TEXT,
        current_outcome TEXT,
        created_at      TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_input_gate_decisions_delivery
        ON input_gate_decisions(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_input_gate_decisions_outcome
        ON input_gate_decisions(outcome, created_at);
      CREATE INDEX IF NOT EXISTS idx_input_gate_decisions_created
        ON input_gate_decisions(created_at);
    `);
  },
};
