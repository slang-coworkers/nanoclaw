import type { Migration } from './index.js';

/**
 * `cost_ceiling_adjustments` — the durable ledger behind the live, per-session,
 * exact-value cost-ceiling control (NanoClaw #1, "set ceiling v2").
 *
 * WHY A DEDICATED TABLE (not more columns on `cost_escalation_episodes`, migration
 * 939). An episode models a RUNNER-INITIATED escalation — it only exists once the
 * runner has already crossed a threshold. This feature also needs to work on a
 * HEALTHY session that has never escalated (a proactive raise or lower), so there is
 * no episode row to attach a target value to. Bolting an operation discriminator and
 * a nullable target column onto the episode table (an earlier draft's approach) was
 * flagged in review as a money-unsafe overload of the existing `continue` decision —
 * it conflated "a runner told us it stopped" with "an admin asked for an exact
 * value," two different operations with different money-safety requirements. This
 * table is the ledger for the second operation only; it never mutates
 * `cost_escalation_episodes` rows itself (see `src/modules/cost-ceiling-adjustment`
 * for the transactional handoff between the two).
 *
 * ONE ROW PER SUBMISSION, keyed by the caller-supplied `adjustment_id` (the
 * dashboard's `requestId`, `cca-<uuid>`). Host INGEST of a retried/redelivered
 * request is therefore an idempotent lookup-or-insert (see
 * `createCostCeilingAdjustment` in `src/db/cost-ceiling-adjustments.ts`), not a
 * fresh row per HTTP call.
 *
 * THE CONCURRENCY CONTROL IS THE `UNIQUE(session_id, expected_epoch_key)`
 * CONSTRAINT, not a separate compare-and-set query. Two submissions that both read
 * the session in the same live epoch can both pass every application-level check,
 * but only one of their INSERTs can land — SQLite itself is the arbiter, and the
 * loser's insert fails with a UNIQUE-constraint error the accessor turns into a
 * clean `epoch-conflict` result. This is stronger than a CAS on a single row: it
 * also fences a NEW request against an already-decided card for the exact same
 * epoch, because `expected_epoch_key` is the same value the card path fences on.
 *
 * `protocol_version` is always 2 for rows this feature writes (the wire protocol
 * both the dashboard→host request and the host→runner control message carry).
 * Reserved for a future breaking change to the ledger contract; not currently
 * branched on.
 *
 * MONEY VALUES ARE INTEGER CENTS on this table and on the wire (dashboard→host
 * request, host→runner control message, runner→host receipt). The runner's own
 * live state remains USD floats internally (unchanged, matches the existing
 * `cost_cap` contract) — the conversion happens only at the two wire boundaries.
 * Integer cents avoid float-equality bugs in the epoch/ceiling comparisons that
 * gate every state transition here.
 *
 * STATE MACHINE: pending → enqueued → { applied | conflict | rejected }.
 *   - `pending`   row inserted, control message not yet durably written.
 *   - `enqueued`  the deterministic inbound control message exists in the
 *                 session's inbound.db; the runner has not yet confirmed.
 *   - `applied`   the runner's receipt confirms it set the ceiling to the
 *                 requested target.
 *   - `conflict`  the runner's live epoch/ceiling did not match what this
 *                 request expected (`epoch_mismatch` | `ceiling_mismatch`).
 *   - `rejected`  the runner refused for a reason unrelated to staleness
 *                 (`immortal` | `cost_tracking_disabled` | `invalid_value` |
 *                 `unsupported_protocol`), or the host reconciler confirmed the
 *                 request can never land (session closed, session DB gone).
 * `applied`/`conflict`/`rejected` are all terminal — nothing here ever un-decides
 * a completed row; see `recordCostCeilingAdjustmentResult`'s CAS.
 *
 * `inbound_message_id` is the deterministic id
 * (`cost-ceiling-adjustment:<adjustment_id>`) used for the `INSERT ... ON
 * CONFLICT(id) DO NOTHING` write into the session's `messages_in` — UNIQUE here
 * too so a second adjustment can never accidentally reuse it.
 *
 * `enqueue_attempts` / `next_attempt_at` / `last_error` back the host-sweep
 * reconciler's capped exponential backoff for the enqueue step (control-message
 * insert + container wake) — see `idx_cost_adjustment_reconcile`. They say
 * nothing about the runner's own processing of an already-enqueued message.
 *
 * FK to `sessions(id) ON DELETE CASCADE`: deleting a session's row removes its
 * adjustment ledger with it, mirroring `cost_escalation_episodes`.
 *
 * This table is a per-operation ledger only. It must never be read or written by
 * `cost_cap_policy` (migration 938, the separate group-level future-spawn-only
 * settings table) — this feature is explicitly per-session-live-only.
 */
export const migration942: Migration = {
  version: 942,
  name: 'cost-ceiling-adjustments',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cost_ceiling_adjustments (
        adjustment_id          TEXT PRIMARY KEY,
        protocol_version       INTEGER NOT NULL,
        session_id             TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        agent_group_id         TEXT NOT NULL,
        expected_epoch_key     TEXT NOT NULL,
        expected_ceiling_cents INTEGER NOT NULL,
        target_ceiling_cents   INTEGER NOT NULL CHECK (target_ceiling_cents BETWEEN 1 AND 100000),
        state                  TEXT NOT NULL CHECK (state IN ('pending','enqueued','applied','conflict','rejected')),
        inbound_message_id     TEXT NOT NULL UNIQUE,
        requested_at           TEXT NOT NULL,
        requested_by           TEXT NOT NULL,
        enqueued_at            TEXT,
        completed_at           TEXT,
        result_epoch_key       TEXT,
        result_ceiling_cents   INTEGER,
        result_spent_usd       REAL,
        result_cost_status     TEXT,
        result_reason          TEXT,
        enqueue_attempts       INTEGER NOT NULL DEFAULT 0,
        next_attempt_at        TEXT,
        last_error             TEXT,
        UNIQUE (session_id, expected_epoch_key)
      )
    `);
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_cost_adjustment_reconcile ON cost_ceiling_adjustments (state, next_attempt_at)`,
    );
    await db.exec(
      `CREATE INDEX IF NOT EXISTS idx_cost_adjustment_session ON cost_ceiling_adjustments (session_id, requested_at)`,
    );
  },
};
