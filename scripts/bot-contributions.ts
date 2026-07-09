#!/usr/bin/env tsx
// nv-slang-bot contribution snapshot for the dashboard Funnel view.
//
// Mirrors the funnel's GitHub-App-token approach (scripts/funnel.ts): resolve a
// per-org installation token via the local gh-app-token.py helper, then hit the
// GitHub `stats/contributors` endpoint for each tracked repo and sum the bot's
// commits / additions / deletions. Writes reports/bot-contributions.json, which
// the dashboard serves at /api/bot-contributions (never recomputes inline).
//
// Run: pnpm exec tsx scripts/bot-contributions.ts [--out <path>]
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const TOKEN_SCRIPT = `${process.env.HOME}/.config/nanoclaw/gh-app-token.py`;
const INSTALL_BY_OWNER: Record<string, string> = {
  'shader-slang': '122982130',
  'slang-coworkers': '123550981',
};
// Same repo set the funnel tracks. The bot's login carries the [bot] suffix on
// some repos and not others, so match by prefix.
const REPOS = ['shader-slang/slang', 'shader-slang/slang-rhi', 'shader-slang/slangpy'];
const BOT_RE = /^nv-slang-bot/i;

const outArgIdx = process.argv.indexOf('--out');
const OUT_PATH =
  outArgIdx >= 0 && process.argv[outArgIdx + 1]
    ? process.argv[outArgIdx + 1]
    : path.join(path.dirname(import.meta.url.replace('file://', '')), '..', 'reports', 'bot-contributions.json');

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

// GitHub GET returning { code, json }. `stats/contributors` replies 202 with an
// empty body while GitHub computes the stats, so the caller retries on 202/empty.
function ghRaw(repo: string, apiPath: string): { code: number; body: string } {
  const tok = tokenFor(repo);
  if (!tok) return { code: 0, body: '' };
  try {
    const out = execFileSync(
      'curl',
      [
        '-sS',
        '--noproxy',
        '*',
        '-w',
        '\n%{http_code}',
        '-H',
        `Authorization: token ${tok}`,
        '-H',
        'Accept: application/vnd.github+json',
        `https://api.github.com/repos/${repo}/${apiPath}`,
      ],
      { encoding: 'utf-8', maxBuffer: 40 * 1024 * 1024 },
    );
    const nl = out.lastIndexOf('\n');
    return { code: Number(out.slice(nl + 1).trim()) || 0, body: out.slice(0, nl) };
  } catch {
    return { code: 0, body: '' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// stats/contributors with 202-retry. Returns the contributor array, or null.
async function contributors(repo: string): Promise<any[] | null> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { code, body } = ghRaw(repo, 'stats/contributors');
    if (code === 200 && body.trim()) {
      try {
        const j = JSON.parse(body);
        if (Array.isArray(j)) return j;
      } catch {
        /* fall through to retry */
      }
    }
    if (code === 403 || code === 404) return null; // auth/repo problem — don't spin
    await sleep(2500); // 202 (computing) or transient — wait and retry
  }
  return null;
}

const repos: Array<{
  repo: string;
  login: string | null;
  commits: number;
  additions: number;
  deletions: number;
  firstWeek: string | null;
  lastWeek: string | null;
  error?: string;
}> = [];

for (const repo of REPOS) {
  const list = await contributors(repo);
  if (!list) {
    repos.push({ repo, login: null, commits: 0, additions: 0, deletions: 0, firstWeek: null, lastWeek: null, error: 'stats unavailable' });
    continue;
  }
  const bot = list.find((c: any) => c?.author?.login && BOT_RE.test(c.author.login));
  if (!bot) {
    repos.push({ repo, login: null, commits: 0, additions: 0, deletions: 0, firstWeek: null, lastWeek: null });
    continue;
  }
  const weeks: any[] = Array.isArray(bot.weeks) ? bot.weeks : [];
  const active = weeks.filter((w) => (w.c || 0) > 0).map((w) => w.w);
  const toDay = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);
  repos.push({
    repo,
    login: bot.author.login,
    commits: bot.total || 0,
    additions: weeks.reduce((s, w) => s + (w.a || 0), 0),
    deletions: weeks.reduce((s, w) => s + (w.d || 0), 0),
    firstWeek: active.length ? toDay(Math.min(...active)) : null,
    lastWeek: active.length ? toDay(Math.max(...active)) : null,
  });
}

const totals = repos.reduce(
  (t, r) => ({ commits: t.commits + r.commits, additions: t.additions + r.additions, deletions: t.deletions + r.deletions }),
  { commits: 0, additions: 0, deletions: 0 },
);

const snapshot = { generatedAt: new Date().toISOString(), bot: 'nv-slang-bot', repos, totals };
mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
console.log(
  `bot-contributions written: ${OUT_PATH} — ${totals.commits} commits, +${totals.additions}/-${totals.deletions} across ${repos.filter((r) => r.commits).length}/${REPOS.length} repos`,
);
