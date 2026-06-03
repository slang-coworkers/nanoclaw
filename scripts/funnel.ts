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

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const SKIP_ROUTED = args.includes('--no-routed');
const REPO_FILTER = args.includes('--repo') ? args[args.indexOf('--repo') + 1] : null;
const OUT_PATH = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
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

// ── GitHub GET with --noproxy (OneCLI gateway would otherwise tunnel localhost
//    and corrupt these calls) + small in-run cache ──
const ghCache = new Map<string, unknown>();
function gh(repo: string, apiPath: string): any {
  const key = `${repo}|${apiPath}`;
  if (ghCache.has(key)) return ghCache.get(key);
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
    ghCache.set(key, json);
    return json;
  } catch {
    return null;
  }
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

    // Terminal classification
    let stage: string;
    let note = '';
    if (prState === 'merged') stage = 'merged';
    else if (prState === 'closed') {
      // Our PR closed un-merged. If the issue itself is closed, another fix
      // likely superseded ours; otherwise it was abandoned/rejected.
      stage = issueState === 'closed' ? 'superseded' : 'pr-closed';
      note = issueState === 'closed' ? 'PR closed un-merged; issue resolved elsewhere' : 'PR closed un-merged';
    } else if (isDraft === false) stage = 'pr-ready';
    else if (isDraft === true) stage = 'shipped-draft';
    else stage = 'pr-open';
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
    if (!seenIssues.has(key)) routedNoPr.push(key);
  }

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

  const snapshot = { generatedAt: STAMP, routedWindowed: routedSet.size, board, routedNoPr, rows };

  // --out <path>: write the snapshot to a file for the dashboard panel to serve
  // (Phase 2). Kept out of the dashboard request path on purpose — this makes
  // ~180 GitHub calls; the dashboard reads the cached JSON, never recomputes.
  if (OUT_PATH) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2));
    if (!JSON_OUT) console.log(`funnel snapshot written: ${OUT_PATH} (${rows.length} PRs, ${routedNoPr.length} routed-no-PR)`);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  if (OUT_PATH) return;

  // ── Text board ──
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + '%' : '—');
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
