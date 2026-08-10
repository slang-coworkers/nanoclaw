/**
 * pr_session_mappings write path — shared between the in-process delivery
 * action handler and the HTTP register-PR endpoint.
 *
 * The table on the canonical instance (prod) is the source of truth for
 * "which session owns PR (repo, pr_number)". Non-canonical instances
 * (lego) post here over HTTP via /internal/register-pr; canonical
 * registrations from local agents call this directly.
 *
 * Writes are FIRST-CLAIM-WINS, not last-writer-wins.
 *
 * This table decides where a PR's GitHub webhooks are delivered, and both
 * writers take `repo` and `pr_number` from a message an agent composed. Under
 * the previous `INSERT OR REPLACE` any agent group could name any repo and PR
 * number and capture that PR's traffic into its own session — a cross-instance
 * flip at least logged a warning, a same-instance takeover said nothing at all.
 *
 * So a claim binds on first write, and a later claim from a DIFFERENT claimant
 * is refused rather than applied. The same claimant may refresh its own row
 * freely: a group's session id changes whenever its container restarts or a
 * thread session takes over, and routing has to follow the live session.
 *
 * Corrections are still possible — an operator or the orchestrator runs
 * `ncl pr-mappings remap`, which is approval-gated and calls
 * `overridePrMapping`. That is the only unconditional writer, it is named so
 * you cannot reach it by accident, and it logs both sides of the change.
 *
 * ## Why the claim is ordered rather than proved
 *
 * A proved claim ("this session really did open this PR") is not reachable
 * from what the host knows:
 *
 *   - Every coworker pushes and opens PRs as the same GitHub identity
 *     (`nv-slang-bot`), so a `pull_request` webhook's author does not identify
 *     the group, and branch names carry no group either.
 *   - Draft PRs produce no `pull_request` event this host acts on
 *     (`github-webhook-server.ts` treats only non-draft opened/ready/sync as
 *     reviewable), and the chain protocol explicitly supports draft-held PRs —
 *     so any rule requiring a prior webhook would reject a documented flow.
 *   - Asking the GitHub API at claim time would put a credentialed network
 *     call in the delivery path and fail legitimate claims during an
 *     api.github.com outage, which is common enough here to have a runbook.
 *
 * First-claim-wins does not stop a hostile group that claims a PR *before* the
 * real owner. It converts a silent capture into a refused write plus an ERROR
 * naming both claimants, which is the difference between a hijack and an
 * incident someone can see.
 */
import type Database from 'better-sqlite3';

import { log } from '../../log.js';

export interface PrMappingWrite {
  repo: string;
  prNumber: number;
  ownerInstance: string;
  agentGroupId: string;
  sessionId: string;
  threadId: string | null;
}

export interface PrMappingExisting {
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id: string | null;
}

/** Migrate the legacy NOT NULL thread_id schema in place if needed. */
function ensureThreadIdNullable(db: Database.Database): void {
  try {
    const colInfo = db.prepare('PRAGMA table_info(pr_session_mappings)').all() as Array<{
      name: string;
      notnull: number;
    }>;
    const tidCol = colInfo.find((c) => c.name === 'thread_id');
    const ownerCol = colInfo.find((c) => c.name === 'owner_instance');
    if (!tidCol || tidCol.notnull !== 1) return;
    db.exec('ALTER TABLE pr_session_mappings RENAME TO _pr_session_mappings_old');
    if (ownerCol) {
      db.exec(`CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL,
        owner_instance TEXT NOT NULL DEFAULT 'prod',
        PRIMARY KEY (repo, pr_number)
      )`);
    } else {
      db.exec(`CREATE TABLE pr_session_mappings (
        repo TEXT NOT NULL, pr_number INTEGER NOT NULL, agent_group_id TEXT NOT NULL,
        session_id TEXT NOT NULL, thread_id TEXT, created_at TEXT NOT NULL,
        PRIMARY KEY (repo, pr_number)
      )`);
    }
    db.exec('INSERT INTO pr_session_mappings SELECT * FROM _pr_session_mappings_old');
    db.exec('DROP TABLE _pr_session_mappings_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_pr_map_lookup ON pr_session_mappings(repo, pr_number)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_pr_map_owner ON pr_session_mappings(owner_instance)');
  } catch {
    /* already fixed or table doesn't exist */
  }
}

/**
 * Cheap existence check: does a PR→session mapping row exist for this
 * (repo, pr_number), regardless of owner? Used by the webhook comment gate
 * to recognize "this PR is ours" — a comment on a mapped PR is processed
 * even without an @-mention (the mapping IS the ownership signal). Returns
 * false (never throws) if the table doesn't exist yet (pre-migration).
 */
export function prMappingExists(db: Database.Database, repo: string, prNumber: number): boolean {
  try {
    const row = db.prepare('SELECT 1 FROM pr_session_mappings WHERE repo = ? AND pr_number = ?').get(repo, prNumber) as
      | { 1: number }
      | undefined;
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * What happened to a claim.
 *
 * `rejected` carries the incumbent so the caller can tell the agent who holds
 * the PR — an agent that is told "denied" and nothing else retries forever.
 */
export type PrMappingClaim =
  | { outcome: 'claimed'; prior: null }
  | { outcome: 'refreshed'; prior: PrMappingExisting }
  | { outcome: 'rejected'; prior: PrMappingExisting; reason: string };

/**
 * Who a mapping belongs to.
 *
 * The instance plus the agent group — deliberately NOT the session. A group's
 * session id changes on every container restart and whenever a thread session
 * takes over, and the mapping has to follow the live session or webhooks
 * arrive at a dead one. The group is the principal; the session is where it
 * currently lives.
 */
function sameClaimant(prior: PrMappingExisting, w: PrMappingWrite): boolean {
  return prior.owner_instance === w.ownerInstance && prior.agent_group_id === w.agentGroupId;
}

function readExisting(db: Database.Database, repo: string, prNumber: number): PrMappingExisting | undefined {
  return db
    .prepare(
      'SELECT owner_instance, agent_group_id, session_id, thread_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
    )
    .get(repo, prNumber) as PrMappingExisting | undefined;
}

function writeRow(db: Database.Database, w: PrMappingWrite): void {
  db.prepare(
    `INSERT OR REPLACE INTO pr_session_mappings
     (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
  ).run(w.repo, w.prNumber, w.agentGroupId, w.sessionId, w.threadId, w.ownerInstance);
}

/**
 * Claim a PR→session mapping. First claimant wins; the same claimant may
 * refresh; anyone else is refused.
 *
 * Every agent-reachable writer goes through here — the in-process delivery
 * action and the cross-instance HTTP endpoint both — so there is no path that
 * gets the old unconditional behaviour.
 */
export function claimPrMapping(db: Database.Database, w: PrMappingWrite): PrMappingClaim {
  ensureThreadIdNullable(db);

  const prior = readExisting(db, w.repo, w.prNumber);
  if (!prior) {
    writeRow(db, w);
    log.info('pr-mapping claimed', {
      repo: w.repo,
      pr: w.prNumber,
      owner: w.ownerInstance,
      agentGroup: w.agentGroupId,
      session: w.sessionId,
    });
    return { outcome: 'claimed', prior: null };
  }

  if (sameClaimant(prior, w)) {
    writeRow(db, w);
    if (prior.session_id !== w.sessionId) {
      log.info('pr-mapping refreshed to a new session of the same group', {
        repo: w.repo,
        pr: w.prNumber,
        agentGroup: w.agentGroupId,
        from: prior.session_id,
        to: w.sessionId,
      });
    }
    return { outcome: 'refreshed', prior };
  }

  // error, not warn, and symmetric: the old code warned on a cross-instance
  // flip and stayed silent on a same-instance one, which is backwards — a
  // takeover by a sibling group on the same box is the likelier attack.
  const reason =
    `(${w.ownerInstance}/${w.agentGroupId}) tried to claim a PR already held by ` +
    `(${prior.owner_instance}/${prior.agent_group_id})`;
  log.error('pr-mapping claim REJECTED — a different claimant already holds this PR', {
    repo: w.repo,
    pr: w.prNumber,
    heldBy: { instance: prior.owner_instance, agentGroup: prior.agent_group_id, session: prior.session_id },
    attemptedBy: { instance: w.ownerInstance, agentGroup: w.agentGroupId, session: w.sessionId },
    remedy: `ncl pr-mappings remap --repo ${w.repo} --pr ${w.prNumber} …`,
  });
  return { outcome: 'rejected', prior, reason };
}

/**
 * Reassign a mapping unconditionally.
 *
 * The ONLY unconditional writer, and it is not reachable from a container: its
 * single caller is the approval-gated `ncl pr-mappings remap`. A correction is
 * a legitimate operation (fork pickup, reroute, a coworker handing a PR on) —
 * it just has to be a decision somebody made, not a field an agent can set.
 */
export function overridePrMapping(
  db: Database.Database,
  w: PrMappingWrite,
  reason: string,
): { prior: PrMappingExisting | null } {
  ensureThreadIdNullable(db);

  const prior = readExisting(db, w.repo, w.prNumber);
  writeRow(db, w);
  log.warn('pr-mapping REASSIGNED by operator action', {
    repo: w.repo,
    pr: w.prNumber,
    from: prior
      ? { instance: prior.owner_instance, agentGroup: prior.agent_group_id, session: prior.session_id }
      : null,
    to: { instance: w.ownerInstance, agentGroup: w.agentGroupId, session: w.sessionId },
    reason,
  });
  return { prior: prior ?? null };
}
