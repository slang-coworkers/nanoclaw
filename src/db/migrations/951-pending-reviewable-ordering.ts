import { addColumnIfMissing } from './column-guard.js';
import type { Migration } from './index.js';

/**
 * Event ordering for the CI-gate park (`pending_reviewable_prs`, migration 930).
 *
 *   pr_updated_at  `pull_request.updated_at` from the event that wrote the row,
 *                  normalized to `Date#toISOString()`. NULL only for a row whose
 *                  stored payload carries no readable timestamp.
 *   released_at    when the check_suite handler released the row for review.
 *                  NULL while the row still waits for CI.
 *
 * The park used to be last-writer-wins by arrival. GitHub can deliver
 * `pull_request` events out of order, and we redeliver missed deliveries from
 * the App's delivery log after an outage, so arrival order is not event order.
 * Consider shader-slang/slang#14495 on 2026-11-16: the PR was parked at its
 * current head 888aced9e (updated_at 18:51:44Z). Hours later the older
 * `opened` (725abb3a3, 16:48:44Z) and `synchronize` (573bd28e4, 18:20:18Z)
 * deliveries were redelivered, and the second one replaced the row. CI for
 * 573bd28e4 had already finished, so no check_suite could release the row and
 * the PR lost its review.
 *
 * The park write now keeps the row whose event is newer by `pr_updated_at`.
 * A redelivery carries the original payload, so its `updated_at` is the
 * original one even though it arrives late. Releasing a row now sets
 * `released_at` instead of deleting the row, so the newest timestamp the host
 * has seen for the PR survives the release and an old event replayed after the
 * review cannot park the PR again. The merged/closed handler still deletes the
 * row, so the table holds at most one row per open PR.
 *
 * Existing rows are backfilled from the webhook body stored in
 * `raw_event_json.rawBody`, so the rows already waiting at deploy time are
 * protected too.
 */
export const migration951: Migration = {
  version: 951,
  name: 'pending-reviewable-ordering',
  async up(db) {
    if (!(await db.hasTable('pending_reviewable_prs'))) return; // 930 owns the table
    await addColumnIfMissing(db, 'pending_reviewable_prs', 'pr_updated_at TEXT');
    await addColumnIfMissing(db, 'pending_reviewable_prs', 'released_at TEXT');

    const rows = await db.all<{ repo: string; pr_number: number; raw_event_json: string }>(
      'SELECT repo, pr_number, raw_event_json FROM pending_reviewable_prs WHERE pr_updated_at IS NULL',
    );
    for (const row of rows) {
      const updatedAt = storedPrUpdatedAt(row.raw_event_json);
      if (!updatedAt) continue;
      await db.run(
        'UPDATE pending_reviewable_prs SET pr_updated_at = ? WHERE repo = ? AND pr_number = ?',
        updatedAt,
        row.repo,
        row.pr_number,
      );
    }
  },
};

/**
 * Return the normalized `pull_request.updated_at` of the webhook body stored in
 * a parked row's `raw_event_json.rawBody`, or null when the row has no body or
 * the body has no readable timestamp.
 */
function storedPrUpdatedAt(rawEventJson: string): string | null {
  const saved = parseJsonObject(rawEventJson);
  const body = typeof saved?.rawBody === 'string' ? parseJsonObject(saved.rawBody) : null;
  const pr = body?.pull_request as Record<string, unknown> | undefined;
  const ms = Date.parse(String(pr?.updated_at ?? ''));
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Parse `text` as a JSON object; return null when it is not valid JSON or not an object. */
function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  } catch (e) {
    if (e instanceof SyntaxError) return null;
    throw e;
  }
}
