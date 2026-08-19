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

import {
  REVIEW_PAGE_CAP,
  TTL_LONG,
  type ApproverWeeklyInput,
  type TerminalLookup,
  aggregateApproverWeekly,
  aggregateReviewCycles,
  countHumanReview,
  diskCacheTtl,
  fetchAllReviewsWith,
  isOurBotLogin,
  reviewsApiPath,
} from './funnel-metrics.js';
import { initDb } from '../src/db/connection.js';
import { getDb } from '../src/db/connection.js';
import { DATA_DIR } from '../src/config.js';

const PROD_LOG = '/home/ubuntu/slang-coworkers-prod/nanoclaw/logs/nanoclaw.log';
const TOKEN_SCRIPT = `${process.env.HOME}/.config/nanoclaw/gh-app-token.py`;
const INSTALL_BY_OWNER: Record<string, string> = {
  'shader-slang': '122982130',
  'slang-coworkers': '123550981',
};
// Our bot appears BOTH as `nv-slang-bot[bot]` and bare `nv-slang-bot` depending
// on which API surface produced the payload; isOurBotLogin normalises before
// comparing so neither spelling is mistaken for a human.

// Only decisions written through the guarded host path are attributable. Rows
// predating migration 934 backfill to 'legacy': unattributable, which is not
// evidence of forgery but is not evidence of authenticity either, so they are
// not counted. Deliberately a local literal rather than an import of
// TRUSTED_PROVENANCE from src/modules/approval-ledger/store.ts — that export and
// its migration land in a separate PR, and funnel has to build and run on either
// side of it. Keep the two in sync; the probe below fails loudly, not silently,
// if this ever stops matching what the writer stamps.
const TRUSTED_PROVENANCE = 'agent_verified';

// Review-cost helpers live in funnel-metrics.ts so they can be unit-tested —
// this file calls main() at import, so a test importing it would run the funnel.
const fetchAllReviews = (repo: string, pr: number): any[] | null =>
  fetchAllReviewsWith(
    (page) => gh(repo, reviewsApiPath(pr, page)),
    (n) =>
      console.error(`  WARNING ${repo}#${pr}: hit the ${REVIEW_PAGE_CAP}-page review cap at ${n}; counts are a floor`),
  );

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
function classifyPrStage(prState: string | null, isDraft: boolean | null, issueState: string | null): string {
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
// TTL policy (and the reasons behind it) lives in funnel-metrics.ts so it can be
// unit-tested; this file only supplies the cache lookup it needs.
const DISK_CACHE_PATH = path.join(
  path.dirname(import.meta.url.replace('file://', '')),
  '..',
  'reports',
  '.funnel-gh-cache.json',
);

interface DiskCacheEntry {
  data: unknown;
  fetchedAt: number;
}
let diskCache: Record<string, DiskCacheEntry> = {};
try {
  diskCache = JSON.parse(fs.readFileSync(DISK_CACHE_PATH, 'utf-8'));
} catch {
  /* first run or corrupt — start fresh */
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
  } catch {
    /* best-effort */
  }
}

// ── GitHub GET with --noproxy (OneCLI gateway would otherwise tunnel localhost
//    and corrupt these calls) + in-memory + disk cache ──
const ghMemCache = new Map<string, unknown>();

// Does the cache already know this PR/issue reached a terminal state? Answering
// from cache is sound because terminality is one-way: a merged PR never
// un-merges, so even a days-old entry is authoritative for this question. Used
// to let a merged PR's reviews inherit the 24h TTL.
const terminalLookup =
  (repo: string): TerminalLookup =>
  (parentPath) => {
    const key = `${repo}|${parentPath}`;
    const data = (ghMemCache.get(key) ?? diskCache[key]?.data) as any;
    if (!data || typeof data !== 'object' || !('state' in data)) return null;
    return data.merged === true || data.state === 'closed';
  };

function gh(repo: string, apiPath: string): any {
  const key = `${repo}|${apiPath}`;
  if (ghMemCache.has(key)) return ghMemCache.get(key);
  // Check disk cache
  const cached = diskCache[key];
  if (cached) {
    const ttl = diskCacheTtl(apiPath, cached.data, terminalLookup(repo));
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
  // Verity (PR-approver) shadow-mode decision for this PR, joined from
  // approval_decisions by (repo, pr_number). NULL when no approver ran (the
  // common case until the approvers have processed the PR). `decision` is one
  // of WOULD_APPROVE|BLOCK|ABSTAIN_POLICY; `human` is the joined
  // human outcome (APPROVED|CHANGES_REQUESTED|…) or null if not yet joined.
  approver: { decision: string; human: string | null } | null;
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

  // ── Approver ledger: Verity's shadow-mode decisions, keyed by (repo, pr) ──
  // One query, latest decision per PR (a PR can be decided at multiple commits;
  // the funnel shows the most recent). Absent table (pre-migration-929 DB) is
  // tolerated so the funnel still renders on an un-migrated instance.
  const approverByPr = new Map<string, { decision: string; human: string | null }>();
  // Standalone approver ledger for the dashboard's dedicated Verity panel. Unlike
  // `rows[]` (gated by pr_session_mappings — a webhook-routing table only bot-
  // authored PRs are in), this surfaces EVERY decision Verity recorded, including
  // the human-authored PRs it reviewed in shadow mode. One entry per PR, latest
  // decision wins. See dashboard funnelApproverPanel(). NOT the PR spine.
  interface ApproverDecision {
    repo: string;
    pr: number;
    decision: string;
    reason: string | null;
    human: string | null;
    mode: string;
    decidedAt: string;
    // Enriched from GitHub below (null when the PR fetch fails / is uncached):
    prState: string | null; // open | closed | merged
    isDraft: boolean | null;
    prAuthor: string | null;
    authoredByBot: boolean | null; // true = nv-slang-bot's own PR (in the funnel spine); false = human-authored
    // Human review cost. null when the reviews fetch fails / is uncached — which is
    // NOT the same as zero, and is excluded from the aggregate rather than counted
    // as a clean PR. See reviewCycles below.
    humanFeedbackRounds: number | null; // distinct human feedback sessions (COMMENTED + CHANGES_REQUESTED)
    humanChangesRequested: number | null; // strict CHANGES_REQUESTED subset of the above
    humanReviewers: number | null; // distinct human reviewers (0 = merged unreviewed)
  }
  const approverByPrFull = new Map<string, ApproverDecision>();
  // Was the provenance filter actually applied? Reported in the snapshot so the
  // panel can say "unfiltered" out loud rather than presenting a filtered and an
  // unfiltered number identically.
  let provenanceFiltered = false;
  try {
    // Probe for the column rather than referencing it blind. On a DB that has not
    // taken migration 934 a `WHERE provenance` reference throws, the catch below
    // swallows it, and the approver maps come back EMPTY — a panel showing
    // nothing, with nothing anywhere saying why. pragma_table_info() yields zero
    // rows for a missing table instead of throwing, so it also separates "no
    // ledger yet" (expected) from "ledger present but unmigrated". Used as a
    // table-valued function rather than a bare PRAGMA so it is plainly a SELECT
    // and the table name is a bound parameter.
    const columns = db.prepare('SELECT name FROM pragma_table_info(?)').all('approval_decisions') as Array<{
      name: string;
    }>;
    if (columns.length === 0) {
      console.error('  note: no approval_decisions table — the approver panel will be empty');
    } else {
      provenanceFiltered = columns.some((c) => c.name === 'provenance');
      if (!provenanceFiltered) {
        console.error(
          '  WARNING approval_decisions has no provenance column (migration 934 not applied): counting ALL ' +
            'decisions, including any never written through the guarded host path',
        );
      }
      const stmt = db.prepare(
        `SELECT repo, pr_number AS pr, decision, reason_code AS reason, human_verdict AS human,
                mode, decided_at AS decidedAt
         FROM approval_decisions
         ${provenanceFiltered ? 'WHERE provenance = ?' : ''}
         ORDER BY datetime(decided_at) ASC, rowid ASC`,
      );
      const decisions = (provenanceFiltered ? stmt.all(TRUSTED_PROVENANCE) : stmt.all()) as Array<{
        repo: string;
        pr: number;
        decision: string;
        reason: string | null;
        human: string | null;
        mode: string;
        decidedAt: string;
      }>;
      // ASC order + overwrite → last (newest) decision per PR wins. Decisions are
      // append-only per (repo, pr, commit_sha), so a corrected re-decision arrives
      // as a new row on a new head rather than replacing one — last-wins by
      // decided_at is still the right read of "what was decided about this PR".
      for (const d of decisions) {
        if (!orgAllowed(d.repo)) continue;
        if (REPO_FILTER && d.repo !== REPO_FILTER) continue;
        approverByPr.set(`${d.repo}#${d.pr}`, { decision: d.decision, human: d.human });
        approverByPrFull.set(`${d.repo}#${d.pr}`, {
          ...d,
          prState: null,
          isDraft: null,
          prAuthor: null,
          authoredByBot: null,
          humanFeedbackRounds: null,
          humanChangesRequested: null,
          humanReviewers: null,
        });
      }
    }
  } catch (err) {
    // Anything reaching here is a REAL failure, not the expected "no ledger yet"
    // case, which is handled above. Saying so beats an unexplained empty panel.
    console.error(`  WARNING approval_decisions read failed, approver panel will be empty: ${err}`);
  }

  // Migration 935 QUARANTINES every pre-enforcement decision into
  // approval_decisions_legacy instead of leaving it in place. That is the right
  // call — those rows are unattributable — but it means this panel's population
  // changes the day 935 runs, and a count that drops for a STRUCTURAL reason is
  // indistinguishable from the thing it measures having stopped. Exactly the
  // reading error reviewCycles avoids by publishing unreviewedPrs beside the mean.
  //
  // So: report what was set aside. The quarantined rows are NEVER unioned into the
  // trusted panel (`approverDecisions`) or the trusted trend (`approverWeekly`) —
  // counting unattributable rows in a calibration metric is the whole defect. But
  // the week-over-week panel spans only the ~2 weeks since enforcement began, and
  // the older history is real signal an operator wants to see. So we ALSO bucket
  // the quarantined rows into a SEPARATE `approverWeeklyLegacy` series (same math,
  // different array — see funnel-metrics.ts), which the dashboard renders visually
  // distinct as unverified/pre-ledger. The two never merge: trust stays at the
  // call site, so the extended history can't launder itself into the trusted line.
  // readOk:false means the counts are UNKNOWN, not zero. Reporting 0 after a
  // failed read would be the same confident zero this whole change is about.
  const legacyLedger: {
    tableFound: boolean;
    readOk: boolean;
    quarantinedPrs: number | null;
    excludedFromPanelPrs: number | null;
  } = { tableFound: false, readOk: true, quarantinedPrs: 0, excludedFromPanelPrs: 0 };
  // One ApproverWeeklyInput per quarantined PR (latest decision wins), built from
  // the legacy table's OWN columns only. No GitHub enrichment: these rows are
  // explicitly untrusted, so we do not spend fresh ground-truth reconstruction on
  // them — agreement is computed solely from a human_verdict the row already
  // carries (the old, unguarded record_human_verdict could stamp one). A legacy
  // row with no recorded verdict lands in `total`/coverage but not the agreement
  // math, exactly as an unverdicted trusted row does. `prState` etc. stay null,
  // so humanVerdictOf falls back to nothing and returns null for those rows.
  const legacyWeeklyByPr = new Map<string, ApproverWeeklyInput>();
  try {
    const cols = db.prepare('SELECT name FROM pragma_table_info(?)').all('approval_decisions_legacy') as Array<{
      name: string;
    }>;
    legacyLedger.tableFound = cols.length > 0;
    if (legacyLedger.tableFound) {
      // Full rows now (not DISTINCT keys): the legacy trend needs decision +
      // human_verdict + decided_at per PR. ASC by decided_at so the last (newest)
      // decision wins per PR, identical to the trusted read above.
      const rows = db
        .prepare(
          `SELECT repo, pr_number AS pr, decision, human_verdict AS human, decided_at AS decidedAt
             FROM approval_decisions_legacy
            ORDER BY datetime(decided_at) ASC, rowid ASC`,
        )
        .all() as Array<{ repo: string; pr: number; decision: string; human: string | null; decidedAt: string }>;
      for (const r of rows) {
        if (!orgAllowed(r.repo)) continue;
        if (REPO_FILTER && r.repo !== REPO_FILTER) continue;
        const key = `${r.repo}#${r.pr}`;
        // Count each distinct PR once (the query can return several rows per PR).
        if (!legacyWeeklyByPr.has(key)) {
          legacyLedger.quarantinedPrs!++;
          // A PR re-decided after enforcement still appears in the trusted panel;
          // only PRs with NO trusted decision actually vanished from it. That
          // second number is the one that explains a visible drop.
          if (!approverByPrFull.has(key)) legacyLedger.excludedFromPanelPrs!++;
        }
        legacyWeeklyByPr.set(key, {
          decidedAt: r.decidedAt,
          decision: r.decision,
          human: r.human,
          prState: null,
          humanChangesRequested: null,
          humanFeedbackRounds: null,
          humanReviewers: null,
        });
      }
    }
  } catch (err) {
    legacyLedger.readOk = false;
    legacyLedger.quarantinedPrs = null;
    legacyLedger.excludedFromPanelPrs = null;
    console.error(`  WARNING approval_decisions_legacy read failed, exclusion count unknown: ${err}`);
  }
  // Enrich each decided PR with its live GitHub state (merged/open/closed +
  // draft + author). Uses the same cached gh() the spine uses, so a warm disk
  // cache mostly avoids extra calls. "what it decided AND what state" — the
  // panel's whole point. A failed/uncached fetch leaves the fields null.
  for (const d of approverByPrFull.values()) {
    const pr = gh(d.repo, `pulls/${d.pr}`);
    if (!pr) continue;
    d.prState = pr.merged ? 'merged' : (pr.state ?? null);
    d.isDraft = typeof pr.draft === 'boolean' ? pr.draft : null;
    d.prAuthor = pr.user?.login ?? null;
    d.authoredByBot = d.prAuthor ? isOurBotLogin(d.prAuthor) : null;
    // How much HUMAN review did this PR cost? Same cached gh(), so a warm disk
    // cache makes this nearly free. Reviews by a bot, and self-reviews (GitHub
    // does record those), are not human cost and are excluded.
    const reviews = fetchAllReviews(d.repo, d.pr);
    if (reviews) {
      const { feedbackRounds, changesRequestedRounds, reviewers } = countHumanReview(reviews, d.prAuthor);
      d.humanFeedbackRounds = feedbackRounds;
      d.humanChangesRequested = changesRequestedRounds;
      d.humanReviewers = reviewers;
    }
  }
  // Newest decision first for display.
  const approverDecisions = [...approverByPrFull.values()].sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1));

  // Week-over-week agreement trend for the Verity panel: is agreement rising,
  // are abstains falling, is the safety-critical false-approve heading to zero —
  // the three signals for taking Verity out of shadow mode. Built from the SAME
  // (provenance-filtered, legacy-quarantined) approverDecisions above, so it
  // inherits those exclusions with no extra filtering. See funnel-metrics.ts.
  const approverWeekly = aggregateApproverWeekly(approverDecisions);

  // The SAME math over the QUARANTINED pre-enforcement rows, kept as a parallel
  // series so the panel can extend the trend across the full history WITHOUT
  // mixing unverified rows into the trusted line. Empty (and thus omitted-shaped)
  // on any DB where 935 has not run or no legacy rows survive the org/repo filter.
  // The dashboard renders these weeks visually distinct (hatched/greyed, dashed
  // agreement line) and degrades to the verified-only chart when the field is
  // absent from an older snapshot.
  const approverWeeklyLegacy = aggregateApproverWeekly([...legacyWeeklyByPr.values()]);

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
        else if (concl.every((c: string) => c === 'success' || c === 'skipped' || c === 'neutral')) ciBucket = 'pass';
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
      if (Array.isArray(comments)) triaged = comments.some((c: any) => isOurBotLogin(c?.user?.login));
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
      approver: approverByPr.get(`${map.repo}#${map.pr}`) ?? null,
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
        issueParts.push({
          repo,
          number: num,
          url,
          createdAt: it.created_at,
          bucket: 'not_our_problem',
          note: stateReason || 'not-a-bug label',
        });
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
          linkedPrs.push({ number: src.number, author, isBot: isOurBotLogin(author) });
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
        issueParts.push({
          repo,
          number: num,
          url,
          createdAt: it.created_at,
          bucket: 'resolved_elsewhere',
          prNumber: linkedPrs[0].number,
        });
        continue;
      }

      // Did the bot at least comment? (triage)
      const comments = gh(repo, `issues/${num}/comments?per_page=100`);
      const botCommented = Array.isArray(comments) && comments.some((c: any) => isOurBotLogin(c?.user?.login));
      // A closed-completed issue with no bot artifact at all is also resolved elsewhere.
      if (issueState === 'closed' && (stateReason === 'completed' || stateReason == null) && !botCommented) {
        issueParts.push({
          repo,
          number: num,
          url,
          createdAt: it.created_at,
          bucket: 'resolved_elsewhere',
          note: 'closed; no bot artifact',
        });
        continue;
      }
      issueParts.push({
        repo,
        number: num,
        url,
        createdAt: it.created_at,
        bucket: botCommented ? 'triage_only' : 'never_engaged',
      });
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
      return {
        week,
        filed: w.filed,
        actionable: act,
        merged: w.merged,
        botPr: w.botPr,
        winRate: w.botPr > 0 ? w.merged / w.botPr : 0,
      };
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

  const issuePartition = {
    window: { start: windowStart, end: WINDOW_END },
    counts,
    winRate,
    weekly,
    issues: issueParts,
  };

  // The genuine "we engaged but produced no live bot PR" residue — replaces the
  // old log-derived routedNoPr (which over-counted closed/human-resolved/untracked).
  const engagedNoPr = issueParts.filter((p) => p.bucket === 'triage_only').map((p) => `${p.repo}#${p.number}`);

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

  // ── human review cost, aggregated from the enriched approver ledger ──────────
  // Companion to Autonomy (how much ships) and regression-quality (does it hold
  // up): what did that throughput cost a human reviewer? The aggregation lives in
  // funnel-metrics.ts, where the traps it encodes (unreviewed != clean, a failed
  // fetch != zero, merged-only scope, the field name IS the definition) are
  // covered by fixture tests. A "round" is a human feedback SESSION — COMMENTED
  // counts, because almost all review here arrives as COMMENTED; the strict
  // CHANGES_REQUESTED mean ships beside it under its own name.
  const reviewCycles = aggregateReviewCycles(approverDecisions);

  const snapshot = {
    generatedAt: STAMP,
    reviewCycles, // human review cost by author class; see the caveat above
    routedWindowed: routedSet.size,
    board,
    routedNoPr, // legacy (PR-mapping-derived); kept for back-compat
    engagedNoPr, // corrected residue: bot triaged but produced no live bot PR
    issuePartition, // per-issue funnel (denominator = ALL filed issues in window)
    rows,
    approverDecisions, // Verity shadow-mode decisions (incl. human-authored PRs); not gated by the PR spine
    approverWeekly, // Verity decisions bucketed by decidedAt-week: decision mix + agreement vs human
    // The same weekly aggregation over the quarantined pre-enforcement rows — a
    // SEPARATE, unverified series so the panel can show the older weeks' trend
    // without pretending the legacy data is trusted. Never union this into
    // approverWeekly; the dashboard renders it visually distinct. See above.
    approverWeeklyLegacy,

    // Whether the ledger read was restricted to attributable decisions. False
    // means the DB predates migration 934 and this panel includes rows of
    // unknown origin — a caveat the panel should state, not one to bury.
    approverLedger: {
      provenanceFiltered,
      trustedProvenance: provenanceFiltered ? TRUSTED_PROVENANCE : null,
      // What migration 935 set aside. tableFound:false means 935 has not run here,
      // so nothing is quarantined YET — not that nothing ever will be.
      legacy: legacyLedger,
    },
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
    console.log(
      `\nengaged, no live bot PR: ${engagedNoPr.length}  (${engagedNoPr.slice(0, 10).join(', ')}${engagedNoPr.length > 10 ? ', …' : ''})`,
    );

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
    console.log(
      'Routed (win-bound)'.padEnd(18) +
        ''.padStart(4) +
        ''.padStart(7) +
        String(routedSet.size).padStart(7) +
        '   (top)',
    );
  }
  line('PR opened', board.pr_opened, board.pr_opened.total);
  line('PR ready (¬draft)', board.pr_ready, board.pr_opened.total);
  line('Merged', board.merged, board.pr_opened.total);
  console.log('──── terminals / side ───────────────────────');
  line('shipped-draft', board.shipped_draft);
  line('PR closed-unmerged', board.pr_closed_unmerged);
  line('CI red (open PRs)', board.ci_red);
  line('CI green (open PRs)', board.ci_green);
  if (!SKIP_ROUTED)
    console.log(
      `routed→no-PR yet   ${routedNoPr.length}  (${routedNoPr.slice(0, 8).join(', ')}${routedNoPr.length > 8 ? ', …' : ''})`,
    );

  // ── Detail table (with links) ──
  console.log('\nDETAIL  (issue → PR, state, CI)\n');
  console.log('inst  issue                                   PR     state         CI       stage          note');
  console.log('─'.repeat(120));
  for (const r of rows.sort(
    (a, b) => (a.instance + a.repo).localeCompare(b.instance + b.repo) || (a.pr ?? 0) - (b.pr ?? 0),
  )) {
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

main()
  .then(() => {
    saveDiskCache();
    if (diskCacheHits + diskCacheMisses > 0)
      console.error(
        `[funnel] gh cache: ${diskCacheHits} hits, ${diskCacheMisses} misses (${Math.round((diskCacheHits / (diskCacheHits + diskCacheMisses)) * 100)}% hit rate)`,
      );
  })
  .catch((e) => {
    saveDiskCache();
    console.error(e);
    process.exit(1);
  });
