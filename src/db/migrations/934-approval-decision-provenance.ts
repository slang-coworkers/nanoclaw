import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

/**
 * Provenance for the approval-decision ledger.
 *
 * `record_decision` was registered in the CORE MCP server handed to every
 * container and authorized by nothing but a sentence in its own description,
 * so until the capability guard landed alongside this migration, ANY agent
 * could append a row naming any repository, PR, commit and verdict — and
 * INSERT OR REPLACE let it overwrite a real one. The rows drive the
 * author-vs-approver calibration dashboards, i.e. the numbers humans read to
 * decide how much to trust the bots.
 *
 * That makes "which rows were written under enforcement" a question the
 * schema has to be able to answer, because it cannot be reconstructed later:
 *
 *   provenance = 'legacy'          written before the guard existed. Structurally
 *                                  unattributable — NOT evidence of forgery, and
 *                                  not evidence of authenticity either.
 *   provenance = 'agent_verified'  written by an agent group that held the
 *                                  APPROVAL_LEDGER_WRITERS capability at the
 *                                  moment of the write.
 *
 * Metric consumers filter on 'agent_verified'. Existing rows are backfilled to
 * 'legacy' rather than deleted: they remain readable for history, they just
 * stop counting as calibration evidence.
 *
 * `verdict_source` / `verdict_source_event_id` do the same job for the join
 * side. A human verdict is now accepted only from the trusted ingestion path
 * and only with the source event id that observed it — the GitHub webhook
 * delivery id. Recording the id also makes the stamp idempotent under webhook
 * redelivery, which GitHub does routinely.
 */
export const migration934: Migration = {
  version: 934,
  name: 'approval-decision-provenance',
  dependsOn: ['approval-decisions'],
  async up(db) {
    if (!(await db.hasTable('approval_decisions'))) return; // 929 owns the table

    // DEFAULT 'legacy' is what backfills the existing rows; the write path
    // always supplies the column explicitly, so the default only ever applies
    // to rows that predate enforcement.
    await addColumnIfMissing(db, 'approval_decisions', "provenance TEXT NOT NULL DEFAULT 'legacy'");
    await addColumnIfMissing(db, 'approval_decisions', 'verdict_source TEXT');
    await addColumnIfMissing(db, 'approval_decisions', 'verdict_source_event_id TEXT');

    // The metric path reads "trusted rows for this PR"; without this index it
    // is a full scan once the ledger has a few thousand rows.
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_approval_decisions_provenance
               ON approval_decisions(provenance, repo, pr_number)`);
  },
};
