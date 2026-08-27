import { log } from '../../log.js';
import type { Migration } from './index.js';

/**
 * Move the pre-enforcement rows OUT of approval_decisions.
 *
 * Migration 934 labelled them `provenance='legacy'` and left them in place,
 * expecting every reader to filter. Review of #1110 found two ways that fails,
 * and the second one is the serious one:
 *
 *  1. A legacy row at a real PR head permanently BLOCKS the authorized
 *     approver. The primary key is (repo, pr_number, commit_sha) and the write
 *     path is append-only, so a legacy row at that key wins forever: an
 *     identical verdict reads as an idempotent duplicate (leaving the legacy
 *     row as the survivor, excluded from trusted metrics), and a different one
 *     is refused as a conflict. Before the capability guard existed ANY
 *     container could pre-seed arbitrary (repo, PR, SHA) keys — so the old
 *     vulnerability would have survived the fix as a denial-of-service
 *     primitive against the new trusted ledger. Junk written yesterday would
 *     silence today's real approver.
 *
 *  2. The human-verdict join could credit a legacy row instead of the verified
 *     one — an exact legacy head, or a legacy row with a newer (and, per the
 *     store's own notes, sometimes malformed-future) decided_at, absorbs the
 *     single webhook-sourced verdict and the verified row is never scored.
 *
 * Both are consequences of one table holding two populations with different
 * trust. Filtering at each read is a rule every future query has to remember;
 * separating the tables makes the trusted table trusted BY CONSTRUCTION. Every
 * existing consumer that selects from approval_decisions — including the
 * funnel, which still reads it unfiltered — becomes correct without changing,
 * which also removes the deploy-ordering hazard of shipping the writer before
 * the reader.
 *
 * Nothing is discarded. The rows move verbatim to approval_decisions_legacy
 * and stay queryable; `getDecisionSessionsForPr` reads both, because routing a
 * terminal PR outcome back to the approver session that decided it is a
 * delivery concern, not a calibration one. What changes is that they no longer
 * sit in the table whose contents are treated as evidence.
 */
const COLUMNS = [
  'repo',
  'pr_number',
  'commit_sha',
  'mode',
  'decision',
  'reason_code',
  'review_diff_hash',
  'policy_version',
  'clauses_json',
  'challenger_json',
  'human_verdict',
  'agent_group_id',
  'session_id',
  'thread_id',
  'decided_at',
  'join_mode',
  'provenance',
  'verdict_source',
  'verdict_source_event_id',
].join(', ');

export const migration935: Migration = {
  version: 935,
  name: 'approval-decisions-quarantine-legacy',
  dependsOn: ['approval-decision-provenance'],
  async up(db) {
    if (!(await db.hasTable('approval_decisions'))) return; // 929 owns the table

    await db.exec(`
      CREATE TABLE IF NOT EXISTS approval_decisions_legacy (
        repo             TEXT NOT NULL,
        pr_number        INTEGER NOT NULL,
        commit_sha       TEXT NOT NULL,
        mode             TEXT,
        decision         TEXT,
        reason_code      TEXT,
        review_diff_hash TEXT,
        policy_version   TEXT,
        clauses_json     TEXT,
        challenger_json  TEXT,
        human_verdict    TEXT,
        agent_group_id   TEXT,
        session_id       TEXT,
        thread_id        TEXT,
        decided_at       TEXT,
        join_mode        TEXT,
        provenance       TEXT,
        verdict_source   TEXT,
        verdict_source_event_id TEXT,
        PRIMARY KEY (repo, pr_number, commit_sha)
      );
      CREATE INDEX IF NOT EXISTS idx_approval_decisions_legacy_pr
        ON approval_decisions_legacy(repo, pr_number);
    `);

    // Copy first, then delete — and only delete what the copy accepted, so a
    // row can never be dropped without a surviving counterpart. The NOT EXISTS
    // guard makes a re-run harmless (it is the portable form of `INSERT OR
    // IGNORE`, which is SQLite-only); the migration runner wraps this in a
    // transaction, so a failure anywhere leaves the original table untouched.
    const moved = await db.run(
      `INSERT INTO approval_decisions_legacy (${COLUMNS})
       SELECT ${COLUMNS} FROM approval_decisions d
        WHERE (d.provenance IS NULL OR d.provenance <> 'agent_verified')
          AND NOT EXISTS (
            SELECT 1 FROM approval_decisions_legacy l
             WHERE l.repo = d.repo
               AND l.pr_number = d.pr_number
               AND l.commit_sha = d.commit_sha
          )`,
    );
    await db.run(
      `DELETE FROM approval_decisions
        WHERE (provenance IS NULL OR provenance <> 'agent_verified')
          AND EXISTS (
            SELECT 1 FROM approval_decisions_legacy l
             WHERE l.repo = approval_decisions.repo
               AND l.pr_number = approval_decisions.pr_number
               AND l.commit_sha = approval_decisions.commit_sha
          )`,
    );

    if (moved.changes > 0) {
      // The count matters operationally: it is the answer to "why do the
      // calibration dashboards show fewer decisions than yesterday".
      log.info('approval-ledger: pre-enforcement rows quarantined out of the trusted table', {
        moved: moved.changes,
        to: 'approval_decisions_legacy',
      });
    }
  },
};
