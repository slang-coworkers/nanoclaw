import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * `join_mode` — how a decision row acquired its `human_verdict`.
 *
 *   'exact'         the human reviewed the very commit the approver decided on
 *   'head_advanced' the PR moved past the decided head before it ended, so the
 *                   outcome was credited to the approver's LAST call
 *   NULL            not joined yet, or joined before this column existed
 *
 * The point is bias detection, not bookkeeping. Scoring a decision by the PR's
 * eventual outcome silently flatters the approver whenever a human catches
 * something it missed and the author then fixes it: the approver said
 * WOULD_APPROVE at head X, a reviewer found a bug, the author pushed Y, the PR
 * merged — and merge-outcome scoring records that as agreement.
 *
 * Measured on slang-coworkers prod 2026-08-05 the effect was 0/39 (no formal
 * CHANGES_REQUESTED landed after an approval), so the bias is not present
 * today. But that check only covers the FORMAL review state; reviewers on these
 * repos push back in plain comments far more often, so it is a lower bound.
 * Splitting precision by join_mode makes the bias observable continuously
 * instead of requiring another ad-hoc audit: if 'head_advanced' ever scores
 * materially better than 'exact', the flattery has arrived.
 */
export const migration931: Migration = {
  version: 931,
  name: 'approval-join-mode',
  up(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(approval_decisions)`).all() as Array<{ name: string }>;
    if (!cols.length) return; // table not created yet — 929 owns it
    if (cols.some((c) => c.name === 'join_mode')) return;
    db.exec(`ALTER TABLE approval_decisions ADD COLUMN join_mode TEXT`);
  },
};
