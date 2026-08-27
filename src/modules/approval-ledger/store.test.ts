import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeDb, initTestDb } from '../../db/connection.js';
import type { DbDriver } from '../../db/driver.js';
import { runMigrations } from '../../db/migrations/index.js';
import { migration935 } from '../../db/migrations/935-approval-decisions-quarantine-legacy.js';
import {
  appendDecision,
  getDecisionSessionsForPr,
  isValidDecision,
  listTrustedDecisions,
  recordHumanVerdict,
  TRUSTED_PROVENANCE,
  type DecisionWrite,
  type VerdictSource,
} from './store.js';

beforeEach(async () => {
  await initTestDb();
});

afterEach(async () => {
  await closeDb();
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

/** Distinct webhook deliveries — the provenance key for a human verdict. */
const gh = (id: string): VerdictSource => ({ kind: 'github_webhook', eventId: id });

interface LegacyOpts {
  commitSha: string;
  decision?: string;
  decidedAt?: string;
  humanVerdict?: string | null;
  verdictSourceEventId?: string | null;
  prNumber?: number;
}

/**
 * A pre-enforcement row still sitting in the LIVE table — the dangerous state:
 * a half-applied upgrade, a restored backup, or simply the moment before
 * migration 935 runs. This is what the two PR #1110 review blockers are about,
 * so the tests deliberately reconstruct it rather than the tidy post-migration
 * shape. Written by hand because no code path produces one any more.
 */
async function seedLegacyInLiveTable(db: DbDriver, opts: LegacyOpts): Promise<void> {
  await db.run(
    `INSERT INTO approval_decisions
       (repo, pr_number, commit_sha, mode, decision, human_verdict, agent_group_id, session_id, thread_id,
        decided_at, provenance, verdict_source, verdict_source_event_id)
     VALUES ('shader-slang/slang', @prNumber, @commitSha, 'live', @decision, @humanVerdict, 'g-legacy', 's-legacy',
        'gh-pr-legacy', @decidedAt, 'legacy', @verdictSource, @eventId)`,
    legacyParams(opts),
  );
}

/** The same row after migration 935 has parked it in the history table. */
async function seedLegacyHistory(db: DbDriver, opts: LegacyOpts): Promise<void> {
  await db.run(
    `INSERT INTO approval_decisions_legacy
       (repo, pr_number, commit_sha, mode, decision, human_verdict, agent_group_id, session_id, thread_id,
        decided_at, provenance, verdict_source, verdict_source_event_id)
     VALUES ('shader-slang/slang', @prNumber, @commitSha, 'live', @decision, @humanVerdict, 'g-legacy', 's-legacy',
        'gh-pr-legacy', @decidedAt, 'legacy', @verdictSource, @eventId)`,
    legacyParams(opts),
  );
}

/**
 * migration935 is declared as the `Migration` union, whose `up` takes either the
 * portable driver or a raw SQLite handle. Narrow on the discriminant so the test
 * hands it the driver its own implementation actually accepts.
 */
async function runMigration935(db: DbDriver): Promise<void> {
  if (migration935.sqliteOnly) throw new Error('migration935 is portable — expected the DbDriver signature');
  await migration935.up(db);
}

function legacyParams(opts: LegacyOpts) {
  return {
    prNumber: opts.prNumber ?? 11993,
    commitSha: opts.commitSha,
    decision: opts.decision ?? 'WOULD_APPROVE',
    humanVerdict: opts.humanVerdict ?? null,
    decidedAt: opts.decidedAt ?? '2026-01-01T00:00:00Z',
    verdictSource: opts.verdictSourceEventId ? 'github_webhook' : null,
    eventId: opts.verdictSourceEventId ?? null,
  };
}

describe('isValidDecision', () => {
  it('accepts the three closed states, rejects anything else', () => {
    for (const d of ['WOULD_APPROVE', 'BLOCK', 'ABSTAIN_POLICY']) {
      expect(isValidDecision(d)).toBe(true);
    }
    expect(isValidDecision('APPROVE')).toBe(false);
    expect(isValidDecision('')).toBe(false);
    expect(isValidDecision('would_approve')).toBe(false);
  });

  // ABSTAIN_INFRA was retired in task #14 — folded into ABSTAIN_POLICY plus an
  // infra reason_code. It is no longer a decision state, so isValidDecision
  // rejects it and the record_decision gate (validateRecordDecision, index.ts)
  // drops any container still emitting it.
  it('rejects the retired ABSTAIN_INFRA state', () => {
    expect(isValidDecision('ABSTAIN_INFRA')).toBe(false);
  });
});

describe('appendDecision', () => {
  it('inserts one decision row keyed on (repo, pr, commit), stamped as verified provenance', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    expect((await appendDecision(db, baseWrite())).status).toBe('recorded');
    const row = (await db.get<Record<string, unknown>>(
      'SELECT decision, mode, policy_version, human_verdict, provenance FROM approval_decisions WHERE repo=? AND pr_number=? AND commit_sha=?',
      'shader-slang/slang',
      11993,
      'abc123def456abc123def456abc123def456abcd',
    ))!;
    expect(row.decision).toBe('WOULD_APPROVE');
    expect(row.mode).toBe('live');
    expect(row.policy_version).toBe('v0-shadow');
    expect(row.human_verdict).toBeNull();
    expect(row.provenance).toBe(TRUSTED_PROVENANCE);
  });

  it('is idempotent: re-recording the SAME decision for a commit is a no-op, not a second row', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    expect((await appendDecision(db, baseWrite())).status).toBe('duplicate');
    const count = (await db.get<{ c: number }>('SELECT COUNT(*) c FROM approval_decisions'))!;
    expect(count.c).toBe(1);
  });

  it('REFUSES a different decision for a commit already decided — append-only, first write wins', async () => {
    // F14: INSERT OR REPLACE let any caller overwrite a recorded decision.
    // Overwrite is the primitive that turns "append a false row" (visible
    // beside the true one) into "erase the true row" (visible nowhere).
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ decision: 'BLOCK', reasonCode: 'CLAUSE_FAIL:tests' }));
    const outcome = await appendDecision(db, baseWrite({ decision: 'WOULD_APPROVE', reasonCode: null }));
    expect(outcome.status).toBe('conflict');
    if (outcome.status === 'conflict') expect(outcome.existingDecision).toBe('BLOCK');

    const rows = await db.all<Record<string, unknown>>('SELECT decision, reason_code FROM approval_decisions');
    expect(rows).toHaveLength(1);
    expect(rows[0].decision).toBe('BLOCK');
    expect(rows[0].reason_code).toBe('CLAUSE_FAIL:tests');
  });

  it('a distinct commit is a distinct row (one per reviewed revision)', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    await appendDecision(db, baseWrite({ commitSha: 'ffffffffffffffffffffffffffffffffffffffff' }));
    const count = (await db.get<{ c: number }>('SELECT COUNT(*) c FROM approval_decisions'))!;
    expect(count.c).toBe(2);
  });

  it('treats a sha differing only in case as the same reviewed commit', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40) }));
    expect((await appendDecision(db, baseWrite({ commitSha: 'A'.repeat(40) }))).status).toBe('duplicate');
    const count = (await db.get<{ c: number }>('SELECT COUNT(*) c FROM approval_decisions'))!;
    expect(count.c).toBe(1);
  });
});

describe('appendDecision — input domains', () => {
  it('rejects a repo that is not owner/name', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    const outcome = await appendDecision(db, baseWrite({ repo: 'not-a-repo' }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.field).toBe('repo');
    expect((await db.get<{ c: number }>('SELECT COUNT(*) c FROM approval_decisions'))!.c).toBe(0);
  });

  it('rejects a commit_sha that is not a git object name', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    const outcome = await appendDecision(db, baseWrite({ commitSha: 'HEAD~1' }));
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') expect(outcome.field).toBe('commit_sha');
  });

  it('rejects a non-positive or non-integer PR number', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    for (const pr of [0, -3, 1.5, Number.NaN, 99_999_999]) {
      const outcome = await appendDecision(db, baseWrite({ prNumber: pr }));
      expect(outcome.status, `pr_number ${pr} should be rejected`).toBe('invalid');
    }
  });

  it('normalizes an unusable decided_at to host time instead of storing it', async () => {
    // The ordering the join depends on (`ORDER BY datetime(decided_at)`) is
    // only as sound as this field. Prod slang#11530 held a decision stamped
    // 730h after its own merge.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ decidedAt: '2044-01-01T00:00:00Z' }));
    const row = (await db.get<{ decided_at: string }>('SELECT decided_at FROM approval_decisions'))!;
    expect(Date.parse(row.decided_at)).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('caps an oversized evidence blob rather than storing it whole', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ clausesJson: 'x'.repeat(500_000) }));
    const row = (await db.get<{ clauses_json: string }>('SELECT clauses_json FROM approval_decisions'))!;
    expect(row.clauses_json.length).toBe(64 * 1024);
  });

  it('normalizes an unrecognized mode rather than dropping the decision', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    expect((await appendDecision(db, baseWrite({ mode: 'sideways' }))).status).toBe('recorded');
    const row = (await db.get<{ mode: string }>('SELECT mode FROM approval_decisions'))!;
    expect(row.mode).toBe('unknown');
  });
});

describe('listTrustedDecisions', () => {
  it('excludes rows whose provenance predates enforcement', async () => {
    // F14: metrics consumed every row with no provenance filter, so a
    // pre-enforcement (or forged) row moved the calibration numbers by exactly
    // as much as a verified one.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40) }));
    await seedLegacyInLiveTable(db, { commitSha: 'b'.repeat(40) });

    // Seeded into the LIVE table, i.e. before migration 935 has quarantined it —
    // the filter has to hold on a half-migrated database too.
    const trusted = await listTrustedDecisions(db);
    expect(trusted.map((r) => r.commit_sha)).toEqual(['a'.repeat(40)]);
    // The legacy row is still readable history — it just isn't evidence.
    expect((await db.get<{ c: number }>('SELECT COUNT(*) c FROM approval_decisions'))!.c).toBe(2);
  });
});

describe('migration 935 — pre-enforcement rows are quarantined out of the trusted table', () => {
  it('moves legacy rows verbatim into approval_decisions_legacy and leaves verified rows alone', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40) }));
    // Simulate a row that predates enforcement, then re-run the migration set.
    await db.run(
      `INSERT INTO approval_decisions
         (repo, pr_number, commit_sha, mode, decision, agent_group_id, session_id, decided_at, provenance)
       VALUES ('shader-slang/slang', 11993, ?, 'live', 'BLOCK', 'g-legacy', 's-legacy', '2026-01-01T00:00:00Z', 'legacy')`,
      'c'.repeat(40),
    );
    await runMigration935(db);

    const live = await db.all<{
      commit_sha: string;
      provenance: string;
    }>('SELECT commit_sha, provenance FROM approval_decisions');
    expect(live).toEqual([{ commit_sha: 'a'.repeat(40), provenance: TRUSTED_PROVENANCE }]);

    // Nothing was discarded.
    const archived = await db.all('SELECT commit_sha, decision, agent_group_id FROM approval_decisions_legacy');
    expect(archived).toEqual([{ commit_sha: 'c'.repeat(40), decision: 'BLOCK', agent_group_id: 'g-legacy' }]);
  });

  it('is safe to re-run', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyInLiveTable(db, { commitSha: 'c'.repeat(40) });
    await runMigration935(db);
    await runMigration935(db);
    expect((await db.get<{ c: number }>('SELECT COUNT(*) c FROM approval_decisions_legacy'))!.c).toBe(1);
  });
});

describe('a pre-enforcement row cannot lock out the authorized approver (PR #1110 review, P1a)', () => {
  // Before the capability guard, ANY container could seed an arbitrary
  // (repo, pr, commit_sha) key. With the append-only write path and the PK on
  // that triple, such a row would win forever — an identical verdict reading as
  // an idempotent duplicate, a different one refused as a conflict — so the
  // closed vulnerability would survive as a denial-of-service primitive against
  // the trusted ledger that replaced it.

  it('a legacy row with the SAME verdict does not swallow the verified write', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyInLiveTable(db, { commitSha: 'a'.repeat(40), decision: 'WOULD_APPROVE' });

    const outcome = await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decision: 'WOULD_APPROVE' }));
    expect(outcome.status).toBe('recorded');

    const row = (await db.get<{ provenance: string; agent_group_id: string }>(
      'SELECT provenance, agent_group_id FROM approval_decisions WHERE commit_sha=?',
      'a'.repeat(40),
    ))!;
    expect(row.provenance).toBe(TRUSTED_PROVENANCE);
    expect(row.agent_group_id).toBe('g1');
    expect(await listTrustedDecisions(db)).toHaveLength(1);
  });

  it('a legacy row with a DIFFERENT verdict does not refuse the verified write', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyInLiveTable(db, { commitSha: 'a'.repeat(40), decision: 'BLOCK' });

    const outcome = await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decision: 'WOULD_APPROVE' }));
    expect(outcome.status).toBe('recorded');

    const row = await db.get('SELECT decision, provenance FROM approval_decisions WHERE commit_sha=?', 'a'.repeat(40));
    expect(row).toEqual({ decision: 'WOULD_APPROVE', provenance: TRUSTED_PROVENANCE });
  });

  it('the displaced row is preserved, not deleted', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyInLiveTable(db, { commitSha: 'a'.repeat(40), decision: 'BLOCK' });
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40) }));

    const archived = await db.get(
      'SELECT decision, agent_group_id FROM approval_decisions_legacy WHERE commit_sha=?',
      'a'.repeat(40),
    );
    expect(archived).toEqual({ decision: 'BLOCK', agent_group_id: 'g-legacy' });
  });

  it('trusted-vs-trusted append-only semantics are unchanged', async () => {
    // The displacement path must not have loosened first-write-wins between two
    // genuinely verified rows.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decision: 'BLOCK' }));
    const outcome = await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decision: 'WOULD_APPROVE' }));
    expect(outcome.status).toBe('conflict');
    const row = await db.get('SELECT decision FROM approval_decisions WHERE commit_sha=?', 'a'.repeat(40));
    expect(row).toEqual({ decision: 'BLOCK' });
  });
});

describe('a pre-enforcement row cannot consume the trusted human verdict (PR #1110 review, P1b)', () => {
  // The verdict arrives once, from the GitHub delivery that observed the human.
  // If a legacy row absorbs it, the verified decision is never scored — and the
  // calibration number that humans use to decide how far to trust the approver
  // quietly loses the case it was supposed to measure.

  it('the EXACT-head join skips a legacy row at that head', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyInLiveTable(db, { commitSha: 'a'.repeat(40) });
    await appendDecision(db, baseWrite({ commitSha: 'b'.repeat(40) }));

    // The human reviewed 'a' — the legacy head. There is no trusted row there,
    // so the fallback must credit the verified decision instead of stamping it.
    expect(await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'APPROVED', gh('d-1'))).toBe(true);

    const legacy = (await db.get<{ human_verdict: string | null }>(
      'SELECT human_verdict FROM approval_decisions WHERE commit_sha=?',
      'a'.repeat(40),
    ))!;
    expect(legacy.human_verdict).toBeNull();
    const trusted = (await db.get<{ human_verdict: string; join_mode: string }>(
      'SELECT human_verdict, join_mode FROM approval_decisions WHERE commit_sha=?',
      'b'.repeat(40),
    ))!;
    expect(trusted.human_verdict).toBe('APPROVED');
    expect(trusted.join_mode).toBe('head_advanced');
  });

  it('the latest-unstamped fallback ignores a NEWER legacy row', async () => {
    // Legacy decided_at values were never validated; the store's own notes cite
    // a prod row stamped 730h after its own merge. An unnormalized future
    // timestamp is exactly what wins a "latest" ordering.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'b'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    await seedLegacyInLiveTable(db, { commitSha: 'a'.repeat(40), decidedAt: '2044-01-01T00:00:00Z' });

    expect(await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED', gh('d-1'))).toBe(true);

    const trusted = (await db.get<{ human_verdict: string }>(
      'SELECT human_verdict FROM approval_decisions WHERE commit_sha=?',
      'b'.repeat(40),
    ))!;
    expect(trusted.human_verdict).toBe('MERGED');
  });

  it('redelivery idempotency is scoped to trusted rows', async () => {
    // A legacy row carrying the same delivery id must not make the real
    // webhook look already-applied and skip the verified decision.
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyInLiveTable(db, { commitSha: 'a'.repeat(40), verdictSourceEventId: 'd-1', humanVerdict: 'MERGED' });
    await appendDecision(db, baseWrite({ commitSha: 'b'.repeat(40) }));

    expect(await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'b'.repeat(40), 'MERGED', gh('d-1'))).toBe(true);
    const trusted = (await db.get<{ human_verdict: string }>(
      'SELECT human_verdict FROM approval_decisions WHERE commit_sha=?',
      'b'.repeat(40),
    ))!;
    expect(trusted.human_verdict).toBe('MERGED');
  });
});

describe('recordHumanVerdict — provenance', () => {
  it('refuses a verdict with no source event id', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    expect(
      await recordHumanVerdict(
        db,
        'shader-slang/slang',
        11993,
        'abc123def456abc123def456abc123def456abcd',
        'APPROVED',
        {
          kind: 'github_webhook',
          eventId: '',
        },
      ),
    ).toBe(false);
    const row = (await db.get<{ human_verdict: string | null }>('SELECT human_verdict FROM approval_decisions'))!;
    expect(row.human_verdict).toBeNull();
  });

  it('refuses a verdict outside the closed domain', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    expect(
      await recordHumanVerdict(
        db,
        'shader-slang/slang',
        11993,
        'abc123def456abc123def456abc123def456abcd',
        'LGTM_SHIP_IT',
        gh('d-1'),
      ),
    ).toBe(false);
  });

  it('records the source kind and event id on the stamped row', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    await recordHumanVerdict(
      db,
      'shader-slang/slang',
      11993,
      'abc123def456abc123def456abc123def456abcd',
      'APPROVED',
      gh('delivery-abc'),
    );
    const row = (await db.get<Record<string, unknown>>(
      'SELECT verdict_source, verdict_source_event_id FROM approval_decisions',
    ))!;
    expect(row.verdict_source).toBe('github_webhook');
    expect(row.verdict_source_event_id).toBe('delivery-abc');
  });

  it('is idempotent under webhook redelivery of the same event', async () => {
    // GitHub redelivers routinely; a redelivery is not a second observation.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40) }));
    await appendDecision(db, baseWrite({ commitSha: 'b'.repeat(40), decidedAt: '2026-07-09T02:00:00Z' }));
    expect(await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'MERGED', gh('same'))).toBe(true);
    // Same delivery again — must not consume the second unstamped decision.
    expect(await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'MERGED', gh('same'))).toBe(false);
    const stamped = (await db.get<{
      c: number;
    }>('SELECT COUNT(*) c FROM approval_decisions WHERE human_verdict IS NOT NULL'))!;
    expect(stamped.c).toBe(1);
  });
});

describe('recordHumanVerdict', () => {
  it('stamps the human verdict onto an existing decision row', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    const joined = await recordHumanVerdict(
      db,
      'shader-slang/slang',
      11993,
      'abc123def456abc123def456abc123def456abcd',
      'APPROVED',
      gh('d-1'),
    );
    expect(joined).toBe(true);
    const row = (await db.get<{ human_verdict: string }>(
      'SELECT human_verdict FROM approval_decisions WHERE commit_sha=?',
      'abc123def456abc123def456abc123def456abcd',
    ))!;
    expect(row.human_verdict).toBe('APPROVED');
  });

  it('is a no-op when no decision row exists (human review preceded a decision)', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    expect(await recordHumanVerdict(db, 'shader-slang/slang', 999, 'nope', 'CHANGES_REQUESTED', gh('d-1'))).toBe(false);
  });

  it('preserves the joined human verdict when the same decision is re-sent', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite());
    await recordHumanVerdict(
      db,
      'shader-slang/slang',
      11993,
      'abc123def456abc123def456abc123def456abcd',
      'CHANGES_REQUESTED',
      gh('d-1'),
    );
    // A re-send of the same decision is a no-op, so the verdict cannot be lost.
    expect((await appendDecision(db, baseWrite())).status).toBe('duplicate');
    const row = (await db.get<Record<string, unknown>>(
      'SELECT decision, human_verdict FROM approval_decisions WHERE commit_sha=?',
      'abc123def456abc123def456abc123def456abcd',
    ))!;
    expect(row.decision).toBe('WOULD_APPROVE');
    expect(row.human_verdict).toBe('CHANGES_REQUESTED');
  });
});

describe('recordHumanVerdict — head advanced past the decision', () => {
  it('stamps the latest unstamped decision when the merge head is not a decided commit', async () => {
    // Regression (prod 2026-08-04): a PR decided at head X routinely gains
    // commits and merges at head Y. The exact-match UPDATE matched nothing,
    // changed 0 rows and returned false SILENTLY — 22 of 26 unstamped terminal
    // PRs had advanced this way, leaving a 42% hole in the calibration data.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    await appendDecision(
      db,
      baseWrite({ commitSha: 'b'.repeat(40), decision: 'ABSTAIN_POLICY', decidedAt: '2026-07-09T01:00:00Z' }),
    );

    // Merged at a head the approver never decided on.
    const ok = await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED', gh('d-1'));
    expect(ok).toBe(true);

    const rows = await db.all<{ commit_sha: string; human_verdict: string | null }>(
      'SELECT commit_sha, human_verdict FROM approval_decisions ORDER BY decided_at ASC',
    );
    // Only the LATEST decision is credited; the superseded R0 stays unstamped.
    expect(rows[0].human_verdict).toBeNull();
    expect(rows[1].commit_sha).toBe('b'.repeat(40));
    expect(rows[1].human_verdict).toBe('MERGED');
  });

  it('does not overwrite on the EXACT path either — first verdict wins', async () => {
    // Reviewer finding on #1069: the exact UPDATE had no `human_verdict IS NULL`
    // guard, so identical human behaviour produced different ground truth purely
    // by whether commits landed in between — a reviewer requesting changes and
    // then merging with no new commits had the CHANGES_REQUESTED silently
    // replaced by MERGED, erasing the evidence of a false approve.
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40) }));
    expect(
      await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'CHANGES_REQUESTED', gh('d-1')),
    ).toBe(true);
    // Same sha again, a genuinely later event — the head did NOT advance.
    expect(await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'MERGED', gh('d-2'))).toBe(false);
    const row = (await db.get<{ human_verdict: string; join_mode: string }>(
      'SELECT human_verdict, join_mode FROM approval_decisions WHERE commit_sha=?',
      'a'.repeat(40),
    ))!;
    expect(row.human_verdict).toBe('CHANGES_REQUESTED');
    expect(row.join_mode).toBe('exact');
  });

  it('records join_mode so precision can be split by whether the head moved', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED', gh('d-1'));
    const row = (await db.get<{
      join_mode: string;
    }>('SELECT join_mode FROM approval_decisions WHERE commit_sha=?', 'a'.repeat(40)))!;
    expect(row.join_mode).toBe('head_advanced');
  });

  it('picks the latest by datetime(), not lexicographic text, and breaks ties by rowid', async () => {
    // A bare TEXT sort mis-orders offset forms and truncated fractions, and an
    // exact tie credits the FIRST row. New writes are normalized to Z-form by
    // validate.ts, so these are written directly to reconstruct rows already in
    // prod — but as TRUSTED rows, because this is about ordering, not
    // provenance.
    const db = await initTestDb();
    await runMigrations(db);
    // '…14:00:00+02:00' is 12:00:00Z — EARLIER than 12:30:00Z — but sorts above it as text.
    for (const [sha, decided] of [
      ['a'.repeat(40), '2026-07-09T14:00:00+02:00'],
      ['b'.repeat(40), '2026-07-09T12:30:00Z'],
    ] as const) {
      await db.run(
        `INSERT INTO approval_decisions
           (repo, pr_number, commit_sha, mode, decision, agent_group_id, session_id, decided_at, provenance)
         VALUES ('shader-slang/slang', 11993, ?, 'live', 'WOULD_APPROVE', 'g1', 's1', ?, 'agent_verified')`,
        sha,
        decided,
      );
    }
    await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED', gh('d-1'));
    const rows = await db.all<{
      commit_sha: string;
      human_verdict: string | null;
    }>('SELECT commit_sha, human_verdict FROM approval_decisions');
    const stamped = rows.find((r) => r.human_verdict !== null);
    // The genuinely-latest decision is the 12:30Z row, not the offset-form one.
    expect(stamped?.commit_sha).toBe('b'.repeat(40));
  });

  it('never overwrites a verdict that was already observed', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'a'.repeat(40), 'CHANGES_REQUESTED', gh('d-1'));

    // A later terminal event must not clobber the real observation.
    const ok = await recordHumanVerdict(db, 'shader-slang/slang', 11993, 'f'.repeat(40), 'MERGED', gh('d-2'));
    expect(ok).toBe(false);
    const row = (await db.get<{
      human_verdict: string;
    }>('SELECT human_verdict FROM approval_decisions WHERE commit_sha=?', 'a'.repeat(40)))!;
    expect(row.human_verdict).toBe('CHANGES_REQUESTED');
  });

  it('returns false when no decision exists for the PR at all', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    expect(await recordHumanVerdict(db, 'shader-slang/slang', 424242, 'f'.repeat(40), 'MERGED', gh('d-1'))).toBe(false);
  });
});

describe('getDecisionSessionsForPr', () => {
  it('returns the approver session rows that decided a PR, oldest first', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    // R0 then R1 (a synchronize re-decision) from the same approver session.
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));
    await appendDecision(
      db,
      baseWrite({ commitSha: 'b'.repeat(40), decision: 'ABSTAIN_POLICY', decidedAt: '2026-07-09T01:00:00Z' }),
    );
    const rows = await getDecisionSessionsForPr(db, 'shader-slang/slang', 11993);
    expect(rows.length).toBe(2);
    expect(rows[0].commit_sha).toBe('a'.repeat(40)); // oldest (R0) first
    expect(rows[0].agent_group_id).toBe('g1');
    expect(rows[0].thread_id).toBe('gh-pr-shader-slang/slang-11993');
    expect(rows[1].decision).toBe('ABSTAIN_POLICY');
  });

  it('still routes to sessions on quarantined rows — delivery is not calibration', async () => {
    // The review asked for the legacy learning notification to be kept as a
    // separate concern from the calibration join. An approver session that ran
    // before enforcement is a real session and should still be told how its PR
    // ended, even though its row no longer counts as evidence.
    const db = await initTestDb();
    await runMigrations(db);
    await seedLegacyHistory(db, { commitSha: 'c'.repeat(40), decidedAt: '2026-01-01T00:00:00Z' });
    await appendDecision(db, baseWrite({ commitSha: 'a'.repeat(40), decidedAt: '2026-07-09T00:00:00Z' }));

    const rows = await getDecisionSessionsForPr(db, 'shader-slang/slang', 11993);
    expect(rows.map((r) => r.agent_group_id)).toEqual(['g-legacy', 'g1']); // oldest first
    // …while calibration sees only the verified one.
    expect((await listTrustedDecisions(db)).map((r) => r.commit_sha)).toEqual(['a'.repeat(40)]);
  });

  it('is empty when no approver decided the PR (nothing to route/learn)', async () => {
    const db = await initTestDb();
    await runMigrations(db);
    expect(await getDecisionSessionsForPr(db, 'shader-slang/slang', 424242)).toEqual([]);
  });
});
