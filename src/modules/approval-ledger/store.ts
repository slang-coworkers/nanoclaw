/**
 * approval_decisions write path — the PR-approver coworker's decision ledger.
 *
 * A container agent (slang-pr-approver / slangpy-pr-approver) emits a
 * `record_decision` system action after its critique-gated decision; the
 * delivery handler (index.ts) calls appendDecision here AFTER the
 * `approval_ledger.record_decision` guard has established that the calling
 * agent group holds the ledger-writer capability. Container agents cannot
 * write v2.db directly — this is the host side of the same two-DB transport
 * used by pr-mapping's map_pr_session.
 *
 * APPEND-ONLY, keyed on (repo, pr, commit_sha). A repeat of an identical
 * decision is an idempotent no-op (retries and redeliveries are normal); a
 * repeat carrying a DIFFERENT verdict for the same reviewed commit is
 * REFUSED and logged with both values.
 *
 * This replaced INSERT OR REPLACE, whose "last-writer-wins, a corrected
 * re-run supersedes the prior row" convention could not survive the same
 * table being writable from an untrusted caller: overwrite is exactly the
 * primitive that turns "append a false row" (visible next to the true one)
 * into "erase the true row" (visible nowhere). Nothing is lost by refusing —
 * a genuinely corrected review lands on a new commit, which is a new row, and
 * an operator correcting a bad row does it host-side where it is auditable.
 *
 * `recordHumanVerdict` is the join side. It is reachable only from the trusted
 * ingestion path (webhook-github.ts), never from a container, and requires the
 * source event id that observed the human — the GitHub webhook delivery id.
 * It never touches decision fields.
 *
 * ONE TRUST LEVEL PER TABLE. `approval_decisions` holds only rows written
 * under capability enforcement; the pre-enforcement ones live in
 * `approval_decisions_legacy` (migration 935). Mixing them in one table meant
 * every read had to remember to filter, and two that didn't were real defects:
 * a legacy row could permanently block the authorized approver at a PR head
 * (the pre-guard write path let any container seed those keys, so the closed
 * hole survived as a denial-of-service primitive), and a legacy row could
 * absorb the single webhook-sourced human verdict, leaving the verified
 * decision unscoreable. Separating them makes both structurally impossible
 * rather than conventionally avoided.
 *
 * Delivery is the exception, and stays explicit: `getDecisionSessionsForPr`
 * reads BOTH tables, because telling an approver session how its PR ended is
 * routing, not calibration.
 */
import type { DbDriver } from '../../db/driver.js';
import { log } from '../../log.js';
import {
  boundBlob,
  boundLabel,
  isValidHumanVerdict,
  normalizeDecidedAt,
  normalizeMode,
  validatePrRef,
} from './validate.js';

export { isValidDecision } from './validate.js';

/**
 * Rows written under capability enforcement.
 *
 * Since migration 935 this is the only provenance `approval_decisions` holds —
 * the pre-enforcement rows live in `approval_decisions_legacy`. That is the
 * point: a table with one trust level cannot be misread by a query that forgot
 * to filter, and every existing consumer (including the funnel, which still
 * selects unfiltered) became correct without being edited. The explicit scopes
 * below are belt-and-braces for a half-migrated database.
 */
export const TRUSTED_PROVENANCE = 'agent_verified';

/** SQL predicate for "this row is calibration evidence". */
export const TRUSTED_PROVENANCE_SQL = `provenance = '${TRUSTED_PROVENANCE}'`;

/** The only ingestion path allowed to stamp a human verdict. */
export type VerdictSourceKind = 'github_webhook';

export interface VerdictSource {
  kind: VerdictSourceKind;
  /** The event id that observed the human — GitHub's X-GitHub-Delivery. */
  eventId: string;
}

export interface DecisionWrite {
  repo: string;
  prNumber: number;
  commitSha: string;
  mode: string;
  decision: string;
  reasonCode: string | null;
  reviewDiffHash: string | null;
  policyVersion: string | null;
  clausesJson: string | null;
  challengerJson: string | null;
  agentGroupId: string;
  sessionId: string;
  threadId: string | null;
  decidedAt: string;
}

export type AppendOutcome =
  | { status: 'recorded' }
  | { status: 'duplicate' }
  | { status: 'conflict'; existingDecision: string }
  | { status: 'invalid'; field: string; reason: string };

/**
 * Append one decision row. First write wins on (repo, pr, commit_sha).
 *
 * Callers get a structured outcome rather than a boolean because each branch
 * is reported differently to the agent: `duplicate` is success, `conflict` is
 * a refusal the agent should be told about, and `invalid` is a correctable
 * mistake in its own arguments.
 *
 * "First write wins" ranges over TRUSTED rows only. Migration 935 quarantines
 * the pre-enforcement ones into approval_decisions_legacy precisely so that is
 * true by construction — but a legacy row surviving here (a partially applied
 * upgrade, a restored backup) must never be able to suppress a verified
 * decision, so the conflict path below re-checks and quarantines one if it
 * finds it. Without that, a row any container could have pre-seeded before the
 * guard existed would silence the real approver at that PR head forever: the
 * closed vulnerability would live on as a denial-of-service primitive against
 * the ledger that replaced it.
 */
export async function appendDecision(db: DbDriver, w: DecisionWrite): Promise<AppendOutcome> {
  const bad = validatePrRef(w.repo, w.prNumber, w.commitSha);
  if (bad) {
    log.warn('record_decision: rejected malformed reference', { field: bad.field, reason: bad.reason });
    return { status: 'invalid', field: bad.field, reason: bad.reason };
  }

  // Normalize the key so a re-run that differs only in sha case is recognized
  // as the same reviewed commit rather than inserted as a second row.
  const commitSha = w.commitSha.toLowerCase();
  const decidedAt = normalizeDecidedAt(w.decidedAt);
  if (decidedAt.corrected) {
    log.warn('record_decision: unusable decided_at replaced with host time', {
      repo: w.repo,
      pr: w.prNumber,
      supplied: String(w.decidedAt).slice(0, 64),
      used: decidedAt.iso,
    });
  }

  // One transaction: a legacy row displaced by the retry below must not be able
  // to vanish without the verified row that replaced it landing.
  return db.transaction(() => insertDecision(db, w, commitSha, decidedAt.iso));
}

async function insertDecision(
  db: DbDriver,
  w: DecisionWrite,
  commitSha: string,
  decidedAtIso: string,
  isRetry = false,
): Promise<AppendOutcome> {
  const res = await db.run(
    `INSERT INTO approval_decisions (
         repo, pr_number, commit_sha, mode, decision, reason_code,
         review_diff_hash, policy_version, clauses_json, challenger_json,
         human_verdict, agent_group_id, session_id, thread_id, decided_at,
         provenance
       ) VALUES (
         @repo, @prNumber, @commitSha, @mode, @decision, @reasonCode,
         @reviewDiffHash, @policyVersion, @clausesJson, @challengerJson,
         NULL, @agentGroupId, @sessionId, @threadId, @decidedAt,
         @provenance
       )
       ON CONFLICT(repo, pr_number, commit_sha) DO NOTHING`,
    {
      repo: w.repo,
      prNumber: w.prNumber,
      commitSha,
      mode: normalizeMode(w.mode),
      decision: w.decision,
      reasonCode: boundLabel(w.reasonCode),
      reviewDiffHash: boundLabel(w.reviewDiffHash),
      policyVersion: boundLabel(w.policyVersion),
      clausesJson: boundBlob(w.clausesJson),
      challengerJson: boundBlob(w.challengerJson),
      agentGroupId: w.agentGroupId,
      sessionId: w.sessionId,
      threadId: w.threadId,
      decidedAt: decidedAtIso,
      provenance: TRUSTED_PROVENANCE,
    },
  );

  if (res.changes > 0) {
    log.info('approval decision recorded', {
      repo: w.repo,
      pr: w.prNumber,
      commit: commitSha.slice(0, 12),
      decision: w.decision,
      reason: w.reasonCode ?? '',
    });
    return { status: 'recorded' };
  }

  const existing = await db.get<{ decision: string; provenance: string | null }>(
    'SELECT decision, provenance FROM approval_decisions WHERE repo=? AND pr_number=? AND commit_sha=?',
    w.repo,
    w.prNumber,
    commitSha,
  );

  // An untrusted occupant is not evidence and does not get to win. Move it to
  // the history table and let the verified write take the key. Guarded by
  // isRetry so a pathological state cannot loop.
  if (existing && existing.provenance !== TRUSTED_PROVENANCE && !isRetry) {
    await quarantineLegacyRow(db, w.repo, w.prNumber, commitSha);
    log.warn('approval decision: displaced a pre-enforcement row so the verified decision could land', {
      repo: w.repo,
      pr: w.prNumber,
      commit: commitSha.slice(0, 12),
      displacedProvenance: existing.provenance ?? '(null)',
      displacedDecision: existing.decision,
    });
    return insertDecision(db, w, commitSha, decidedAtIso, true);
  }

  if (existing && existing.decision === w.decision) {
    log.info('approval decision already recorded — idempotent no-op', {
      repo: w.repo,
      pr: w.prNumber,
      commit: commitSha.slice(0, 12),
      decision: w.decision,
    });
    return { status: 'duplicate' };
  }

  log.warn('approval decision conflict — the ledger is append-only, first write wins', {
    repo: w.repo,
    pr: w.prNumber,
    commit: commitSha.slice(0, 12),
    existing: existing?.decision ?? '(row vanished)',
    refused: w.decision,
    agentGroup: w.agentGroupId,
  });
  return { status: 'conflict', existingDecision: existing?.decision ?? '(unknown)' };
}

/**
 * Move one row out of the trusted table into the history table, preserving it
 * verbatim. Copy-then-delete, and delete only what the copy accepted, so the
 * row cannot disappear. Callers run inside a transaction.
 */
async function quarantineLegacyRow(db: DbDriver, repo: string, prNumber: number, commitSha: string): Promise<void> {
  await db.run(
    `INSERT OR IGNORE INTO approval_decisions_legacy
       SELECT * FROM approval_decisions WHERE repo=? AND pr_number=? AND commit_sha=?`,
    repo,
    prNumber,
    commitSha,
  );
  await db.run(
    `DELETE FROM approval_decisions
      WHERE repo=? AND pr_number=? AND commit_sha=?
        AND EXISTS (SELECT 1 FROM approval_decisions_legacy l
                     WHERE l.repo=? AND l.pr_number=? AND l.commit_sha=?)`,
    repo,
    prNumber,
    commitSha,
    repo,
    prNumber,
    commitSha,
  );
}

/**
 * The approver session(s) that decided a given PR — the ROUTING index.
 * Used to route a terminal PR event (merged / closed) back to the approver
 * that decided it so it can distill an abstract learning. Returns one row per
 * decided commit (a PR may have several revision decisions from the same
 * session); callers dedup on (agent_group_id, thread_id) when delivering.
 * Empty when no approver ever decided this PR — nothing to learn, nothing to
 * route.
 *
 * Reads BOTH tables, deliberately. Delivery and calibration are different
 * questions: the sessions named on quarantined pre-enforcement rows are real
 * approver sessions that should still be told how their PR ended, even though
 * their rows are not evidence. Keeping the two concerns apart is what lets the
 * calibration join be trusted-only without silently dropping notifications.
 */
export interface DecisionSessionRow {
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
  commit_sha: string;
  decision: string;
  human_verdict: string | null;
}

export async function getDecisionSessionsForPr(
  db: DbDriver,
  repo: string,
  prNumber: number,
): Promise<DecisionSessionRow[]> {
  // The ORDER BY lives outside the union: SQLite only accepts bare result
  // columns as compound-select ORDER BY terms, and `datetime(decided_at)` is an
  // expression — which the store needs, since a bare TEXT sort mis-orders the
  // offset forms and truncated fractions these rows carry.
  return db.all<DecisionSessionRow>(
    `SELECT agent_group_id, session_id, thread_id, commit_sha, decision, human_verdict FROM (
         SELECT agent_group_id, session_id, thread_id, commit_sha, decision, human_verdict, decided_at, rowid AS rid
           FROM approval_decisions WHERE repo=? AND pr_number=?
         UNION ALL
         SELECT agent_group_id, session_id, thread_id, commit_sha, decision, human_verdict, decided_at, rowid AS rid
           FROM approval_decisions_legacy WHERE repo=? AND pr_number=?
       ) ORDER BY datetime(decided_at) ASC, rid ASC`,
    repo,
    prNumber,
    repo,
    prNumber,
  );
}

export interface TrustedDecisionRow {
  repo: string;
  pr_number: number;
  commit_sha: string;
  decision: string;
  human_verdict: string | null;
  join_mode: string | null;
  decided_at: string;
}

/**
 * Every decision row that is calibration evidence — i.e. written by a group
 * that held the ledger-writer capability at the time of the write.
 *
 * The named reader for metric producers. Since migration 935 quarantined the
 * pre-enforcement rows this returns the whole table, so an existing consumer
 * that selects `approval_decisions` directly is no longer counting
 * unattributable rows either — but new consumers should use this, because the
 * name says what the rows are for and the filter survives a partially applied
 * migration.
 */
export async function listTrustedDecisions(db: DbDriver): Promise<TrustedDecisionRow[]> {
  return db.all<TrustedDecisionRow>(
    `SELECT repo, pr_number, commit_sha, decision, human_verdict, join_mode, decided_at
         FROM approval_decisions
        WHERE ${TRUSTED_PROVENANCE_SQL}
        ORDER BY datetime(decided_at) ASC, rowid ASC`,
  );
}

/**
 * Stamp the human verdict onto an existing decision row for the join.
 *
 * ONLY the trusted ingestion path may call this: `source` carries the event
 * that actually observed the human (GitHub's webhook delivery id). A call
 * without one is refused. This closes the half of F14 where
 * `record_human_verdict` was an MCP tool in every container that ignored
 * session provenance entirely — an agent could report that a human had
 * approved its own work, which is the single most consequential field in the
 * table, since agreement with humans IS the calibration metric.
 *
 * Exact (repo, pr, commit) first — that is the true join: the human reviewed
 * the very head the approver decided on.
 *
 * Falling back matters because the common case is NOT exact. A PR the approver
 * decided at head X routinely gains commits and merges at head Y, and the
 * terminal verdict carries Y. An exact-only UPDATE then matches nothing,
 * changes 0 rows, and returns false **silently** — the caller has no reason to
 * suspect anything and the decision is never scored. Measured on the
 * slang-coworkers prod ledger (2026-08-04): of 26 PRs that reached a terminal
 * state without ever being stamped, 22 (85%) had advanced past the decided
 * commit. That single silent no-op was the dominant cause of a 42% hole in the
 * calibration data.
 *
 * So when the exact row is absent, stamp the most recent UNSTAMPED decision for
 * that PR — the approver's last call is what the outcome actually judges — and
 * say so in the log.
 *
 * FIRST VERDICT WINS, on both paths. The exact UPDATE carries the same
 * `human_verdict IS NULL` guard as the fallback, so the invariant holds
 * globally rather than only where the head happened to advance. Without it the
 * two paths disagree on identical human behaviour — a reviewer requests
 * changes and then merges with no new commits, and the later MERGED silently
 * overwrites the CHANGES_REQUESTED, erasing the only evidence that the
 * approver's call was wrong. That is precisely the signal this ledger exists to
 * capture, so it is never overwritten.
 *
 * `join_mode` records which path stamped the row ('exact' | 'head_advanced'),
 * so precision can be reported split by whether the head moved. If the
 * head_advanced group ever scores materially better than exact, the
 * merge-outcome over-credit bias has arrived and it is visible in one query.
 */
export async function recordHumanVerdict(
  db: DbDriver,
  repo: string,
  prNumber: number,
  commitSha: string,
  humanVerdict: string,
  source: VerdictSource,
): Promise<boolean> {
  if (!source || !source.eventId) {
    log.error('human verdict refused — no source event id (only the trusted ingestion path may stamp verdicts)', {
      repo,
      pr: prNumber,
      human: humanVerdict,
    });
    return false;
  }
  if (!isValidHumanVerdict(humanVerdict)) {
    log.warn('human verdict refused — outside the closed verdict domain', {
      repo,
      pr: prNumber,
      human: String(humanVerdict).slice(0, 64),
    });
    return false;
  }

  // A missing/short sha is legitimate here: the terminal payload does not
  // always carry a head, and the fallback path below is the honest answer when
  // we cannot tell. Only a well-formed sha may take the exact path.
  const exactSha = /^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$/.test(commitSha) ? commitSha.toLowerCase() : '';

  // Every selection below is scoped to trusted provenance. Migration 935 makes
  // that redundant by moving the pre-enforcement rows out of this table, but
  // stating it in the SQL is what keeps it true on a half-migrated database and
  // in the next query someone adds. Unscoped, a legacy row at the exact head —
  // or one carrying a newer (sometimes malformed-future) decided_at — absorbs
  // the single webhook-sourced verdict, and the verified decision it should
  // have scored stays unstamped forever.

  // GitHub redelivers; a redelivery must not be mistaken for a second
  // observation. If this exact event already stamped a row for this PR, we are
  // done.
  const already = await db.get(
    `SELECT 1 FROM approval_decisions
        WHERE repo=? AND pr_number=? AND verdict_source_event_id=? AND ${TRUSTED_PROVENANCE_SQL} LIMIT 1`,
    repo,
    prNumber,
    source.eventId,
  );
  if (already) {
    log.info('human verdict already applied for this source event — idempotent no-op', {
      repo,
      pr: prNumber,
      eventId: source.eventId,
    });
    return false;
  }

  if (exactSha) {
    const res = await db.run(
      `UPDATE approval_decisions
            SET human_verdict=@humanVerdict, join_mode='exact',
                verdict_source=@sourceKind, verdict_source_event_id=@eventId
          WHERE repo=@repo AND pr_number=@prNumber AND commit_sha=@commitSha
            AND human_verdict IS NULL AND ${TRUSTED_PROVENANCE_SQL}`,
      {
        humanVerdict,
        repo,
        prNumber,
        commitSha: exactSha,
        sourceKind: source.kind,
        eventId: source.eventId,
      },
    );
    if (res.changes > 0) {
      log.info('approval decision joined to human verdict', {
        repo,
        pr: prNumber,
        commit: exactSha.slice(0, 12),
        human: humanVerdict,
        joinMode: 'exact',
        source: source.kind,
      });
      return true;
    }
  }

  // `datetime()` + rowid is load-bearing. decided_at was historically
  // agent-supplied and unvalidated (an optional MCP arg passed through raw), so
  // a bare TEXT sort mis-orders offset forms ('…14:00:00+02:00' sorts above
  // '…12:30:00Z') and truncated fractions ('Z' > '.'), and an exact tie would
  // credit the FIRST row — the opposite of "latest". Prod carries proof this is
  // not theoretical: slang#11530 holds a decision stamped 730h AFTER its own
  // merge. New writes are normalized (validate.ts), and the rows those stamps
  // produced are quarantined out of this table — which is also why the
  // provenance scope below matters most HERE: an unnormalized future timestamp
  // is exactly what would win a "latest" ordering and steal the verdict.
  const latest = await db.get<{ rid: number; decidedSha: string }>(
    `SELECT rowid AS rid, commit_sha AS decidedSha FROM approval_decisions
        WHERE repo=? AND pr_number=? AND human_verdict IS NULL AND ${TRUSTED_PROVENANCE_SQL}
        ORDER BY datetime(decided_at) DESC, rowid DESC LIMIT 1`,
    repo,
    prNumber,
  );

  if (!latest) {
    // Genuinely nothing to join: no decision for this PR, or every decision
    // already carries a verdict. Logged so a missing join is never silent.
    log.info('human verdict had no unstamped decision to join', {
      repo,
      pr: prNumber,
      commit: commitSha.slice(0, 12),
      human: humanVerdict,
    });
    return false;
  }

  await db.run(
    `UPDATE approval_decisions
        SET human_verdict=?, join_mode='head_advanced', verdict_source=?, verdict_source_event_id=?
      WHERE rowid=?`,
    humanVerdict,
    source.kind,
    source.eventId,
    latest.rid,
  );
  log.info('approval decision joined to human verdict (head advanced past the decision)', {
    repo,
    pr: prNumber,
    verdictCommit: commitSha.slice(0, 12),
    decidedCommit: latest.decidedSha.slice(0, 12),
    human: humanVerdict,
    joinMode: 'head_advanced',
    source: source.kind,
  });
  return true;
}
