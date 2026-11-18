import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { deleteParked, findParkedByHead, markParkReleased, parkReviewable } from './store.js';

const REPO = 'shader-slang/slang';
const PR = 14495;

/**
 * The three reviewable events of shader-slang/slang#14495, with the head sha and
 * `pull_request.updated_at` from their prod payloads (normalized the way the
 * webhook server normalizes them).
 */
const OPENED_725 = { reason: 'opened', headSha: '725abb3a35', prUpdatedAt: '2026-11-15T16:48:44.000Z' };
const SYNC_573 = { reason: 'synchronize', headSha: '573bd28e45', prUpdatedAt: '2026-11-15T18:20:18.000Z' };
const SYNC_888 = { reason: 'synchronize', headSha: '888aced9e4', prUpdatedAt: '2026-11-15T18:51:44.000Z' };

type Event = typeof OPENED_725;

function park(e: Event, prNumber = PR) {
  return parkReviewable(getDb(), {
    repo: REPO,
    prNumber,
    reason: e.reason,
    headSha: e.headSha,
    prUpdatedAt: e.prUpdatedAt,
    rawEventJson: JSON.stringify({ repo: REPO, prNumber, headSha: e.headSha, reason: e.reason }),
  });
}

async function row(prNumber = PR) {
  return getDb().get<{ head_sha: string; reason: string; pr_updated_at: string; released_at: string | null }>(
    'SELECT head_sha, reason, pr_updated_at, released_at FROM pending_reviewable_prs WHERE repo = ? AND pr_number = ?',
    REPO,
    prNumber,
  );
}

beforeEach(async () => {
  await runMigrations(await initTestDb());
});
afterEach(async () => {
  await closeDb();
});

describe('parkReviewable ordering', () => {
  it('keeps the park at the new head when older opened/synchronize deliveries are replayed (prod #14495)', async () => {
    expect(await park(SYNC_888)).toBe('parked');

    // Hours later, both older deliveries are redelivered from the App's log.
    expect(await park(OPENED_725)).toBe('superseded');
    expect(await park(SYNC_573)).toBe('superseded');

    expect(await row()).toMatchObject({ head_sha: SYNC_888.headSha, reason: 'synchronize', released_at: null });
    // CI for 573bd28e4 already finished; its check_suite must find nothing.
    expect(await findParkedByHead(getDb(), REPO, SYNC_573.headSha)).toBeNull();
    // The current head still releases normally.
    expect(await findParkedByHead(getDb(), REPO, SYNC_888.headSha)).toMatchObject({ prNumber: PR });
  });

  it('settles on the newest event whatever order an out-of-order pair arrives in', async () => {
    expect(await park(SYNC_888)).toBe('parked');
    expect(await park(SYNC_573)).toBe('superseded');
    expect((await row())?.head_sha).toBe(SYNC_888.headSha);

    expect(await park(SYNC_573, PR + 1)).toBe('parked');
    expect(await park(SYNC_888, PR + 1)).toBe('parked');
    expect((await row(PR + 1))?.head_sha).toBe(SYNC_888.headSha);
  });

  it('moves the park forward on a normal newer synchronize', async () => {
    expect(await park(OPENED_725)).toBe('parked');
    expect(await park(SYNC_573)).toBe('parked');
    expect(await row()).toMatchObject({ head_sha: SYNC_573.headSha, pr_updated_at: SYNC_573.prUpdatedAt });
    expect(await findParkedByHead(getDb(), REPO, OPENED_725.headSha)).toBeNull();
  });

  it('treats a retry of the waiting event as the same park', async () => {
    expect(await park(SYNC_573)).toBe('parked');
    expect(await park(SYNC_573)).toBe('parked');
    expect(await getDb().all('SELECT 1 FROM pending_reviewable_prs')).toHaveLength(1);
  });
});

describe('release keeps the PR ordered', () => {
  it('does not re-park an old event replayed after the release', async () => {
    await park(SYNC_573);
    await markParkReleased(getDb(), REPO, PR, SYNC_573.headSha);

    expect(await park(OPENED_725)).toBe('superseded');
    // The reviewed event itself, redelivered, does not park the PR again.
    expect(await park(SYNC_573)).toBe('superseded');

    expect((await row())?.released_at).not.toBeNull();
    expect(await findParkedByHead(getDb(), REPO, OPENED_725.headSha)).toBeNull();
    expect(await findParkedByHead(getDb(), REPO, SYNC_573.headSha)).toBeNull();
  });

  it('parks a genuinely newer push after the release', async () => {
    await park(SYNC_573);
    await markParkReleased(getDb(), REPO, PR, SYNC_573.headSha);

    expect(await park(SYNC_888)).toBe('parked');
    expect(await row()).toMatchObject({ head_sha: SYNC_888.headSha, released_at: null });
    expect(await findParkedByHead(getDb(), REPO, SYNC_888.headSha)).toMatchObject({ prNumber: PR });
  });

  it('marks only the released head, so a push that landed during the release keeps waiting', async () => {
    await park(SYNC_573);
    await park(SYNC_888);
    await markParkReleased(getDb(), REPO, PR, SYNC_573.headSha);

    expect(await row()).toMatchObject({ head_sha: SYNC_888.headSha, released_at: null });
  });

  it('a released row is gone once the PR closes', async () => {
    await park(SYNC_573);
    await markParkReleased(getDb(), REPO, PR, SYNC_573.headSha);
    await deleteParked(getDb(), REPO, PR);
    expect(await row()).toBeUndefined();
  });
});

describe('rows without an ordering key', () => {
  it('lets any event replace a row parked before migration 951 left pr_updated_at empty', async () => {
    await getDb().run(
      `INSERT INTO pending_reviewable_prs (repo, pr_number, head_sha, reason, raw_event_json, parked_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      REPO,
      PR,
      'legacyhead',
      'synchronize',
      '{}',
      '2026-11-01T00:00:00.000Z',
    );
    expect(await park(OPENED_725)).toBe('parked');
    expect(await row()).toMatchObject({ head_sha: OPENED_725.headSha, pr_updated_at: OPENED_725.prUpdatedAt });
  });
});
