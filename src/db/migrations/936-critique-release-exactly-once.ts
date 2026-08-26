import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

/**
 * Make an enforcement release recordable exactly once, and make an unrecorded
 * one visible.
 *
 * PR #1109 moved fail-open ingestion above the `resolved` fast-return so a
 * release stamped after an approval could still be recorded. It did not make
 * the container's two writes atomic, and they are not:
 *
 *   1. the gate marks the grant CONSUMED in workflow-state.json
 *   2. …the host sweep can land here…
 *   3. the gate stamps `failed_open_at` into critique-escalation.json
 *
 * A sweep in that window reconciled the consumption, saw an unstamped file,
 * treated `consumed_at` as terminal and RETIRED the file — after which the
 * gate's stamp landed on a missing path and the gate fabricated a replacement
 * escalation with `requested_at: 0`. The real release went unrecorded and the
 * synthetic record was carded as a fresh human decision.
 *
 * Two columns close that:
 *
 * `critique_escalation_events.dedupe_key` — the release now reaches the host
 * by two independent routes (the escalation file, and the append-only
 * `critique-releases.jsonl` journal the gate writes even when the file is
 * gone). Both carry the same gate-generated event id. A UNIQUE index on the
 * key makes "exactly once" a property of the schema rather than of whichever
 * check-then-act the caller happened to write. Partial (`WHERE dedupe_key IS
 * NOT NULL`) so the lifecycle events that have no natural key are unaffected.
 *
 * `critique_bypass_grants.release_recorded_at` — a consumed grant carries an
 * OBLIGATION: its release has to be recorded. Until it is, retiring the
 * escalation file destroys the record the container is still writing into.
 * This column is the host's own answer to "has that obligation been
 * discharged", and it is not reachable from any container, unlike the
 * `failed_open_recorded` flag in the session-mounted file.
 */
export const migration936: Migration = {
  version: 936,
  name: 'critique-release-exactly-once',
  dependsOn: ['critique-escalation-events', 'critique-bypass-grants'],
  async up(db) {
    if (await db.hasTable('critique_escalation_events')) {
      await addColumnIfMissing(db, 'critique_escalation_events', 'dedupe_key TEXT');
      // Partial: pre-existing rows (and every lifecycle event that has no
      // natural key) leave it NULL, and NULLs must not collide with each other.
      await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_critique_esc_dedupe
                 ON critique_escalation_events(dedupe_key) WHERE dedupe_key IS NOT NULL`);
    }

    if (await db.hasTable('critique_bypass_grants')) {
      await addColumnIfMissing(db, 'critique_bypass_grants', 'release_recorded_at TEXT');
    }
  },
};
