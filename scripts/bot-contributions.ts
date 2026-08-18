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
// We therefore count PRs via the search API by the App author, which is exact.
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

function argVal(name: string, def: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const SINCE = argVal('--since', '2026-04-10');
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

async function main(): Promise<void> {
  const discovered = installRepos();
  const rows: Array<{ repo: string; mergedPRs: number; totalPRs: number; commits: number }> = [];
  for (const repo of [...discovered].sort()) {
    const merged = await count(`repo:${repo} type:pr is:merged author:${BOT_AUTHOR} created:>=${SINCE}`);
    await sleep(1200); // keep well under the 30-req/min authenticated search cap
    const total = await count(`repo:${repo} type:pr author:${BOT_AUTHOR} created:>=${SINCE}`);
    await sleep(1200);
    // `commits` is a back-compat alias = mergedPRs so a stale panel still renders
    // the right number until the dashboard change lands.
    if (total > 0) rows.push({ repo, mergedPRs: merged, totalPRs: total, commits: merged });
  }
  rows.sort((a, b) => b.mergedPRs - a.mergedPRs || b.totalPRs - a.totalPRs);

  const totals = rows.reduce(
    (t, r) => ({ mergedPRs: t.mergedPRs + r.mergedPRs, totalPRs: t.totalPRs + r.totalPRs, repos: t.repos + 1 }),
    { mergedPRs: 0, totalPRs: 0, repos: 0 },
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    bot: BOT_AUTHOR,
    since: SINCE,
    metric: 'merged-prs',
    // `repos` is the per-repo rows array — the dashboard reads bc.repos[].mergedPRs
    // (and the `commits` alias). `installRepos` is the raw discovery list.
    repos: rows,
    installRepos: discovered,
    // `commits` alias mirrors totals.mergedPRs for back-compat with any old reader.
    totals: { ...totals, commits: totals.mergedPRs },
  };

  mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(
    `bot-contributions written: ${OUT_PATH} — ${totals.mergedPRs} merged / ${totals.totalPRs} total PRs ` +
      `by ${BOT_AUTHOR} across ${totals.repos} repos since ${SINCE}`,
  );
}

void main();
