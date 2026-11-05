/**
 * Read/write helpers for the issue_opt_outs and issue_stand_downs tables.
 *
 * See src/db/migrations/946-issue-opt-outs.ts for the schema and the reason the
 * tables exist. Every function here swallows DB errors into a warning: a missing
 * table (pre-migration) or a transient error must never break a webhook delivery.
 */
import { getDb } from './connection.js';
import { log } from '../log.js';

export interface IssueOptOut {
  repo: string;
  issue_number: number;
  label: string;
  actor: string;
  /** 'opened' (labelled at creation), 'labeled' (label added later) or 'stop-mention' (a comment asked the bot to stop). */
  source: string;
  opted_out_at: string;
  released_at: string | null;
  sessions_stopped: number;
}

export interface IssueStandDown {
  repo: string;
  issue_number: number;
  /** 'host' when the backstop posted the note, 'coworker' when one was found already on the issue. */
  kind: string;
  comment_id: number | null;
  posted_at: string;
}

/**
 * Record that an issue is opted out. Returns true when a new active row was
 * written (a fresh opt-out) and false when the issue was already opted out, so
 * the caller can stop sessions once and not on every label echo.
 */
export async function recordIssueOptOut(args: {
  repo: string;
  issueNumber: number;
  label: string;
  actor: string;
  source: string;
  sessionsStopped?: number;
}): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    const existing = await getDb().get<IssueOptOut>(
      'SELECT * FROM issue_opt_outs WHERE repo = ? AND issue_number = ?',
      args.repo,
      args.issueNumber,
    );
    if (existing && existing.released_at === null) return false;
    if (existing) {
      await getDb().run(
        `UPDATE issue_opt_outs
            SET label = ?, actor = ?, source = ?, opted_out_at = ?, released_at = NULL, sessions_stopped = ?
          WHERE repo = ? AND issue_number = ?`,
        args.label,
        args.actor,
        args.source,
        now,
        args.sessionsStopped ?? 0,
        args.repo,
        args.issueNumber,
      );
      return true;
    }
    await getDb().run(
      `INSERT INTO issue_opt_outs (repo, issue_number, label, actor, source, opted_out_at, released_at, sessions_stopped)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
      args.repo,
      args.issueNumber,
      args.label,
      args.actor,
      args.source,
      now,
      args.sessionsStopped ?? 0,
    );
    return true;
  } catch (err) {
    log.warn('issue-opt-outs: record failed (non-fatal)', {
      repo: args.repo,
      issue: args.issueNumber,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Note how many sessions the opt-out stopped, after the fact. */
export async function setIssueOptOutSessionsStopped(repo: string, issueNumber: number, count: number): Promise<void> {
  try {
    await getDb().run(
      'UPDATE issue_opt_outs SET sessions_stopped = ? WHERE repo = ? AND issue_number = ? AND released_at IS NULL',
      count,
      repo,
      issueNumber,
    );
  } catch (err) {
    log.warn('issue-opt-outs: update failed (non-fatal)', { repo, issue: issueNumber, err: String(err) });
  }
}

/** Close the active opt-out row. Returns true when a row was released. */
export async function releaseIssueOptOut(repo: string, issueNumber: number): Promise<boolean> {
  try {
    const res = await getDb().run(
      'UPDATE issue_opt_outs SET released_at = ? WHERE repo = ? AND issue_number = ? AND released_at IS NULL',
      new Date().toISOString(),
      repo,
      issueNumber,
    );
    return (res?.changes ?? 0) > 0;
  } catch (err) {
    log.warn('issue-opt-outs: release failed (non-fatal)', { repo, issue: issueNumber, err: String(err) });
    return false;
  }
}

/** The active opt-out row for an issue, or undefined. Never throws. */
export async function getIssueOptOut(repo: string, issueNumber: number): Promise<IssueOptOut | undefined> {
  try {
    return await getDb().get<IssueOptOut>(
      'SELECT * FROM issue_opt_outs WHERE repo = ? AND issue_number = ? AND released_at IS NULL',
      repo,
      issueNumber,
    );
  } catch {
    return undefined;
  }
}

/** Every active opt-out, oldest first. Never throws. */
export async function listActiveIssueOptOuts(): Promise<IssueOptOut[]> {
  try {
    return await getDb().all<IssueOptOut>(
      'SELECT * FROM issue_opt_outs WHERE released_at IS NULL ORDER BY opted_out_at ASC, repo ASC, issue_number ASC',
    );
  } catch {
    return [];
  }
}

/** Record the stand-down note left on an issue; a second call for the same issue is ignored. */
export async function recordIssueStandDown(args: {
  repo: string;
  issueNumber: number;
  kind: string;
  commentId?: number | null;
}): Promise<void> {
  try {
    await getDb().run(
      `INSERT INTO issue_stand_downs (repo, issue_number, kind, comment_id, posted_at)
       SELECT ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM issue_stand_downs WHERE repo = ? AND issue_number = ?)`,
      args.repo,
      args.issueNumber,
      args.kind,
      args.commentId ?? null,
      new Date().toISOString(),
      args.repo,
      args.issueNumber,
    );
  } catch (err) {
    log.warn('issue-stand-downs: record failed (non-fatal)', {
      repo: args.repo,
      issue: args.issueNumber,
      err: String(err),
    });
  }
}

/** The stand-down note recorded for an issue, or undefined. Never throws. */
export async function getIssueStandDown(repo: string, issueNumber: number): Promise<IssueStandDown | undefined> {
  try {
    return await getDb().get<IssueStandDown>(
      'SELECT * FROM issue_stand_downs WHERE repo = ? AND issue_number = ?',
      repo,
      issueNumber,
    );
  } catch {
    return undefined;
  }
}
