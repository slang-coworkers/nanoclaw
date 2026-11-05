/**
 * Issue opt-out — contributor standard R6, "the bot leaves room for people".
 *
 * The bot sees every new issue. People take one back in two ways, and both end
 * here:
 *
 *   - a newcomer label (ISSUE_NEWCOMER_LABELS: GoodFirstBug, HelpWanted, no-bot
 *     by default) on the issue, at creation or added later;
 *   - a comment on the issue that mentions the bot and tells it to stop, written
 *     by the issue's author or by a repository collaborator. The host then adds
 *     the `no-bot` label itself, so the label stays the single visible switch.
 *
 * An opt-out does three things: it writes the issue_opt_outs row, it stops every
 * active session on the issue's thread (`gh-issue-<repo>-<num>`, whichever
 * group holds it) and it rewrites `.issue-opt-outs.json` in every agent group
 * folder, which the container hook gate-issue-optout.sh reads to refuse GitHub
 * writes that target the issue. Removing the last newcomer label releases the
 * row, rewrites the lists and lets the webhook deliver the issue again.
 */
import fs from 'fs';
import path from 'path';

import { GITHUB_WEBHOOK_BOT_MENTION, ISSUE_NEWCOMER_LABELS, ISSUE_STOP_PHRASES } from './config.js';
import { getAllAgentGroups } from './db/agent-groups.js';
import { getDb } from './db/connection.js';
import {
  getIssueOptOut,
  listActiveIssueOptOuts,
  recordIssueOptOut,
  releaseIssueOptOut as releaseIssueOptOutRow,
  setIssueOptOutSessionsStopped,
} from './db/issue-opt-outs.js';
import { updateSession } from './db/sessions.js';
import { readEnvFile } from './env.js';
import { resolveGroupFolderPath } from './group-folder.js';
import { log } from './log.js';
import type { Session } from './types.js';

/** File name of the per-group opt-out list the container hook reads. */
export const ISSUE_OPT_OUT_LIST_FILE = '.issue-opt-outs.json';

/** The label the host adds when a comment asks the bot to stop. */
export const STOP_MENTION_LABEL = 'no-bot';

/** Who may tell the bot to stop with a comment: the author and anyone GitHub marks as part of the repository. */
const STOP_AUTHOR_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function isNewcomerLabel(name: string): boolean {
  return ISSUE_NEWCOMER_LABELS.includes(name.trim().toLowerCase());
}

/** The newcomer labels among `labels`, lower-cased, in the order given. */
export function newcomerLabelsOf(labels: string[]): string[] {
  return labels.map((l) => l.trim().toLowerCase()).filter((l) => ISSUE_NEWCOMER_LABELS.includes(l));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One alternation over ISSUE_STOP_PHRASES; runs of whitespace in a phrase match any whitespace. */
export function stopPhrasePattern(phrases: string[] = ISSUE_STOP_PHRASES): RegExp {
  const alts = phrases
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => escapeRegExp(p).replace(/\s+/g, '\\s+'));
  return new RegExp(`(^|[^\\w])(?:${alts.join('|')})(?![\\w])`, 'i');
}

/**
 * Does this comment tell the bot to stop? It must mention the bot and carry one
 * of the stop phrases; a comment that only mentions the bot is a request, and a
 * comment that only says "stop" is addressed to someone else.
 */
export function isStopMention(body: string, mention: string = GITHUB_WEBHOOK_BOT_MENTION): boolean {
  if (!body || !mention) return false;
  if (!body.toLowerCase().includes(mention.toLowerCase())) return false;
  return stopPhrasePattern().test(body);
}

/** May this commenter stop the bot on the issue? The issue's author always; others when GitHub marks them as part of the repository. */
export function mayStopIssue(args: { commenter: string; issueAuthor: string; authorAssociation: string }): boolean {
  if (!args.commenter) return false;
  if (args.issueAuthor && args.commenter === args.issueAuthor) return true;
  return STOP_AUTHOR_ASSOCIATIONS.has((args.authorAssociation || '').toUpperCase());
}

export function issueThreadId(repo: string, issueNumber: number): string {
  return `gh-issue-${repo}-${issueNumber}`;
}

/**
 * Stop every active session on the issue's thread, in every group: kill its
 * container and close the session so a later comment does not wake it. Returns
 * the number of sessions closed. Never throws.
 */
export async function stopIssueSessions(repo: string, issueNumber: number, reason: string): Promise<number> {
  let sessions: Session[] = [];
  try {
    sessions = await getDb().all<Session>(
      "SELECT * FROM sessions WHERE thread_id = ? AND status = 'active'",
      issueThreadId(repo, issueNumber),
    );
  } catch (err) {
    log.warn('issue-opt-out: session lookup failed', { repo, issue: issueNumber, err: String(err) });
    return 0;
  }
  let closed = 0;
  if (sessions.length === 0) return 0;
  // Loaded here, not at module top: the webhook server imports this module, and
  // container-runner pulls in the whole gateway stack at import time.
  const { killContainer } = await import('./container-runner.js');
  for (const session of sessions) {
    try {
      killContainer(session.id, reason);
      await updateSession(session.id, { status: 'closed', container_status: 'stopped' });
      closed += 1;
    } catch (err) {
      log.warn('issue-opt-out: could not stop session', { sessionId: session.id, err: String(err) });
    }
  }
  return closed;
}

/** The list document the container hook reads: issues grouped by repository. */
export interface IssueOptOutList {
  version: 1;
  updated_at: string;
  issues: Record<string, { number: number; label: string }[]>;
}

export async function buildIssueOptOutList(): Promise<IssueOptOutList> {
  const issues: IssueOptOutList['issues'] = {};
  for (const row of await listActiveIssueOptOuts()) {
    (issues[row.repo] ??= []).push({ number: row.issue_number, label: row.label });
  }
  return { version: 1, updated_at: new Date().toISOString(), issues };
}

/**
 * Write the opt-out list into every agent group folder that exists on disk
 * (atomic rename, so a hook never reads a half-written file). The file is
 * written even when the list is empty, so a hook can tell "nothing opted out"
 * from "the host never wrote the file". Returns the folders written.
 */
export async function writeIssueOptOutLists(list?: IssueOptOutList): Promise<string[]> {
  const doc = list ?? (await buildIssueOptOutList());
  const text = JSON.stringify(doc, null, 2) + '\n';
  const written: string[] = [];
  let groups: { folder: string }[] = [];
  try {
    groups = await getAllAgentGroups();
  } catch (err) {
    log.warn('issue-opt-out: agent group listing failed', { err: String(err) });
    return written;
  }
  for (const group of groups) {
    let dir: string;
    try {
      dir = resolveGroupFolderPath(group.folder);
    } catch {
      continue;
    }
    if (!fs.existsSync(dir)) continue;
    const target = path.join(dir, ISSUE_OPT_OUT_LIST_FILE);
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, target);
      written.push(group.folder);
    } catch (err) {
      log.warn('issue-opt-out: could not write list', { folder: group.folder, err: String(err) });
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* nothing to clean */
      }
    }
  }
  return written;
}

export interface OptOutResult {
  /** True when this call created the opt-out; false when the issue was already opted out. */
  fresh: boolean;
  sessionsStopped: number;
  listsWritten: number;
}

/**
 * Opt an issue out: record it, stop its sessions, refresh the lists. Idempotent:
 * a second call (the webhook echo of a label the host added itself, or a second
 * newcomer label) records nothing and stops nothing.
 */
export async function optOutIssue(args: {
  repo: string;
  issueNumber: number;
  label: string;
  actor: string;
  source: 'opened' | 'labeled' | 'stop-mention';
}): Promise<OptOutResult> {
  const fresh = await recordIssueOptOut({
    repo: args.repo,
    issueNumber: args.issueNumber,
    label: args.label.toLowerCase(),
    actor: args.actor,
    source: args.source,
  });
  if (!fresh) return { fresh: false, sessionsStopped: 0, listsWritten: 0 };
  const sessionsStopped = await stopIssueSessions(
    args.repo,
    args.issueNumber,
    `issue opt-out (${args.source}: ${args.label})`,
  );
  if (sessionsStopped > 0) await setIssueOptOutSessionsStopped(args.repo, args.issueNumber, sessionsStopped);
  const written = await writeIssueOptOutLists();
  log.info('issue-opt-out: issue opted out', {
    repo: args.repo,
    issue: args.issueNumber,
    label: args.label,
    actor: args.actor,
    source: args.source,
    sessionsStopped,
    listsWritten: written.length,
  });
  return { fresh: true, sessionsStopped, listsWritten: written.length };
}

/** Release an opt-out (the last newcomer label went). Returns true when a row was released. */
export async function releaseIssueOptOut(repo: string, issueNumber: number, actor: string): Promise<boolean> {
  const released = await releaseIssueOptOutRow(repo, issueNumber);
  if (released) {
    const written = await writeIssueOptOutLists();
    log.info('issue-opt-out: issue released', { repo, issue: issueNumber, actor, listsWritten: written.length });
  }
  return released;
}

export async function isIssueOptedOut(repo: string, issueNumber: number): Promise<boolean> {
  return Boolean(await getIssueOptOut(repo, issueNumber));
}

/** The GitHub token the host posts with; re-read from .env so a rotated token is picked up. */
export function hostGitHubToken(): string {
  return readEnvFile(['GH_TOKEN']).GH_TOKEN || process.env.GH_TOKEN || '';
}

/**
 * Add a label to an issue with the host's token. Returns true on success; a
 * failure is logged and returns false (the stop is still recorded host-side).
 */
export async function addIssueLabel(
  repo: string,
  issueNumber: number,
  label: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const token = hostGitHubToken();
  if (!token) {
    log.warn('issue-opt-out: cannot add label, GH_TOKEN not set', { repo, issue: issueNumber, label });
    return false;
  }
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`;
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ labels: [label] }),
    });
    if (!res.ok) {
      log.warn('issue-opt-out: add label non-OK', { url, status: res.status });
      return false;
    }
    return true;
  } catch (err) {
    log.warn('issue-opt-out: add label failed', { url, err: String(err) });
    return false;
  }
}
