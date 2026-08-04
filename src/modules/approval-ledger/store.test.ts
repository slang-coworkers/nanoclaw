import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import {
  getDecisionSessionsForPr,
  isValidDecision,
  recordHumanVerdict,
  upsertDecision,
  type DecisionWrite,
} from './store.js';

beforeEach(() => {
  initTestDb();
});

afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
});

function baseWrite(overrides: Partial<DecisionWrite> = {}): DecisionWrite {
  return {
    repo: 'shader-slang/slang',
    prNumber: 11993,
    commitSha: 'abc123def456abc123def456abc123def456abcd',
    mode: 'live',
    decision: 'WOULD_APPROVE',
    reasonCode: null,
    reviewDiffHash: 'dh1',
    policyVersion: 'v0-shadow',
    clausesJson: '{"pass":["author_trust"]}',
    challengerJson: 'CHALLENGER_CLEAN',
    agentGroupId: 'g1',
    sessionId: 's1',
    threadId: 'gh-pr-shader-slang/slang-11993',
    decidedAt: '2026-07-09T00:00:00Z',
    ...overrides,
  };
}

describe('isValidDecision', () => {
  it('accepts the four closed states, rejects anything else', () => {
    for (const d of ['WOULD_APPROVE', 'BLOCK', 'ABSTAIN_POLICY', 'ABSTAIN_INFRA']) {
      expect(isValidDecision(d)).toBe(true);
    }
    expect(isValidDecision('APPROVE')).toBe(false);
    expect(isValidDecision('')).toBe(false);
    expect(isValidDecision('would_approve')).toBe(false);
  });
});

describe('upsertDecision', () => {
  it('inserts one decision row keyed on (repo, pr, commit)', () => {
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite());
    const row = db
      .prepare(
        'SELECT decision, mode, policy_version, human_verdict FROM approval_decisions WHERE repo=? AND pr_number=? AND commit_sha=?',
      )
      .get('shader-slang/slang', 11993, 'abc123def456abc123def456abc123def456abcd') as Record<string, unknown>;
    expect(row.decision).toBe('WOULD_APPROVE');
    expect(row.mode).toBe('live');
    expect(row.policy_version).toBe('v0-shadow');
    expect(row.human_verdict).toBeNull();
  });

  it('replaces the decision on a re-run of the same commit (last-writer-wins)', () => {
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite());
    upsertDecision(db, baseWrite({ decision: 'ABSTAIN_POLICY', reasonCode: 'OPEN_GAP' }));
    const rows = db.prepare('SELECT decision, reason_code FROM approval_decisions').all() as Array<
      Record<string, unknown>
    >;
    expect(rows).toHaveLength(1);
    expect(rows[0].decision).toBe('ABSTAIN_POLICY');
    expect(rows[0].reason_code).toBe('OPEN_GAP');
  });

  it('a distinct commit is a distinct row (one per reviewed revision)', () => {
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite());
    upsertDecision(db, baseWrite({ commitSha: 'ffffffffffffffffffffffffffffffffffffffff' }));
    const count = db.prepare('SELECT COUNT(*) c FROM approval_decisions').get() as { c: number };
    expect(count.c).toBe(2);
  });
});

describe('recordHumanVerdict', () => {
  it('stamps the human verdict onto an existing decision row', () => {
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite());
    const joined = recordHumanVerdict(
      db,
      'shader-slang/slang',
      11993,
      'abc123def456abc123def456abc123def456abcd',
      'APPROVED',
    );
    expect(joined).toBe(true);
    const row = db
      .prepare('SELECT human_verdict FROM approval_decisions WHERE commit_sha=?')
      .get('abc123def456abc123def456abc123def456abcd') as { human_verdict: string };
    expect(row.human_verdict).toBe('APPROVED');
  });

  it('is a no-op when no decision row exists (human review preceded a decision)', () => {
    const db = initTestDb();
    runMigrations(db);
    const joined = recordHumanVerdict(db, 'shader-slang/slang', 999, 'nope', 'CHANGES_REQUESTED');
    expect(joined).toBe(false);
  });

  it('preserves the joined human verdict across a decision re-run', () => {
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite());
    recordHumanVerdict(
      db,
      'shader-slang/slang',
      11993,
      'abc123def456abc123def456abc123def456abcd',
      'CHANGES_REQUESTED',
    );
    // Re-decide the same commit — human_verdict must survive (COALESCE subquery).
    upsertDecision(db, baseWrite({ decision: 'BLOCK' }));
    const row = db
      .prepare('SELECT decision, human_verdict FROM approval_decisions WHERE commit_sha=?')
      .get('abc123def456abc123def456abc123def456abcd') as Record<string, unknown>;
    expect(row.decision).toBe('BLOCK');
    expect(row.human_verdict).toBe('CHANGES_REQUESTED');
  });
});

describe('recordHumanVerdict — head advanced past the decision', () => {
  it('stamps the latest unstamped decision when the merge head is not a decided commit', () => {
    // Regression (prod 2026-08-04): a PR decided at head X routinely gains
    // commits and merges at head Y. The exact-match UPDATE matched nothing,
    // changed 0 rows and returned false SILENTLY — 22 of 26 unstamped terminal
    // PRs had advanced this way, leaving a 42% hole in the calibration data.
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    upsertDecision(
      db,
      baseWrite({ commitSha: 'b'.repeat(40), decision: 'ABSTAIN_POLICY', decidedAt: '2026-07-09T01:00:00Z' }),
    );

    // Merged at a head the approver never decided on.
    const ok = recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED');
    expect(ok).toBe(true);

    const rows = db
      .prepare('SELECT commit_sha, human_verdict FROM approval_decisions ORDER BY decided_at ASC')
      .all() as Array<{ commit_sha: string; human_verdict: string | null }>;
    // Only the LATEST decision is credited; the superseded R0 stays unstamped.
    expect(rows[0].human_verdict).toBeNull();
    expect(rows[1].commit_sha).toBe('b'.repeat(40));
    expect(rows[1].human_verdict).toBe('MERGED');
  });

  it('never overwrites a verdict that was already observed', () => {
    const db = initTestDb();
    runMigrations(db);
    upsertDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'CHANGES_REQUESTED');

    // A later terminal event must not clobber the real observation.
    const ok = recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED');
    expect(ok).toBe(false);
    const row = db.prepare('SELECT human_verdict FROM approval_decisions WHERE commit_sha=?').get('a'.repeat(40)) as {
      human_verdict: string;
    };
    expect(row.human_verdict).toBe('CHANGES_REQUESTED');
  });

  it('returns false when no decision exists for the PR at all', () => {
    const db = initTestDb();
    runMigrations(db);
    expect(recordHumanVerdict(db, 'shader-slang/slang', 424242, 'f'.repeat(40), 'MERGED')).toBe(false);
  });
});

describe('getDecisionSessionsForPr', () => {
  it('returns the approver session rows that decided a PR, oldest first', () => {
    const db = initTestDb();
    runMigrations(db);
    // R0 then R1 (a synchronize re-decision) from the same approver session.
    upsertDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    upsertDecision(
      db,
      baseWrite({ commitSha: 'b'.repeat(40), decision: 'ABSTAIN_POLICY', decidedAt: '2026-07-09T01:00:00Z' }),
    );
    const rows = getDecisionSessionsForPr(db, 'shader-slang/slang', 11993);
    expect(rows.length).toBe(2);
    expect(rows[0].commit_sha).toBe('a'.repeat(40)); // oldest (R0) first
    expect(rows[0].agent_group_id).toBe('g1');
    expect(rows[0].thread_id).toBe('gh-pr-shader-slang/slang-11993');
    expect(rows[1].decision).toBe('ABSTAIN_POLICY');
  });

  it('is empty when no approver decided the PR (nothing to route/learn)', () => {
    const db = initTestDb();
    runMigrations(db);
    expect(getDecisionSessionsForPr(db, 'shader-slang/slang', 424242)).toEqual([]);
  });
});
