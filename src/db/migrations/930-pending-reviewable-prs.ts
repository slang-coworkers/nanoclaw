import type { Migration } from './index.js';

/**
 * Parked reviewable PRs for the host-side CI gate (APPROVER_CI_GATE).
 *
 * When the gate is on, a reviewable `pull_request` event (ready_for_review /
 * opened / synchronize, non-draft) does NOT immediately mint an approver
 * session. Instead the host PARKS it here, keyed on (repo, pr_number), and
 * releases it — firing the normal reviewable delivery — only when a required
 * CI check_suite reports success for the parked head_sha.
 *
 * PK (repo, pr_number) with INSERT OR REPLACE is the debounce: a burst of
 * synchronize pushes collapses to a single parked row carrying the LATEST
 * head_sha, so the approver ultimately runs once, on the settled+green head,
 * instead of once per push (the 810-turn / $110 failure mode this replaces).
 *
 * `raw_event_json` stores the fields deliverGitHubPrReviewable needs to
 * reconstruct the delivery at release time (prUrl, title, author, reason,
 * eventType, deliveryId, rawBody). Nothing here is a source of truth beyond
 * the pending window — a released or superseded row is deleted.
 */
export const migration930: Migration = {
  version: 930,
  name: 'pending-reviewable-prs',
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS pending_reviewable_prs (
        repo           TEXT NOT NULL,
        pr_number      INTEGER NOT NULL,
        head_sha       TEXT NOT NULL,        -- the head we're waiting for CI to pass on
        reason         TEXT,                 -- ready_for_review | opened | synchronize
        raw_event_json TEXT NOT NULL,        -- reconstruct the reviewable delivery on release
        parked_at      TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      );
      CREATE INDEX IF NOT EXISTS idx_pending_reviewable_head
        ON pending_reviewable_prs(repo, head_sha);
    `);
  },
};
