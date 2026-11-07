/**
 * Issue stand-down backstop — contributor standard R6, "the bot leaves room for
 * people", second half: a decision not to work an issue is announced on the
 * issue, never kept silent.
 *
 * The orchestrator receives every new issue and is told, in the delivery
 * itself (ISSUE_STANDING_RULE in src/webhook-github.ts), to post a short
 * stand-down note when it decides not to triage or fix. This module is the
 * host's guarantee behind that instruction. Once an hour it walks every issue
 * chain the webhook ever minted (`gh-issue-<repo>-<num>` sessions) that is at
 * least ISSUE_STAND_DOWN_HOURS old and, when the issue is still open, nobody
 * opted it out, no session on it is still at work, and the bot has left no
 * comment and referenced it from no PR or commit, posts the note itself and
 * records it in issue_stand_downs. An issue where the bot was active, or where
 * a coworker already posted the note, is recorded too, so each issue is looked
 * at on GitHub once.
 */
import { GITHUB_WEBHOOK_BOT_MENTION, ISSUE_STAND_DOWN_ENABLED, ISSUE_STAND_DOWN_HOURS } from './config.js';
import { getDb } from './db/connection.js';
import { getIssueOptOut, getIssueStandDown, recordIssueStandDown } from './db/issue-opt-outs.js';
import { hostGitHubToken } from './issue-opt-out.js';
import { log } from './log.js';
import type { Session } from './types.js';

export const FIRST_SWEEP_DELAY_MS = 2 * 60_000;
export const SWEEP_INTERVAL_MS = 60 * 60_000;
/** Notes posted per sweep at most, so a first deploy over a backlog never floods a repository. */
export const MAX_NOTES_PER_SWEEP = 5;
/** Chains older than this are history, not a hold to announce. */
export const LOOKBACK_DAYS = 30;
/** The sentence every stand-down note opens with; a bot comment carrying it counts as the note. */
export const STAND_DOWN_MARKER = 'Standing down on this one';

const THREAD_RE = /^gh-issue-([\w.-]+\/[\w.-]+)-(\d+)$/;

export function parseIssueThread(threadId: string | null | undefined): { repo: string; number: number } | null {
  const m = threadId ? THREAD_RE.exec(threadId) : null;
  if (!m) return null;
  return { repo: m[1], number: Number(m[2]) };
}

/** The bot's GitHub logins, as the mention handle and as the App login. */
export function botLogins(mention: string = GITHUB_WEBHOOK_BOT_MENTION): Set<string> {
  const handle = (mention || '').replace(/^@/, '').trim();
  return new Set(handle ? [handle, `${handle}[bot]`] : []);
}

/** The note the host posts. With assignees it names them; otherwise it says plainly that nothing was started. */
export function standDownNote(args: { assignees: string[]; hours?: number; mention?: string }): string {
  const mention = args.mention ?? GITHUB_WEBHOOK_BOT_MENTION;
  const hours = args.hours ?? ISSUE_STAND_DOWN_HOURS;
  const names = args.assignees.filter(Boolean).map((a) => `@${a}`);
  const first =
    names.length > 0
      ? `${STAND_DOWN_MARKER}. It is assigned to ${names.join(' and ')} and reads as their own work item, so I have not triaged it or started a fix.`
      : `${STAND_DOWN_MARKER}. No automated triage or fix was started in the first ${hours} hours, so I am leaving it to people.`;
  return (
    `${first}\n\n` +
    `If a repro, a triage pass or a fix attempt would help, mention ${mention} in a comment and I will pick it up.\n\n` +
    '<sub>🤖 Posted by an automated Slang coworker. A human maintainer should verify.</sub>'
  );
}

export interface IssueFacts {
  state: string;
  assignees: string[];
  /** The bot left at least one comment on the issue. */
  botCommented: boolean;
  /** A bot comment already carries the stand-down marker. */
  existingNote: boolean;
  /** The bot referenced the issue from a PR, commit or another issue. */
  botReferenced: boolean;
}

export type StandDownDecision =
  | { action: 'post' }
  | { action: 'record'; kind: 'coworker' | 'bot-active' }
  | { action: 'skip'; reason: 'recorded' | 'opted-out' | 'young' | 'active-session' | 'github-unavailable' | 'closed' };

/** The pure decision for one chain; everything that touches GitHub or the DB is read before it runs. */
export function decideStandDown(args: {
  createdAt: string;
  now: Date;
  hours: number;
  optedOut: boolean;
  recorded: boolean;
  activeWithin: boolean;
  facts: IssueFacts | null;
}): StandDownDecision {
  if (args.recorded) return { action: 'skip', reason: 'recorded' };
  if (args.optedOut) return { action: 'skip', reason: 'opted-out' };
  const ageMs = args.now.getTime() - Date.parse(args.createdAt);
  if (!(ageMs >= args.hours * 3_600_000)) return { action: 'skip', reason: 'young' };
  if (args.activeWithin) return { action: 'skip', reason: 'active-session' };
  if (!args.facts) return { action: 'skip', reason: 'github-unavailable' };
  if (args.facts.state !== 'open') return { action: 'skip', reason: 'closed' };
  if (args.facts.existingNote) return { action: 'record', kind: 'coworker' };
  if (args.facts.botCommented || args.facts.botReferenced) return { action: 'record', kind: 'bot-active' };
  return { action: 'post' };
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

async function getJson(url: string, token: string, fetchImpl: typeof fetch): Promise<unknown | null> {
  try {
    const res = await fetchImpl(url, { headers: headers(token) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Read the issue, its first hundred comments and its timeline; null when the issue itself cannot be read. */
export async function fetchIssueFacts(
  repo: string,
  number: number,
  token: string,
  fetchImpl: typeof fetch = fetch,
  logins: Set<string> = botLogins(),
): Promise<IssueFacts | null> {
  const base = `https://api.github.com/repos/${repo}/issues/${number}`;
  const issue = (await getJson(base, token, fetchImpl)) as Record<string, unknown> | null;
  if (!issue || typeof issue.state !== 'string') return null;
  const assignees = Array.isArray(issue.assignees)
    ? (issue.assignees as Record<string, unknown>[]).map((a) => String(a.login ?? '')).filter(Boolean)
    : [];
  const comments = ((await getJson(`${base}/comments?per_page=100`, token, fetchImpl)) ?? []) as Record<
    string,
    unknown
  >[];
  const byBot = Array.isArray(comments)
    ? comments.filter((c) => logins.has(String((c.user as Record<string, unknown> | undefined)?.login ?? '')))
    : [];
  const timeline = ((await getJson(`${base}/timeline?per_page=100`, token, fetchImpl)) ?? []) as Record<
    string,
    unknown
  >[];
  const botReferenced =
    Array.isArray(timeline) &&
    timeline.some(
      (e) =>
        (e.event === 'cross-referenced' || e.event === 'referenced') &&
        logins.has(String((e.actor as Record<string, unknown> | undefined)?.login ?? '')),
    );
  return {
    state: issue.state,
    assignees,
    botCommented: byBot.length > 0,
    existingNote: byBot.some((c) => String(c.body ?? '').includes(STAND_DOWN_MARKER)),
    botReferenced,
  };
}

async function postNote(
  repo: string,
  number: number,
  body: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<number | null> {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/issues/${number}/comments`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      log.warn('issue-stand-down: note not posted', { repo, issue: number, status: res.status });
      return null;
    }
    const doc = (await res.json()) as Record<string, unknown>;
    return typeof doc.id === 'number' ? doc.id : 0;
  } catch (err) {
    log.warn('issue-stand-down: note failed', { repo, issue: number, err: String(err) });
    return null;
  }
}

export interface SweepResult {
  chains: number;
  posted: number;
  recorded: number;
  skipped: Record<string, number>;
}

/** One pass over every issue chain. Exported for tests; the timer calls it. */
export async function sweepIssueStandDowns(
  opts: { now?: Date; hours?: number; maxNotes?: number; fetchImpl?: typeof fetch } = {},
): Promise<SweepResult> {
  const now = opts.now ?? new Date();
  const hours = opts.hours ?? ISSUE_STAND_DOWN_HOURS;
  const maxNotes = opts.maxNotes ?? MAX_NOTES_PER_SWEEP;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const result: SweepResult = { chains: 0, posted: 0, recorded: 0, skipped: {} };
  const skip = (reason: string) => {
    result.skipped[reason] = (result.skipped[reason] ?? 0) + 1;
  };

  let sessions: Session[] = [];
  try {
    sessions = await getDb().all<Session>(
      "SELECT * FROM sessions WHERE thread_id LIKE 'gh-issue-%' AND created_at >= ? ORDER BY created_at ASC",
      new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString(),
    );
  } catch (err) {
    log.warn('issue-stand-down: session listing failed', { err: String(err) });
    return result;
  }

  // One entry per chain: the first delivery's time, and whether any session on
  // it was at work inside the window (a running container or a recent turn).
  const chains = new Map<string, { repo: string; number: number; createdAt: string; activeWithin: boolean }>();
  const windowStart = now.getTime() - hours * 3_600_000;
  for (const s of sessions) {
    const parsed = parseIssueThread(s.thread_id);
    if (!parsed) continue;
    const active =
      (s.status === 'active' && (s.container_status === 'running' || s.container_status === 'idle')) ||
      (s.last_active ? Date.parse(s.last_active) >= windowStart : false);
    const key = s.thread_id as string;
    const entry = chains.get(key);
    if (!entry) chains.set(key, { ...parsed, createdAt: s.created_at, activeWithin: active });
    else entry.activeWithin = entry.activeWithin || active;
  }
  result.chains = chains.size;
  if (chains.size === 0) return result;

  const token = hostGitHubToken();
  if (!token) {
    log.warn('issue-stand-down: GH_TOKEN not set; sweep skipped', { chains: chains.size });
    skip('no-token');
    return result;
  }

  for (const chain of chains.values()) {
    const recorded = Boolean(await getIssueStandDown(chain.repo, chain.number));
    const optedOut = Boolean(await getIssueOptOut(chain.repo, chain.number));
    const pre = decideStandDown({
      createdAt: chain.createdAt,
      now,
      hours,
      optedOut,
      recorded,
      activeWithin: chain.activeWithin,
      facts: { state: 'open', assignees: [], botCommented: false, existingNote: false, botReferenced: false },
    });
    if (pre.action === 'skip') {
      skip(pre.reason);
      continue;
    }
    if (result.posted >= maxNotes) {
      skip('note-cap');
      continue;
    }
    const facts = await fetchIssueFacts(chain.repo, chain.number, token, fetchImpl);
    const decision = decideStandDown({
      createdAt: chain.createdAt,
      now,
      hours,
      optedOut,
      recorded,
      activeWithin: chain.activeWithin,
      facts,
    });
    if (decision.action === 'skip') {
      skip(decision.reason);
      continue;
    }
    if (decision.action === 'record') {
      await recordIssueStandDown({ repo: chain.repo, issueNumber: chain.number, kind: decision.kind });
      result.recorded += 1;
      continue;
    }
    const id = await postNote(
      chain.repo,
      chain.number,
      standDownNote({ assignees: facts?.assignees ?? [], hours }),
      token,
      fetchImpl,
    );
    if (id === null) {
      skip('post-failed');
      continue;
    }
    await recordIssueStandDown({ repo: chain.repo, issueNumber: chain.number, kind: 'host', commentId: id });
    result.posted += 1;
    log.info('issue-stand-down: note posted', { repo: chain.repo, issue: chain.number, commentId: id });
  }
  return result;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;

export function startIssueStandDownSweep(): void {
  if (timer || !ISSUE_STAND_DOWN_ENABLED || ISSUE_STAND_DOWN_HOURS <= 0) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const res = await sweepIssueStandDowns();
      if (res.chains > 0) log.info('issue-stand-down: sweep done', { ...res });
    } catch (err) {
      log.warn('issue-stand-down: sweep threw', { err: String(err) });
    } finally {
      running = false;
      if (timer) timer = setTimeout(() => void tick(), SWEEP_INTERVAL_MS);
    }
  };
  timer = setTimeout(() => void tick(), FIRST_SWEEP_DELAY_MS);
}

export function stopIssueStandDownSweep(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
