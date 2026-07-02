/**
 * Issue funnel — host-side report. See docs/issue-funnel-design.md.
 *
 * Spine (per instance prod/lego): Routed → Triaged → Fix-attempted → PR-opened
 * → PR-ready(¬draft) → CI-green → Merged, with Shipped-draft as the realistic
 * terminal and Closed-legit / Superseded / Stuck side-exits reported separately.
 *
 * Data sources (all host-reachable; a coworker container CANNOT build this —
 * no v2.db mount, ncl has no PR resource, and prod's log is a foreign disk):
 *   - pr_session_mappings (data/v2.db)        — PR↔instance↔thread (durable spine)
 *   - prod dev-route log                       — Routed head (window-bound)
 *   - GitHub via gh-app tokens                 — issue/PR/CI state, triage comments
 *
 * Usage:
 *   pnpm exec tsx scripts/funnel.ts                          # board + detail tables (text)
 *   LOG_LEVEL=warn pnpm exec tsx scripts/funnel.ts --json    # machine-readable JSON
 *       (LOG_LEVEL=warn silences the DB-init info line so stdout is pure JSON)
 *   pnpm exec tsx scripts/funnel.ts --no-routed              # skip the window-bound log scan
 *   pnpm exec tsx scripts/funnel.ts --repo shader-slang/slang   # filter one repo
 *   pnpm exec tsx scripts/funnel.ts --out reports/funnel.json   # write cached snapshot
 *   pnpm exec tsx scripts/funnel.ts --since 2026-04-10          # override window start
 *       (Phase 2: a cron/manual refresh writes the snapshot; the dashboard
 *        /api/funnel endpoint serves this cached file and never recomputes —
 *        keeps the ~180 GitHub calls out of the request path.)
 *
 * Each detail row carries the issue link, PR link, PR state, CI bucket, and
 * terminal stage. JSON `rows[]` has the same fields for programmatic use.
 *
 * NOTE: host-only. A coworker container cannot run this — no v2.db mount,
 * `ncl` has no PR resource, and prod's log is a foreign disk. See
 * docs/issue-funnel-design.md.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { initDb } from '../src/db/connection.js';
import { getDb } from '../src/db/connection.js';
import { DATA_DIR } from '../src/config.js';

const PROD_LOG = '/home/ubuntu/slang-coworkers-prod/nanoclaw/logs/nanoclaw.log';
const TOKEN_SCRIPT = `${process.env.HOME}/.config/nanoclaw/gh-app-token.py`;
const INSTALL_BY_OWNER: Record<string, string> = {
  'shader-slang': '122982130',
  'slang-coworkers': '123550981',
};
const BOT_LOGIN = 'nv-slang-bot[bot]';

// Repos whose issues form the denominator of the issue partition (the per-issue
// pass below). The PR spine discovers repos from pr_session_mappings, but the
// "ALL issues filed" denominator must be enumerated directly — so we list them.
const TRACKED_REPOS = ['shader-slang/slang', 'shader-slang/slangpy', 'shader-slang/slang-rhi'];

// "Not our problem" — issues that should NOT count against the bot's win-rate.
// state_reason==='not_planned' OR any label here (case-insensitive substring).
// Seeded from labels observed on shader-slang/slang; tune freely.
const NOT_A_BUG_LABELS = [
  'not a slang bug',
  'not reproduced',
  'duplicate',
  'invalid',
  'wontfix',
  "won't fix",
  'question',
  'by design',
];
function isNotOurProblem(stateReason: string | null, labels: string[]): boolean {
  if (stateReason === 'not_planned') return true;
  const lc = labels.map((l) => l.toLowerCase());
  return lc.some((l) => NOT_A_BUG_LABELS.some((bad) => l.includes(bad)));
}

// Terminal stage of a PR, given its state/draft and the linked issue's state.
// Factored out so the PR spine (rows[]) and the issue partition agree.
function classifyPrStage(
  prState: string | null,
  isDraft: boolean | null,
  issueState: string | null,
): string {
  if (prState === 'merged') return 'merged';
  if (prState === 'closed') return issueState === 'closed' ? 'superseded' : 'pr-closed';
  if (isDraft === false) return 'pr-ready';
  if (isDraft === true) return 'shipped-draft';
  return 'pr-open';
}

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const SKIP_ROUTED = args.includes('--no-routed');
const REPO_FILTER = args.includes('--repo') ? args[args.indexOf('--repo') + 1] : null;
const OUT_PATH = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
// --since <YYYY-MM-DD | ISO> overrides the auto-derived window start (which
// otherwise = earliest pr_session_mappings.created_at). Accepts a bare date.
const SINCE_OVERRIDE = (() => {
  if (!args.includes('--since')) return null;
  const raw = args[args.indexOf('--since') + 1];
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error(`--since: unparseable date "${raw}"`);
  return d.toISOString();
})();
// The funnel measures upstream issue resolution, so it scopes to the
// shader-slang org by default. slang-coworkers/nanoclaw PRs are our OWN tooling
// (the agent platform itself), not issues the pipeline resolves — they'd inflate
// the "merged" count with self-development noise. Pass --all-orgs to include them.
const ALL_ORGS = args.includes('--all-orgs');
const orgAllowed = (repo: string) => ALL_ORGS || repo.startsWith('shader-slang/');
const STAMP = new Date().toISOString();

// ── token cache (one installation token per org, ~1h TTL; we run well under) ──
const tokenCache = new Map<string, string>();
function tokenFor(repo: string): string | null {
  const owner = repo.split('/')[0];
  const install = INSTALL_BY_OWNER[owner];
  if (!install) return null;
  if (tokenCache.has(install)) return tokenCache.get(install)!;
  try {
    const tok = execFileSync('python3', [TOKEN_SCRIPT, '--install-id', install], {
      encoding: 'utf-8',
      env: { HOME: process.env.HOME, PATH: process.env.PATH },
    }).trim();
    tokenCache.set(install, tok);
    return tok;
  } catch {
    return null;
  }
}

// ── Disk cache for GitHub API responses ──
// Terminal-state items (merged PRs, closed issues) rarely change — cache them
// for 24h. Open/active items get 15min. Listings always refetch.
const DISK_CACHE_PATH = path.join(path.dirname(import.meta.url.replace('file://', '')), '..', 'reports', '.funnel-gh-cache.json');
const TTL_LONG = 24 * 60 * 60 * 1000;   // 24h — merged PRs, closed issues
const TTL_MED = 60 * 60 * 1000;          // 1h  — check-runs, timeline, comments
const TTL_SHORT = 15 * 60 * 1000;        // 15m — open items, listings

interface DiskCacheEntry { data: unknown; fetchedAt: number; }
let diskCache: Record<string, DiskCacheEntry> = {};
try {
  diskCache = JSON.parse(fs.readFileSync(DISK_CACHE_PATH, 'utf-8'));
} catch { /* first run or corrupt — start fresh */ }

function diskCacheTtl(apiPath: string, data: any): number {
  // Listings and paginated results: always refetch
  if (apiPath.includes('page=') || apiPath.match(/^issues\?/)) return TTL_SHORT;
  // Individual PR or issue: long TTL if terminal state
  if (/^pulls\/\d+$/.test(apiPath) && data) {
    if (data.merged || data.state === 'closed') return TTL_LONG;
    return TTL_SHORT;
  }
  if (/^issues\/\d+$/.test(apiPath) && data) {
    if (data.state === 'closed') return TTL_LONG;
    return TTL_SHORT;
  }
  // Check-runs, timeline, comments: medium
  if (apiPath.includes('check-runs') || apiPath.includes('timeline') || apiPath.includes('comments')) {
    return TTL_MED;
  }
  return TTL_SHORT;
}

let diskCacheHits = 0;
let diskCacheMisses = 0;

function saveDiskCache(): void {
  try {
    fs.mkdirSync(path.dirname(DISK_CACHE_PATH), { recursive: true });
    // Prune entries older than 48h before saving
    const cutoff = Date.now() - 2 * TTL_LONG;
    const pruned: Record<string, DiskCacheEntry> = {};
    for (const [k, v] of Object.entries(diskCache)) {
      if (v.fetchedAt > cutoff) pruned[k] = v;
    }
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(pruned));
  } catch { /* best-effort */ }
}

// ── GitHub GET with --noproxy (OneCLI gateway would otherwise tunnel localhost
//    and corrupt these calls) + in-memory + disk cache ──
const ghMemCache = new Map<string, unknown>();
function gh(repo: string, apiPath: string): any {
  const key = `${repo}|${apiPath}`;
  if (ghMemCache.has(key)) return ghMemCache.get(key);
  // Check disk cache
  const cached = diskCache[key];
  if (cached) {
    const ttl = diskCacheTtl(apiPath, cached.data);
    if (Date.now() - cached.fetchedAt < ttl) {
      diskCacheHits++;
      ghMemCache.set(key, cached.data);
      return cached.data;
    }
  }
  diskCacheMisses++;
  const tok = tokenFor(repo);
  if (!tok) return null;
  try {
    const out = execFileSync(
      'curl',
      [
        '-sS',
        '--noproxy',
        '*',
        '-H',
        `Authorization: token ${tok}`,
        '-H',
        'Accept: application/vnd.github+json',
        `https://api.github.com/repos/${repo}/${apiPath}`,
      ],
      { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 },
    );
    const json = JSON.parse(out);
    ghMemCache.set(key, json);
    diskCache[key] = { data: json, fetchedAt: Date.now() };
    return json;
  } catch {
    return null;
  }
}

// Paginated GET: follows ?page=N until a short page (< per_page) is returned.
// Used for listing all issues in a repo (the denominator). Returns the
// concatenated array, or [] on any failure.
function ghPaged(repo: string, apiPathNoPage: string, perPage = 100): any[] {
  const out: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const sep = apiPathNoPage.includes('?') ? '&' : '?';
    const chunk = gh(repo, `${apiPathNoPage}${sep}per_page=${perPage}&page=${page}`);
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    out.push(...chunk);
    if (chunk.length < perPage) break;
  }
  return out;
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

interface Row {
  repo: string;
  issue: number | null;
  instance: string;
  pr: number | null;
  prUrl: string | null;
  issueUrl: string | null;
  routed: boolean;
  triaged: boolean;
  prState: string | null; // open|closed|merged
  isDraft: boolean | null;
  ciBucket: string | null; // pass|fail|pending|none
  stage: string; // terminal classification
  note: string;
}

function issueNumFromThread(threadId: string | null): number | null {
  if (!threadId) return null;
  const m = threadId.match(/gh-issue-[^-]+\/[^-]+-(\d+)$/) || threadId.match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function main() {
  initDb(path.join(DATA_DIR, 'v2.db'));
  const db = getDb();

  // ── Spine source: pr_session_mappings (durable PR↔instance↔thread) ──
  let mappings = db
    .prepare(
      'SELECT repo, pr_number AS pr, owner_instance AS instance, thread_id FROM pr_session_mappings ORDER BY repo, pr_number',
    )
    .all() as Array<{ repo: string; pr: number; instance: string; thread_id: string | null }>;
  if (REPO_FILTER) mappings = mappings.filter((m) => m.repo === REPO_FILTER);
  mappings = mappings.filter((m) => orgAllowed(m.repo));

  // ── Routed head (window-bound): distinct (repo, issue#) from prod dev-route log ──
  const routedSet = new Set<string>(); // `${repo}#${issue}`
  if (!SKIP_ROUTED && fs.existsSync(PROD_LOG)) {
    const log = stripAnsi(fs.readFileSync(PROD_LOG, 'utf-8'));
    const re = /dev-routed issue(?: comment)? to peer.*?repo="([^"]+)".*?issue=(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(log))) routedSet.add(`${m[1]}#${m[2]}`);
  }

  const rows: Row[] = [];
  const seenIssues = new Set<string>();

  for (const map of mappings) {
    const pr = gh(map.repo, `pulls/${map.pr}`);
    // Issue# = thread_id if present, else parse the PR body's Fixes/Closes #N
    // (the authoritative PR→issue link when the session wasn't gh-issue-threaded).
    let issue = issueNumFromThread(map.thread_id);
    if (issue == null && pr?.body) {
      const fm = String(pr.body).match(/(?:fixes|closes|resolves)\s+#(\d+)/i);
      if (fm) issue = Number(fm[1]);
    }
    const issueKey = issue ? `${map.repo}#${issue}` : `${map.repo}#pr${map.pr}`;
    seenIssues.add(issueKey);
    const prState = pr ? (pr.merged ? 'merged' : pr.state) : null;
    const isDraft = pr ? Boolean(pr.draft) : null;
    const prUrl = pr?.html_url ?? `https://github.com/${map.repo}/pull/${map.pr}`;

    // CI bucket from head SHA check-runs
    let ciBucket: string | null = null;
    if (pr?.head?.sha) {
      const checks = gh(map.repo, `commits/${pr.head.sha}/check-runs`);
      const runs = checks?.check_runs ?? [];
      if (runs.length) {
        const concl = runs.map((r: any) => r.conclusion);
        if (concl.some((c: string) => c === 'failure' || c === 'timed_out')) ciBucket = 'fail';
        else if (runs.some((r: any) => r.status !== 'completed')) ciBucket = 'pending';
        else if (concl.every((c: string) => c === 'success' || c === 'skipped' || c === 'neutral'))
          ciBucket = 'pass';
        else ciBucket = 'other';
      } else ciBucket = 'none';
    }

    // Issue side: triaged (bot comment present)? closed (and why)?
    let triaged = false;
    let issueUrl: string | null = issue ? `https://github.com/${map.repo}/issues/${issue}` : null;
    let issueState: string | null = null;
    let closedReason: string | null = null;
    if (issue) {
      const comments = gh(map.repo, `issues/${issue}/comments?per_page=100`);
      if (Array.isArray(comments)) triaged = comments.some((c: any) => c?.user?.login === BOT_LOGIN);
      const iss = gh(map.repo, `issues/${issue}`);
      if (iss) {
        issueUrl = iss.html_url ?? issueUrl;
        issueState = iss.state ?? null;
        if (iss.state === 'closed') closedReason = iss.state_reason ?? 'completed';
      }
    }

    // Terminal classification (shared with the issue partition below).
    const stage = classifyPrStage(prState, isDraft, issueState);
    let note = '';
    if (stage === 'superseded') note = 'PR closed un-merged; issue resolved elsewhere';
    else if (stage === 'pr-closed') note = 'PR closed un-merged';
    if (ciBucket === 'fail' && stage !== 'merged') note = (note ? note + '; ' : '') + 'CI red';
    if (closedReason && closedReason !== 'completed') note = (note ? note + '; ' : '') + `issue:${closedReason}`;

    rows.push({
      repo: map.repo,
      issue,
      instance: map.instance,
      pr: map.pr,
      prUrl,
      issueUrl,
      routed: issue ? routedSet.has(`${map.repo}#${issue}`) : false,
      triaged,
      prState,
      isDraft,
      ciBucket,
      stage,
      note,
    });
  }

  // Routed issues that never reached a PR (no mapping row) — top-of-funnel tail.
  const routedNoPr: string[] = [];
  for (const key of routedSet) {
    if (REPO_FILTER && !key.startsWith(REPO_FILTER + '#')) continue;
    if (key.startsWith('test-org/')) continue; // synthetic webhook tests
    if (!orgAllowed(key.split('#')[0])) continue; // shader-slang only by default
    if (!seenIssues.has(key)) routedNoPr.push(key);
  }

  // ── Issue partition (the per-issue funnel) ──────────────────────────────
  // Answers "of ALL issues filed in the window, where did each go?" — the
  // denominator the PR spine above can't see. Buckets are mutually exclusive:
  //   not_our_problem  — not_planned / not-a-bug label (excluded from win-rate)
  //   bot_pr.*         — a nv-slang-bot PR is linked (sub-classified by stage)
  //   resolved_elsewhere — closed-completed, only human PR(s) linked
  //   triage_only      — bot commented, no bot PR
  //   never_engaged    — no bot comment, no bot PR
  // win-rate = bot_pr.merged / actionable, where actionable = filed − not_our_problem.
  const WINDOW_END = STAMP;
  // --since wins; otherwise auto-derive from the earliest tracked PR mapping,
  // falling back to a fixed default.
  let windowStart = SINCE_OVERRIDE ?? '2026-05-01T00:00:00Z';
  if (!SINCE_OVERRIDE) {
    try {
      const r = db.prepare('SELECT MIN(created_at) AS m FROM pr_session_mappings').get() as { m: string | null };
      if (r?.m) windowStart = new Date(r.m.replace(' ', 'T') + 'Z').toISOString();
    } catch {
      /* keep fallback */
    }
  }

  interface IssuePart {
    repo: string;
    number: number;
    url: string;
    bucket: string; // not_our_problem | never_engaged | triage_only | resolved_elsewhere | bot_pr
    stage?: string; // bot-PR sub-stage (merged|shipped-draft|pr-ready|pr-closed|superseded|pr-open)
    prNumber?: number;
    prUrl?: string;
    note?: string;
    createdAt?: string; // issue created_at — used for the weekly WIN trend
  }
  const issueParts: IssuePart[] = [];
  const partRepos = (REPO_FILTER ? [REPO_FILTER] : TRACKED_REPOS).filter(orgAllowed);

  for (const repo of partRepos) {
    // since= is *updated*-time → superset; we filter created_at >= windowStart below.
    const listed = ghPaged(repo, `issues?state=all&since=${encodeURIComponent(windowStart)}`);
    for (const it of listed) {
      if (it?.pull_request) continue; // the /issues endpoint mixes PRs in — drop them
      if (!it?.created_at || it.created_at < windowStart) continue; // window guard
      const num = it.number as number;
      const labels: string[] = Array.isArray(it.labels)
        ? it.labels.map((l: any) => (typeof l === 'string' ? l : l?.name)).filter(Boolean)
        : [];
      const issueState: string = it.state ?? 'open';
      const stateReason: string | null = it.state_reason ?? null;
      const url: string = it.html_url ?? `https://github.com/${repo}/issues/${num}`;

      if (isNotOurProblem(stateReason, labels)) {
        issueParts.push({ repo, number: num, url, createdAt: it.created_at, bucket: 'not_our_problem', note: stateReason || 'not-a-bug label' });
        continue;
      }

      // Linked PRs via timeline cross-references (catches bot PRs not in our
      // mapping table, and tells bot-authored from human-authored apart).
      const timeline = gh(repo, `issues/${num}/timeline?per_page=100`);
      const linkedPrs: Array<{ number: number; author: string; isBot: boolean }> = [];
      if (Array.isArray(timeline)) {
        for (const e of timeline) {
          if (e?.event !== 'cross-referenced') continue;
          const src = e?.source?.issue;
          if (!src?.pull_request) continue;
          const author = src?.user?.login ?? '';
          linkedPrs.push({ number: src.number, author, isBot: author === BOT_LOGIN });
        }
      }
      const botPr = linkedPrs.find((p) => p.isBot);

      if (botPr) {
        const pr = gh(repo, `pulls/${botPr.number}`);
        const prState = pr ? (pr.merged ? 'merged' : pr.state) : 'open';
        const isDraft = pr ? Boolean(pr.draft) : null;
        const stage = classifyPrStage(prState, isDraft, issueState);
        issueParts.push({
          repo,
          number: num,
          url,
          createdAt: it.created_at,
          bucket: 'bot_pr',
          stage,
          prNumber: botPr.number,
          prUrl: pr?.html_url ?? `https://github.com/${repo}/pull/${botPr.number}`,
        });
        continue;
      }

      // No bot PR. If closed-completed with a human PR linked, it's resolved
      // elsewhere (neutral exit, not our win, not our failure).
      if (issueState === 'closed' && (stateReason === 'completed' || stateReason == null) && linkedPrs.length > 0) {
        issueParts.push({ repo, number: num, url, createdAt: it.created_at, bucket: 'resolved_elsewhere', prNumber: linkedPrs[0].number });
        continue;
      }

      // Did the bot at least comment? (triage)
      const comments = gh(repo, `issues/${num}/comments?per_page=100`);
      const botCommented = Array.isArray(comments) && comments.some((c: any) => c?.user?.login === BOT_LOGIN);
      // A closed-completed issue with no bot artifact at all is also resolved elsewhere.
      if (issueState === 'closed' && (stateReason === 'completed' || stateReason == null) && !botCommented) {
        issueParts.push({ repo, number: num, url, createdAt: it.created_at, bucket: 'resolved_elsewhere', note: 'closed; no bot artifact' });
        continue;
      }
      issueParts.push({ repo, number: num, url, createdAt: it.created_at, bucket: botCommented ? 'triage_only' : 'never_engaged' });
    }
  }

  const partCount = (pred: (p: IssuePart) => boolean) => issueParts.filter(pred).length;
  const botPrParts = issueParts.filter((p) => p.bucket === 'bot_pr');
  const botPrBy = (stage: string) => botPrParts.filter((p) => p.stage === stage).length;
  const filed = issueParts.length;
  const notOurProblem = partCount((p) => p.bucket === 'not_our_problem');
  const actionable = filed - notOurProblem;
  const counts = {
    filed,
    not_our_problem: notOurProblem,
    actionable,
    never_engaged: partCount((p) => p.bucket === 'never_engaged'),
    triage_only: partCount((p) => p.bucket === 'triage_only'),
    resolved_elsewhere: partCount((p) => p.bucket === 'resolved_elsewhere'),
    bot_pr: {
      total: botPrParts.length,
      merged: botPrBy('merged'),
      shipped_draft: botPrBy('shipped-draft'),
      pr_ready: botPrBy('pr-ready'),
      pr_closed: botPrBy('pr-closed') + botPrBy('superseded'),
      pr_open: botPrBy('pr-open'),
    },
  };
  const winRate = counts.bot_pr.total > 0 ? counts.bot_pr.merged / counts.bot_pr.total : 0;

  // ── Weekly WIN trend (rolling) ──────────────────────────────────────────
  // Cohort issues by the Monday of the week they were FILED, then per week:
  //   actionable = filed − not_our_problem;  merged = bot_pr stage 'merged';
  //   winRate = merged / actionable. Plus a trailing 4-week rolling win-rate
  //   so the dashboard can show whether we're trending up or down.
  function weekStart(iso: string): string {
    const d = new Date(iso);
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  }
  const weekMap = new Map<string, { filed: number; notOur: number; merged: number; botPr: number }>();
  for (const p of issueParts) {
    if (!p.createdAt) continue;
    const wk = weekStart(p.createdAt);
    const w = weekMap.get(wk) ?? { filed: 0, notOur: 0, merged: 0, botPr: 0 };
    w.filed++;
    if (p.bucket === 'not_our_problem') w.notOur++;
    if (p.bucket === 'bot_pr') w.botPr++;
    if (p.bucket === 'bot_pr' && p.stage === 'merged') w.merged++;
    weekMap.set(wk, w);
  }
  const weekly = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, w]) => {
      const act = w.filed - w.notOur;
      return { week, filed: w.filed, actionable: act, merged: w.merged, botPr: w.botPr, winRate: w.botPr > 0 ? w.merged / w.botPr : 0 };
    });
  // Trailing 4-week rolling win-rate (sum merged / sum bot PRs authored over the window).
  const ROLL = 4;
  for (let i = 0; i < weekly.length; i++) {
    let m = 0;
    let bp = 0;
    for (let j = Math.max(0, i - ROLL + 1); j <= i; j++) {
      m += weekly[j].merged;
      bp += weekly[j].botPr;
    }
    (weekly[i] as any).rollingWinRate = bp > 0 ? m / bp : 0;
  }

  const issuePartition = { window: { start: windowStart, end: WINDOW_END }, counts, winRate, weekly, issues: issueParts };

  // The genuine "we engaged but produced no live bot PR" residue — replaces the
  // old log-derived routedNoPr (which over-counted closed/human-resolved/untracked).
  const engagedNoPr = issueParts
    .filter((p) => p.bucket === 'triage_only')
    .map((p) => `${p.repo}#${p.number}`);

  // ── Aggregate the board ──
  const instances = ['prod', 'lego'];
  const count = (pred: (r: Row) => boolean, inst?: string) =>
    rows.filter((r) => (inst ? r.instance === inst : true) && pred(r)).length;
  const board = {
    routed_with_pr: rows.length,
    routed_no_pr: routedNoPr.length,
    pr_opened: { prod: count(() => true, 'prod'), lego: count(() => true, 'lego'), total: rows.length },
    pr_ready: byInst((r) => r.isDraft === false),
    ci_green: byInst((r) => r.ciBucket === 'pass' && r.prState === 'open'),
    merged: byInst((r) => r.prState === 'merged'),
    shipped_draft: byInst((r) => r.isDraft === true && r.prState !== 'merged'),
    pr_closed_unmerged: byInst((r) => r.prState === 'closed'),
    ci_red: byInst((r) => r.ciBucket === 'fail' && r.prState !== 'merged'),
  };
  function byInst(pred: (r: Row) => boolean) {
    return { prod: count(pred, 'prod'), lego: count(pred, 'lego'), total: count(pred) };
  }

  const snapshot = {
    generatedAt: STAMP,
    routedWindowed: routedSet.size,
    board,
    routedNoPr, // legacy (PR-mapping-derived); kept for back-compat
    engagedNoPr, // corrected residue: bot triaged but produced no live bot PR
    issuePartition, // per-issue funnel (denominator = ALL filed issues in window)
    rows,
  };

  // --out <path>: write the snapshot to a file for the dashboard panel to serve
  // (Phase 2). Kept out of the dashboard request path on purpose — this makes
  // ~180 GitHub calls; the dashboard reads the cached JSON, never recomputes.
  if (OUT_PATH) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
    if (!JSON_OUT)
      console.log(
        `funnel snapshot written: ${OUT_PATH} (${rows.length} PRs; ${counts.filed} issues filed, ${counts.actionable} actionable, ${counts.bot_pr.merged} merged → win-rate ${Math.round(winRate * 100)}%)`,
      );
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  if (OUT_PATH) return;

  // ── Text board ──
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + '%' : '—');

  // Issue partition (denominator = ALL issues filed in window).
  console.log(`\nISSUE PARTITION  (filed ${counts.filed} in window ${windowStart.slice(0, 10)}→now)\n`);
  const ipart = (label: string, n: number, base = actionable) =>
    console.log(label.padEnd(22) + String(n).padStart(5) + '   ' + pct(n, base));
  console.log('  (denominator for win-rate = ACTIONABLE = filed − not-our-problem)');
  console.log('────────────────────────────────────────────');
  console.log('Filed'.padEnd(22) + String(counts.filed).padStart(5));
  console.log('Not-our-problem'.padEnd(22) + String(counts.not_our_problem).padStart(5) + '   (excluded)');
  console.log('Actionable'.padEnd(22) + String(actionable).padStart(5) + '   100%');
  ipart('  never-engaged', counts.never_engaged);
  ipart('  triage-only', counts.triage_only);
  ipart('  resolved-elsewhere', counts.resolved_elsewhere);
  ipart('  bot-PR (any)', counts.bot_pr.total);
  ipart('    ↳ merged ★ WIN', counts.bot_pr.merged);
  ipart('    ↳ shipped-draft', counts.bot_pr.shipped_draft);
  ipart('    ↳ pr-ready', counts.bot_pr.pr_ready);
  ipart('    ↳ pr-open', counts.bot_pr.pr_open);
  ipart('    ↳ pr-closed/superseded', counts.bot_pr.pr_closed);
  console.log('────────────────────────────────────────────');
  console.log(`WIN-RATE  (merged ÷ PRs authored) = ${Math.round(winRate * 100)}%`);
  if (weekly.length) {
    console.log('\nWEEKLY WIN TREND  (by issue file-week; rolling = trailing 4wk)\n');
    console.log('week        filed  act  merged  win%   roll%');
    for (const w of weekly) {
      console.log(
        w.week.padEnd(12) +
          String(w.filed).padStart(4) +
          String(w.actionable).padStart(5) +
          String(w.merged).padStart(7) +
          (Math.round(w.winRate * 100) + '%').padStart(7) +
          (Math.round(((w as any).rollingWinRate ?? 0) * 100) + '%').padStart(7),
      );
    }
  }
  if (engagedNoPr.length)
    console.log(`\nengaged, no live bot PR: ${engagedNoPr.length}  (${engagedNoPr.slice(0, 10).join(', ')}${engagedNoPr.length > 10 ? ', …' : ''})`);

  console.log('\nISSUE FUNNEL  (PR spine = pr_session_mappings; GitHub-enriched)\n');
  console.log('STAGE              prod   lego  total   conv');
  console.log('────────────────────────────────────────────');
  const line = (label: string, b: { prod: number; lego: number; total: number }, base?: number) =>
    console.log(
      label.padEnd(18) +
        String(b.prod).padStart(4) +
        String(b.lego).padStart(7) +
        String(b.total).padStart(7) +
        (base != null ? '   ' + pct(b.total, base) : ''),
    );
  if (!SKIP_ROUTED) {
    // The dev-route log line doesn't reliably carry the instance per row, so
    // Routed is reported as a single window-bound total (the funnel head).
    console.log('Routed (win-bound)'.padEnd(18) + ''.padStart(4) + ''.padStart(7) + String(routedSet.size).padStart(7) + '   (top)');
  }
  line('PR opened', board.pr_opened, board.pr_opened.total);
  line('PR ready (¬draft)', board.pr_ready, board.pr_opened.total);
  line('Merged', board.merged, board.pr_opened.total);
  console.log('──── terminals / side ───────────────────────');
  line('shipped-draft', board.shipped_draft);
  line('PR closed-unmerged', board.pr_closed_unmerged);
  line('CI red (open PRs)', board.ci_red);
  line('CI green (open PRs)', board.ci_green);
  if (!SKIP_ROUTED) console.log(`routed→no-PR yet   ${routedNoPr.length}  (${routedNoPr.slice(0, 8).join(', ')}${routedNoPr.length > 8 ? ', …' : ''})`);

  // ── Detail table (with links) ──
  console.log('\nDETAIL  (issue → PR, state, CI)\n');
  console.log('inst  issue                                   PR     state         CI       stage          note');
  console.log('─'.repeat(120));
  for (const r of rows.sort((a, b) => (a.instance + a.repo).localeCompare(b.instance + b.repo) || (a.pr ?? 0) - (b.pr ?? 0))) {
    const issueCell = r.issueUrl ?? `${r.repo}#?`;
    console.log(
      r.instance.padEnd(5) +
        ' ' +
        (issueCell || '').padEnd(42) +
        ('#' + r.pr).padEnd(7) +
        (r.prState ?? '?').padEnd(14) +
        (r.ciBucket ?? '-').padEnd(9) +
        r.stage.padEnd(15) +
        r.note,
    );
    console.log('      ' + (r.prUrl ?? ''));
  }
  console.log(
    `\nLegend: shipped-draft = review-ready, parked at human merge gate (realistic terminal); merged = stretch.\n` +
      `Routed is window-bound (prod log rotates). PR spine + instance split are durable (pr_session_mappings).\n`,
  );
}

main().then(() => {
  saveDiskCache();
  if (diskCacheHits + diskCacheMisses > 0)
    console.error(`[funnel] gh cache: ${diskCacheHits} hits, ${diskCacheMisses} misses (${Math.round(diskCacheHits / (diskCacheHits + diskCacheMisses) * 100)}% hit rate)`);
}).catch((e) => {
  saveDiskCache();
  console.error(e);
  process.exit(1);
});
