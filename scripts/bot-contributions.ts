#!/usr/bin/env tsx
// nv-slang-bot contribution snapshot for the dashboard Funnel view.
//
// Counts PULL REQUESTS opened by our bot across every shader-slang repo the App
// is installed on, since a fixed window start (default 2026-04-10). Writes
// reports/bot-contributions.json, which the dashboard serves at
// /api/bot-contributions (never recomputes inline).
//
// WHY PRs, not `stats/contributors` (the previous approach): our bot lands work
// as squash-merged PRs. GitHub's stats/contributors counts only default-branch
// commits attributed by GH-user login — a squash-merge collapses each PR to a
// single commit re-authored by whoever merged, so the bot's real output
// (~194 merged PRs) showed up as single digits. And the identity is the GitHub
// App bot `app/nv-slang-bot`, NOT the user `nv-slang-bot` (which has ~0 PRs).
//
// TWO API surfaces, on purpose:
//   - totalPRs (open+closed, any state) is a `search/issues` count. Search runs on
//     its OWN rate-limit bucket (30/min), NOT the core-REST 5000/hr budget, so
//     these cost the funnel/regression-quality producers nothing.
//   - code volume (additions/deletions/commits) per MERGED PR used to be one
//     core-REST `GET pulls/{n}` EACH — ~195 calls that drained the shared 5000/hr
//     App budget the funnel and regression-quality producers (and live coworkers)
//     also spend from. It is now a per-repo-page GraphQL census (one query pages
//     40-50 merged PRs, pulling additions/deletions/commits+author in a single
//     round-trip, mirroring scripts/review-rounds.py). GraphQL bills a SEPARATE
//     point budget, so this producer no longer competes for the core budget at all.
//
// Repo set is DISCOVERED from the App installation (all shader-slang repos it can
// see), not hardcoded — a new repo the bot starts contributing to is picked up
// automatically. slang-coworkers/* (our own nanoclaw tooling) is intentionally
// excluded, mirroring funnel.ts's shader-slang-only default.
//
// Run: pnpm exec tsx scripts/bot-contributions.ts [--since YYYY-MM-DD] [--out <path>]
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const TOKEN_SCRIPT = `${process.env.HOME}/.config/nanoclaw/gh-app-token.py`;
// shader-slang org installation id (upstream product repos). The bot's PRs land
// here; our own slang-coworkers tooling is deliberately not counted.
const SHADER_SLANG_INSTALL = '122982130';
// The GitHub App bot login as the search API addresses it. NOT the `nv-slang-bot`
// user (≈0 PRs) — see the header note.
const BOT_AUTHOR = 'app/nv-slang-bot';
const GRAPHQL_URL = 'https://api.github.com/graphql';

function argVal(name: string, def: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const SINCE = argVal('--since', '2026-04-10');
const SINCE_ISO = `${SINCE}T00:00:00Z`;
const OUT_PATH = argVal(
  '--out',
  path.join(path.dirname(import.meta.url.replace('file://', '')), '..', 'reports', 'bot-contributions.json'),
);

let _tok: string | null = null;
function token(): string | null {
  if (_tok) return _tok;
  try {
    _tok = execFileSync('python3', [TOKEN_SCRIPT, '--install-id', SHADER_SLANG_INSTALL], {
      encoding: 'utf-8',
      env: { HOME: process.env.HOME, PATH: process.env.PATH },
    }).trim();
    return _tok || null;
  } catch {
    return null;
  }
}

// GitHub GET → parsed JSON, or null on any failure. Direct curl with --noproxy so
// a leaked http_proxy can't tunnel it through the OneCLI gateway (same rule the
// funnel cron enforces).
function ghJson(apiPath: string): any | null {
  const tok = token();
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
        `https://api.github.com/${apiPath}`,
      ],
      { encoding: 'utf-8', maxBuffer: 40 * 1024 * 1024 },
    );
    return JSON.parse(out);
  } catch {
    return null;
  }
}

// GitHub GraphQL POST → the `data` object, or null on any transport / GraphQL-error
// / parse failure (a GraphQL RATE_LIMITED surfaces as an `errors[]` entry, which we
// treat as a retryable null — the caller sleeps and retries). Same --noproxy rule.
function ghGraphql(query: string, variables: Record<string, unknown>): any | null {
  const tok = token();
  if (!tok) return null;
  try {
    const out = execFileSync(
      'curl',
      [
        '-sS',
        '--noproxy',
        '*',
        '-X',
        'POST',
        '-H',
        `Authorization: bearer ${tok}`,
        '-H',
        'Content-Type: application/json',
        '-H',
        'Accept: application/vnd.github+json',
        '--data-binary',
        '@-',
        GRAPHQL_URL,
      ],
      { encoding: 'utf-8', maxBuffer: 40 * 1024 * 1024, input: JSON.stringify({ query, variables }) },
    );
    const doc = JSON.parse(out);
    if (doc.errors) return null;
    return doc.data ?? null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Normalise a login the way both regression-quality.py and review-rounds.py do:
// GitHub renders the App bot as both "nv-slang-bot" and "nv-slang-bot[bot]" across
// API surfaces, so strip a trailing [bot] and lower-case before comparing.
function normLogin(login: string | null | undefined): string {
  return (login || '').trim().replace(/\[bot\]$/i, '').toLowerCase();
}

// A PR authored by OUR App bot. In GraphQL the App bot is __typename==Bot with
// login "nv-slang-bot"; the ≈0-PR human user of the same name is __typename==User
// and is deliberately not matched.
function isBotAuthor(author: any): boolean {
  return author?.__typename === 'Bot' && normLogin(author?.login) === 'nv-slang-bot';
}

// Every shader-slang repo this App installation can see.
function installRepos(): string[] {
  const repos: string[] = [];
  for (let page = 1; page <= 20; page++) {
    const j = ghJson(`installation/repositories?per_page=100&page=${page}`);
    const rr: any[] = Array.isArray(j?.repositories) ? j.repositories : [];
    for (const r of rr) if (r?.full_name) repos.push(r.full_name);
    if (rr.length < 100) break;
  }
  return repos;
}

// search/issues total_count for a query. per_page=1 — we only want the count.
// Retries on a null/malformed body (search secondary rate limit or transient).
async function count(query: string): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const j = ghJson(`search/issues?q=${encodeURIComponent(query)}&per_page=1`);
    if (j && typeof j.total_count === 'number') return j.total_count;
    await sleep(2500);
  }
  return 0;
}

// One GraphQL query pulls each merged PR's author + diff stats (additions,
// deletions, commit count) in a single round-trip — the batch that replaces the
// old one-REST-call-per-PR loop. States:[MERGED] ordered by UPDATED_AT desc so we
// can stop paging once a whole page falls out of the window.
const PR_QUERY = `
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequests(first:50, after:$cursor, states:[MERGED],
                 orderBy:{field:UPDATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        mergedAt
        additions
        deletions
        author { login __typename }
        commits { totalCount }
      }
    }
  }
}`;

interface RepoStats {
  mergedPRs: number;
  commits: number;
  additions: number;
  deletions: number;
  dates: string[];
}

// Census of the bot's in-window merged PRs for one repo, via paginated GraphQL.
// Best-effort (matches this producer's existing contract): if a page keeps failing
// after retries we stop with what we have rather than fail the whole snapshot.
async function mergedBotPrStats(repo: string): Promise<RepoStats> {
  const [owner, name] = repo.split('/');
  let cursor: string | null = null;
  let mergedPRs = 0;
  let commits = 0;
  let additions = 0;
  let deletions = 0;
  const dates: string[] = [];

  for (let page = 0; page < 200; page++) {
    let data: any | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      data = ghGraphql(PR_QUERY, { owner, name, cursor });
      if (data?.repository) break;
      data = null;
      await sleep(2500); // transient / GraphQL secondary-rate-limit backoff
    }
    if (!data) break;

    const conn = data.repository?.pullRequests ?? {};
    const nodes: any[] = Array.isArray(conn.nodes) ? conn.nodes : [];
    let inWindowAny = false;
    for (const pr of nodes) {
      const mergedAt: string | null = typeof pr?.mergedAt === 'string' ? pr.mergedAt : null;
      if (!mergedAt || mergedAt < SINCE_ISO) continue; // out of window (or unmerged)
      inWindowAny = true;
      if (!isBotAuthor(pr.author)) continue; // human/other-bot PR — not our count
      mergedPRs += 1;
      additions += pr.additions || 0;
      deletions += pr.deletions || 0;
      commits += pr.commits?.totalCount || 0;
      dates.push(mergedAt.slice(0, 10));
    }

    const pageInfo = conn.pageInfo ?? {};
    if (!pageInfo.hasNextPage) break;
    // Newest-updated first: once a full page holds no in-window merge, older pages
    // cannot either — stop (mirrors review-rounds.py's window stop).
    if (nodes.length > 0 && !inWindowAny) break;
    cursor = pageInfo.endCursor ?? null;
    await sleep(300); // gentle; GraphQL point budget is ample
  }

  dates.sort();
  return { mergedPRs, commits, additions, deletions, dates };
}

interface RepoRow {
  repo: string;
  mergedPRs: number;
  totalPRs: number;
  commits: number;
  additions: number;
  deletions: number;
  firstWeek: string | null;
  lastWeek: string | null;
}

async function main(): Promise<void> {
  const discovered = installRepos();
  const rows: RepoRow[] = [];
  for (const repo of [...discovered].sort()) {
    const total = await count(`repo:${repo} type:pr author:${BOT_AUTHOR} created:>=${SINCE}`);
    await sleep(1200);
    if (total === 0) continue; // repo the bot never touched in-window — skip
    const { mergedPRs, commits, additions, deletions, dates } = await mergedBotPrStats(repo);
    rows.push({
      repo,
      mergedPRs,
      totalPRs: total,
      commits,
      additions,
      deletions,
      firstWeek: dates[0] ?? null,
      lastWeek: dates[dates.length - 1] ?? null,
    });
  }
  rows.sort((a, b) => b.mergedPRs - a.mergedPRs || b.totalPRs - a.totalPRs);

  const totals = rows.reduce(
    (t, r) => ({
      mergedPRs: t.mergedPRs + r.mergedPRs,
      totalPRs: t.totalPRs + r.totalPRs,
      commits: t.commits + r.commits,
      additions: t.additions + r.additions,
      deletions: t.deletions + r.deletions,
      repos: t.repos + 1,
    }),
    { mergedPRs: 0, totalPRs: 0, commits: 0, additions: 0, deletions: 0, repos: 0 },
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    bot: BOT_AUTHOR,
    since: SINCE,
    metric: 'merged-prs',
    // Per-repo rows carry BOTH PR counts (mergedPRs/totalPRs) and real code
    // volume (commits/additions/deletions summed from each merged PR's diff, plus
    // the first/last merge date as the active range). `installRepos` is the raw
    // discovery list.
    repos: rows,
    installRepos: discovered,
    totals,
  };

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(
    `bot-contributions written: ${OUT_PATH} — ${totals.mergedPRs} merged / ${totals.totalPRs} total PRs, ` +
      `${totals.commits} commits +${totals.additions}/-${totals.deletions} across ${totals.repos} repos since ${SINCE}`,
  );
}

void main();
