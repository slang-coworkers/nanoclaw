import type Database from 'better-sqlite3';

import type { Migration } from './index.js';

/**
 * Approval-decision ledger for the PR-approver coworkers (slang-pr-approver /
 * slangpy-pr-approver, "Verity"). Each row is one auditable decision for a
 * (repo, pr, reviewed commit): the closed four-state verdict plus the
 * derivation evidence, written host-side via the `record_decision` system
 * action (container agents can't touch v2.db directly — same transport as
 * `map_pr_session`).
 *
 * `human_verdict` is filled later — either from the offline manifest at
 * scoring time, or when a live `github.pr_review` arrives on the PR's session
 * — so the scorer (`score-decisions.py`) can join decision vs. ground truth
 * on (repo, commit_sha). It stays NULL until then.
 *
 * PK is (repo, pr, commit_sha): one decision per reviewed revision. A re-run
 * on the same commit (re-review, corrected derivation) is INSERT OR REPLACE —
 * last-writer-wins, matching the pr_session_mappings convention.
 */
export const migration929: Migration = {
  version: 929,
  name: 'approval-decisions',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS approval_decisions (
        repo             TEXT NOT NULL,
        pr_number        INTEGER NOT NULL,
        commit_sha       TEXT NOT NULL,
        mode             TEXT NOT NULL,          -- historical | live | live_late
        decision         TEXT NOT NULL,          -- WOULD_APPROVE | BLOCK | ABSTAIN_POLICY | ABSTAIN_INFRA
        reason_code      TEXT,                    -- CLAUSE_FAIL:<name>, OPEN_GAP, REVIEW_DOC_MISSING, ...
        review_diff_hash TEXT,                    -- the diff_hash the review doc reported reviewing
        policy_version   TEXT,
        clauses_json     TEXT,                    -- full clauses.json evidence blob
        challenger_json  TEXT,                    -- challenger finding / CHALLENGER_CLEAN
        human_verdict    TEXT,                    -- APPROVED | CHANGES_REQUESTED | ... (NULL until joined)
        agent_group_id   TEXT NOT NULL,
        session_id       TEXT NOT NULL,
        thread_id        TEXT,
        decided_at       TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number, commit_sha)
      );
      CREATE INDEX IF NOT EXISTS idx_approval_decisions_pr
        ON approval_decisions(repo, pr_number);
      CREATE INDEX IF NOT EXISTS idx_approval_decisions_decision
        ON approval_decisions(decision);
    `);
  },
};
