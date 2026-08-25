/**
 * pending_reviewable_prs write/read path — the host-side CI gate's park queue.
 *
 * A reviewable PR event is parked here (keyed on repo, pr_number) instead of
 * being delivered immediately, when APPROVER_CI_GATE is on. It is released —
 * and deleted — when a required CI check_suite reports success for the parked
 * head_sha. INSERT OR REPLACE means a newer push on the same PR overwrites the
 * parked head (the debounce: only the settled head survives to be reviewed).
 *
 * All functions no-op / return empty (never throw) if the table doesn't exist
 * yet (pre-migration), matching prMappingExists's defensive convention.
 */
import type { DbDriver } from '../../db/driver.js';
import { log } from '../../log.js';

export interface ParkedReviewable {
  repo: string;
  prNumber: number;
  headSha: string;
  reason: string;
  /** JSON blob of the fields deliverGitHubPrReviewable needs at release time. */
  rawEventJson: string;
}

/** Park (or refresh) a reviewable PR. Last-writer-wins on (repo, pr_number). */
export async function parkReviewable(db: DbDriver, p: ParkedReviewable): Promise<void> {
  try {
    await db.run(
      `INSERT OR REPLACE INTO pending_reviewable_prs
       (repo, pr_number, head_sha, reason, raw_event_json, parked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      p.repo,
      p.prNumber,
      p.headSha,
      p.reason,
      p.rawEventJson,
      new Date().toISOString(),
    );
    log.info('ci-gate: parked reviewable PR pending CI', {
      repo: p.repo,
      pr: p.prNumber,
      head: p.headSha.slice(0, 12),
      reason: p.reason,
    });
  } catch (e) {
    log.warn('ci-gate: failed to park reviewable PR', { repo: p.repo, pr: p.prNumber, err: String(e).slice(0, 200) });
  }
}

/**
 * Look up a parked PR by the CI head_sha that just went green. Returns the row
 * only when the parked head matches — a check_suite for a superseded head does
 * NOT release (the newer push replaced the row with its own head).
 */
export async function findParkedByHead(
  db: DbDriver,
  repo: string,
  headSha: string,
): Promise<(ParkedReviewable & { parkedAt: string }) | null> {
  try {
    const row = await db.get<{
      repo: string;
      pr_number: number;
      head_sha: string;
      reason: string;
      raw_event_json: string;
      parked_at: string;
    }>(
      `SELECT repo, pr_number, head_sha, reason, raw_event_json, parked_at
         FROM pending_reviewable_prs WHERE repo = ? AND head_sha = ?`,
      repo,
      headSha,
    );
    if (!row) return null;
    return {
      repo: row.repo,
      prNumber: row.pr_number,
      headSha: row.head_sha,
      reason: row.reason,
      rawEventJson: row.raw_event_json,
      parkedAt: row.parked_at,
    };
  } catch {
    return null;
  }
}

/** Remove a parked row once released (or superseded/abandoned). Idempotent. */
export async function deleteParked(db: DbDriver, repo: string, prNumber: number): Promise<void> {
  try {
    await db.run('DELETE FROM pending_reviewable_prs WHERE repo = ? AND pr_number = ?', repo, prNumber);
  } catch {
    /* table missing pre-migration — nothing to delete */
  }
}
