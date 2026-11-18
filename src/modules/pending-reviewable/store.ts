/**
 * pending_reviewable_prs write/read path — the host-side CI gate's park queue.
 *
 * A reviewable PR event is parked here (keyed on repo, pr_number) instead of
 * being delivered immediately, when APPROVER_CI_GATE is on. It is released when
 * a required CI check_suite reports success for the parked head_sha. A newer
 * push on the same PR replaces the parked head (the debounce: only the settled
 * head survives to be reviewed).
 *
 * "Newer" is decided by the event's `pull_request.updated_at`, not by arrival
 * order. GitHub can deliver events out of order, and a redelivery from the
 * App's delivery log arrives late with its original payload, so the latest
 * arrival may be the oldest event. The row therefore records the
 * `pr_updated_at` of the event that wrote it, and a release marks the row
 * (`released_at`) instead of deleting it, so the newest event the host has seen
 * for a PR is still known after its review runs. The merged/closed handler
 * deletes the row (deleteParked), so the table holds at most one row per open
 * PR. Migration 951 has the incident that motivated this.
 *
 * All functions log and return an empty or `failed` result (never throw) on a
 * database error, matching prMappingExists's defensive convention.
 */
import type { DbDriver } from '../../db/driver.js';
import { log } from '../../log.js';

export interface ParkedReviewable {
  repo: string;
  prNumber: number;
  headSha: string;
  reason: string;
  /**
   * `pull_request.updated_at` of the event, as `Date#toISOString()`. Two keys
   * in that one format compare correctly as strings, which is how the park
   * write orders events.
   */
  prUpdatedAt: string;
  /** JSON blob of the fields deliverGitHubPrReviewable needs at release time. */
  rawEventJson: string;
}

/**
 * Outcome of a park write: `parked` when this event now owns the PR's row,
 * `superseded` when the row already holds a newer event, `failed` on a
 * database error (logged).
 */
export type ParkResult = 'parked' | 'superseded' | 'failed';

/**
 * Park a reviewable PR unless the host already holds a newer event for it.
 *
 * The conditional upsert replaces the existing row when:
 *  - the incoming event is strictly newer (`pr_updated_at` greater), or
 *  - it is exactly as new and the row is still waiting for CI. This keeps a
 *    same-delivery retry idempotent, and two pushes within the same second
 *    keep arrival order, as before, because the payload cannot order them, or
 *  - the row has no `pr_updated_at` (parked before migration 951 from a body
 *    without a readable timestamp), so nothing is known to be newer.
 *
 * A released row is replaced only by a strictly newer event, so a replay of
 * the event that was already reviewed does not park the PR again.
 *
 * Consider a PR parked at head B by a `synchronize` with updated_at 18:51:44Z.
 * A redelivered `synchronize` for the earlier head A (updated_at 18:20:18Z)
 * arrives afterwards. The upsert's WHERE clause is false, the row keeps head
 * B, and this returns `superseded`.
 */
export async function parkReviewable(db: DbDriver, p: ParkedReviewable): Promise<ParkResult> {
  try {
    const result = await db.run(
      `INSERT INTO pending_reviewable_prs
         (repo, pr_number, head_sha, reason, raw_event_json, parked_at, pr_updated_at, released_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT (repo, pr_number) DO UPDATE SET
         head_sha       = excluded.head_sha,
         reason         = excluded.reason,
         raw_event_json = excluded.raw_event_json,
         parked_at      = excluded.parked_at,
         pr_updated_at  = excluded.pr_updated_at,
         released_at    = NULL
       WHERE pending_reviewable_prs.pr_updated_at IS NULL
          OR excluded.pr_updated_at > pending_reviewable_prs.pr_updated_at
          OR (excluded.pr_updated_at = pending_reviewable_prs.pr_updated_at
              AND pending_reviewable_prs.released_at IS NULL)`,
      p.repo,
      p.prNumber,
      p.headSha,
      p.reason,
      p.rawEventJson,
      new Date().toISOString(),
      p.prUpdatedAt,
    );
    if (result.changes === 0) {
      log.info('ci-gate: ignored a reviewable PR event older than the one already held', {
        repo: p.repo,
        pr: p.prNumber,
        head: p.headSha.slice(0, 12),
        reason: p.reason,
        prUpdatedAt: p.prUpdatedAt,
      });
      return 'superseded';
    }
    log.info('ci-gate: parked reviewable PR pending CI', {
      repo: p.repo,
      pr: p.prNumber,
      head: p.headSha.slice(0, 12),
      reason: p.reason,
      prUpdatedAt: p.prUpdatedAt,
    });
    return 'parked';
  } catch (e) {
    log.warn('ci-gate: failed to park reviewable PR', { repo: p.repo, pr: p.prNumber, err: String(e).slice(0, 200) });
    return 'failed';
  }
}

/**
 * Look up a PR that is waiting for CI at the head_sha that just went green.
 * Returns the row only when the parked head matches and the row has not been
 * released yet. A check_suite for a superseded head does NOT release (the newer
 * push replaced the row with its own head), and a second green suite for an
 * already released head does not release it again.
 */
export async function findParkedByHead(
  db: DbDriver,
  repo: string,
  headSha: string,
): Promise<(Omit<ParkedReviewable, 'prUpdatedAt'> & { parkedAt: string }) | null> {
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
         FROM pending_reviewable_prs
        WHERE repo = ? AND head_sha = ? AND released_at IS NULL`,
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

/**
 * Mark the PR's row released after its review was delivered. The row stays so
 * that parkReviewable can still tell an old replayed event from a new push.
 * The update matches only the head that was released: if a newer push replaced
 * the row while the release was being delivered, that newer park stays
 * waiting for its own CI.
 */
export async function markParkReleased(db: DbDriver, repo: string, prNumber: number, headSha: string): Promise<void> {
  try {
    await db.run(
      `UPDATE pending_reviewable_prs SET released_at = ?
        WHERE repo = ? AND pr_number = ? AND head_sha = ? AND released_at IS NULL`,
      new Date().toISOString(),
      repo,
      prNumber,
      headSha,
    );
  } catch (e) {
    log.warn('ci-gate: failed to mark parked PR released', { repo, pr: prNumber, err: String(e).slice(0, 200) });
  }
}

/** Remove a PR's row once the PR is merged or closed. Idempotent. */
export async function deleteParked(db: DbDriver, repo: string, prNumber: number): Promise<void> {
  try {
    await db.run('DELETE FROM pending_reviewable_prs WHERE repo = ? AND pr_number = ?', repo, prNumber);
  } catch {
    /* table missing pre-migration — nothing to delete */
  }
}
