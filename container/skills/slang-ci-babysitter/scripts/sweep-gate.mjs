import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REPO_OWNER = 'shader-slang';
const REPO_NAME = 'slang';
const REPO = REPO_OWNER + '/' + REPO_NAME;
const H = {
  Authorization: 'token ' + process.env.GH_TOKEN,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'slang-ci-babysitter',
};
const api = async (p) => {
  const r = await fetch('https://api.github.com/repos/' + REPO + p, { headers: H });
  if (!r.ok) throw new Error('GitHub API ' + r.status + ' ' + r.statusText + ' for ' + p);
  return r.json();
};
const graphql = async (query, variables) => {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error('GitHub GraphQL ' + r.status + ' ' + r.statusText);
  const j = await r.json();
  if (j.errors) throw new Error('GraphQL errors: ' + JSON.stringify(j.errors));
  return j.data;
};

const fetchAllPages = async (path, perPage, extract, stopEarly) => {
  let all = [];
  for (let page = 1; ; page++) {
    const sep = path.indexOf('?') >= 0 ? '&' : '?';
    const raw = await api(path + sep + 'per_page=' + perPage + '&page=' + page);
    const items = extract(raw);
    all = all.concat(items);
    if (items.length < perPage) break;
    if (stopEarly && stopEarly(items)) break;
  }
  return all;
};

// Run fn over items with at most limit in flight at once. The
// pre-existing remainder loop below awaited fetchCheckRuns one PR at a time
// (up to CHECKRUN_SCAN_CAP=150 sequential round-trips); measured against the
// live repo (116 remainder PRs) that took ~70s on its own, already past the
// script's 30s budget before this change added anything. Bounded concurrency
// is the fix -- unbounded Promise.all risks GitHub's secondary rate limit,
// sequential risks the timeout.
const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
};

const PRS_CAP = 20;              // freshness floor: top-N by updated_at desc, always included
const UNION_CAP = 40;            // triage list cap on a normal (floor+activity) fire
const FULL_SCAN_CAP = 60;        // triage list cap on a full-scan fire (non-SUCCESS rollups only, so much smaller than totalNonDraft)
const ACTIVITY_WINDOW_HOURS = 3; // 1.5x the 2h cron cadence, for slack against a delayed fire
const CHECKRUN_SCAN_CAP = 150;   // bound worst-case check-runs calls on a normal fire
const FULL_SCAN_HOURS = [6, 18]; // UTC hours that trigger a full-scan fire (catches stuck-and-silent PRs)

// Conclusion values that mean 'red' for both a check-run (job) and a workflow run.
// Shared by the tracked-regression exclusion split (check-run level) and the
// evicted/merge-group filter (workflow-run level) so there's one vocabulary,
// not two independently-maintained lists.
const FAIL = new Set(['failure', 'cancelled', 'timed_out', 'startup_failure']);

// `status` values (REST Checks/Jobs APIs) that mean 'stalled on an external
// actor, not progressing on its own' -- distinct from ordinary in-flight
// states ('queued', 'in_progress') which resolve without anyone doing
// anything. Added 2026-09-19 after the falcor-build-approval-gate WAITING
// blind spot (a job requiring manual environment-review approval has
// status:'waiting', conclusion:null forever until someone approves it --
// conclusion:null never satisfies FAIL, so it silently vanished from every
// FAIL-gated category below instead of being reported). Narrow by design:
// folding 'queued'/'in_progress' in here too would flag whatever happens to
// be running on every sweep, which is noise, not a signal -- confirmed via
// prior CI-mechanics learning that 'queued' drains with time while 'waiting'
// does not, so only the latter (plus 'requested'/'pending', the same
// environment-protection family) belongs in this set.
const BLOCKED_STATUS = new Set(['waiting', 'requested', 'pending']);

// Job names whose CANCELLED conclusion means 'the manual-approval wait timed
// out', not 'this run was superseded/cancelled' -- the other CANCELLED case
// FAIL already covers correctly (e.g. a `review` job dropped by
// cancel-in-progress on a new push). A falcor-build-approval-gate that sits
// in status:'waiting' past its environment-protection timeout transitions to
// status:'completed'/conclusion:'cancelled' -- a real, current, still-blocking
// state (mergeStateStatus stays BLOCKED) that used to satisfy FAIL.has('cancelled')
// and land in actionableFailingChecks alongside genuine code-regression
// failures, indistinguishable from one without checking the name. Rerunning
// only reopens the identical wait, so this belongs in blockedChecks with the
// same semantics as WAITING, not in the rerun-or-investigate bucket. Found
// live 2026-09-30 on #12716/#13270 -- see
// memory/ci-babysitter/falcor-gate-cancelled-blind-spot-2026-09-30.md. Scoped
// by name (not by 'any CANCELLED gate-shaped check') because that is the only
// job currently known to use GitHub's environment-protection-timeout
// mechanism; add a name here if another gate adopts the same mechanism,
// rather than widening the match to all CANCELLED conclusions.
const GATE_JOB_NAMES = new Set(['falcor-build-approval-gate']);

const EXCLUSIONS_PATH = '/workspace/agent/memory/ci-babysitter/tracked-regressions.json';
const BASE_SKEW_PATH = '/workspace/agent/memory/ci-babysitter/base-skew-signatures.json';
const SELF_PATH = '/workspace/agent/memory/ci-babysitter/sweep-script-v2.mjs';
// Where the gate remembers what it reported on the previous fire, so decideWake
// can tell a change (new head, new blocked gate, new eviction) from steady
// state. Lives beside the two ledgers above because it is the same kind of
// per-group babysitter memory; see loadPreviousState/saveState for the shape.
const STATE_PATH = '/workspace/agent/memory/ci-babysitter/sweep-gate-state.json';

// Baked in by stamp-hash.mjs at deploy time -- see checkDeploymentDrift() below.
// Placeholder value here means 'never stamped'; stamp-hash.mjs overwrites this
// exact line, so its regex (HASH_LINE_RE) must keep matching this declaration
// verbatim (same quote style, no trailing comment on the line).
const DEPLOYED_SOURCE_HASH = 'fde5508f48d0860c9962e361ce264beb463ea64ba3f469630034d699e26d7c28';

// A deploy is a separate manual step (ncl tasks update --script) from editing
// this file, and a skipped deploy fails silently: the live task keeps running
// old logic with no error, no red check, nothing -- it happened twice (see
// base-skew-deployment-2026-09-16.md, base-skew-deployment-2026-09-19.md)
// before this check existed. computeSourceHash mirrors what stamp-hash.mjs
// does at generation time: hash everything except the DEPLOYED_SOURCE_HASH
// line itself (excluding that line sidesteps the hash depending on its own
// value). checkDeploymentDrift then re-reads the file this same process is
// running from off disk and compares hashes: if a later edit landed on disk
// without a redeploy, the two differ and drift is loud in the wake payload
// instead of silent.
const HASH_LINE_RE = /(const DEPLOYED_SOURCE_HASH = ')[^']*(';)/m;
const computeSourceHash = (src) =>
  crypto.createHash('sha256').update(src.replace(HASH_LINE_RE, '$1$2')).digest('hex');
const checkDeploymentDrift = () => {
  if (!DEPLOYED_SOURCE_HASH) return { status: 'unknown', reason: 'never stamped (ran from unstamped source)' };
  try {
    const onDiskHash = computeSourceHash(fs.readFileSync(SELF_PATH, 'utf8'));
    if (onDiskHash === DEPLOYED_SOURCE_HASH) return { status: 'ok' };
    return { status: 'drift', deployedHash: DEPLOYED_SOURCE_HASH, onDiskHash };
  } catch (e) {
    return { status: 'unknown', reason: e.message };
  }
};

// Load the do-not-rerun list and self-heal it: any 'open' entry whose tracked
// issue GitHub now reports closed is flipped to 'closed' (never deleted, for
// audit) so removal needs no agent action -- closing the issue is enough.
// Fails open on any read/parse/API error: an exclusion-file problem must
// degrade to 'no exclusions applied' (classification falls back to the
// agent's own judgement), never to a sweep crash.
// baseSkewEntries is passed in (not loaded here) purely so self-heal can check
// whether a forward-guard already exists for a job that's about to lose its
// tracked-regression exclusion -- see needsBaseSkewGuard below.
const loadAndRefreshExclusions = async (baseSkewEntries) => {
  let doc;
  let loadError = null;
  try {
    doc = JSON.parse(fs.readFileSync(EXCLUSIONS_PATH, 'utf8'));
  } catch (e) {
    return { openEntries: [], loadError: e.message, needsBaseSkewGuardCount: 0 };
  }
  let changed = false;
  for (const entry of doc.entries || []) {
    if (entry.status === 'open') {
      try {
        const issue = await api('/issues/' + entry.issue);
        if (issue.state === 'closed') {
          entry.status = 'closed';
          entry.closedDetectedAt = new Date().toISOString();
          changed = true;
        }
      } catch (e) {
        // fail-open per entry: leave it 'open' and keep excluding until we can confirm
      }
    }
    // Stamp every closed entry (freshly closed above, or closed on a prior
    // sweep before this stamp existed -- backfilled here) with whether a
    // base-skew forward-guard already covers its job. Fix 3, 2026-09-18:
    // #13041 self-healed to 'closed' on #13042 merging with no forward-guard
    // left for PRs still behind that fix (#13086 hit exactly that gap) --
    // this stamp is the permanent tripwire so a future self-heal can't repeat
    // it silently. Never auto-creates the base-skew entry (that needs a real
    // landing commit + a vetted logGrep excerpt, not a guess) -- it only
    // flags that one is owed.
    if (entry.status === 'closed') {
      const hasGuard = (baseSkewEntries || []).some((b) => b.context === entry.job);
      if (entry.needsBaseSkewGuard !== !hasGuard) {
        entry.needsBaseSkewGuard = !hasGuard;
        changed = true;
      }
    }
  }
  if (changed) {
    try {
      fs.writeFileSync(EXCLUSIONS_PATH, JSON.stringify(doc, null, 2) + '\n');
    } catch (e) {
      loadError = 'refresh write failed: ' + e.message;
    }
  }
  const openEntries = (doc.entries || []).filter((e) => e.status === 'open');
  const needsBaseSkewGuardCount = (doc.entries || []).filter((e) => e.needsBaseSkewGuard).length;
  return { openEntries, loadError, needsBaseSkewGuardCount };
};

// Registry for the base-skew detector (Fix 1, 2026-09-15): PRs whose head
// predates an upstream commit that a check now hard-requires (e.g. slangpy
// main needing slang's `enum MatrixLayoutMode`, added by #12986). Unlike
// tracked-regressions.json this has no single GitHub issue to self-heal
// against -- divergence is per-PR history, not one global bug -- so entries
// are just loaded as-is. Fails open to [] on any read/parse error.
const loadBaseSkewSignatures = () => {
  try {
    const doc = JSON.parse(fs.readFileSync(BASE_SKEW_PATH, 'utf8'));
    return doc.entries || [];
  } catch (e) {
    return [];
  }
};

// Ancestor check against the PR's CURRENT live head -- never baseRefOid,
// which is the target branch's tip at query time, not this PR's fork point
// (that exact substitution produced a false 'ahead_by:24' verdict for #13078
// on 2026-09-15). status:'diverged'/'behind' => landingCommit is genuinely
// missing from this head. status:'ahead'/'identical' => the fix is already
// present; caller must fail open rather than auto-clear, since a still-red
// check in this state means CI simply hasn't re-run against a newer push yet
// (see #12542, same date: its failing run had tested a superseded commit).
const checkBaseSkewAncestor = async (headSha, landingCommit) => {
  const cmp = await api('/compare/' + landingCommit + '...' + headSha);
  return cmp.status === 'diverged' || cmp.status === 'behind';
};

// Resolve each failing check that isn't already tracked-regression-excluded
// against the base-skew registry. One compare() call per matching name
// (bounded by how many checks a PR fails, not by PR volume). `actionableChecks`
// items may be a plain name string (legacy shape, and what the full-scan tail
// passes since GraphQL doesn't carry a job id or target_url at all) or a
// {name, id, target_url} object (what splitExclusions produces for the
// floor/remainder/evicted paths: id when the check is a same-repo job with
// logs to fetch, target_url when it's a legacy cross-repo status like
// 'SlangPy Tests' whose id is always null -- see
// verifyExclusionSignatureCrossRepo).
//
// Fix 3, 2026-09-18: a diverged/behind ancestry match is no longer sufficient
// on its own -- it's also run through resolveExclusionVerdict against the
// entry's own `logGrep` (optional; entries without one keep the pre-Fix-3
// name+ancestry-only behavior, since resolveExclusionVerdict passes
// unverified when logGrepTerms is empty). This exists because a base-skew
// `context` can name a broad, multi-purpose job (e.g. a full `test-slang`
// job) rather than a single-purpose status -- without a content check, ANY
// failure of that job on a pre-landingCommit PR would silently classify as
// needs-rebase, including a real regression in that PR's own diff that
// happens to share the job name.
//
// An entry WITH logGrep declared, matched via the bare-name tail shape,
// has no id/target_url to check content against by construction -- under
// resolveExclusionVerdict's contract that is skipped:true, not verified:true,
// so (since 2026-09-26) the tail no longer silently trusts a logGrep-bearing
// entry on name+ancestry alone the way it did before; it falls through to
// remainingActionable exactly like a floor-path content mismatch would.
const classifyBaseSkew = async (actionableChecks, headSha, baseSkewEntries) => {
  const baseSkewChecks = [];
  const remainingActionable = [];
  const verificationSkipped = [];
  for (const check of actionableChecks) {
    const name = typeof check === 'string' ? check : check.name;
    const entry = baseSkewEntries.find((e) => e.context === name);
    if (!entry) { remainingActionable.push(check); continue; }
    try {
      const skewed = await checkBaseSkewAncestor(headSha, entry.landingCommit);
      if (!skewed) {
        // ahead/identical: landingCommit is present, so ordinarily any red
        // status here is stale/superseded CI -- fail open. FALSIFIED for any
        // entry flagged fixIncomplete (parent correction 2026-09-30, msg
        // 6768: 3 confirmed post-fix hits on the build-windows-debug-cl-
        // aarch64/build entry, all status=ahead yet logGrep-matched verbatim
        // -- #13042 landed but didn't fully fix #13041). For those entries,
        // still verify the logGrep before trusting either classification: a
        // verified match is the known incomplete-fix recurrence (keyed to
        // the tracked issue, never counted as new); an unmatched log is a
        // real, different, actionable failure on this ahead-of-fix head.
        if (entry.fixIncomplete) {
          const { verified, skipped } = await resolveExclusionVerdict(typeof check === 'string' ? null : check, entry.logGrep);
          if (verified) {
            baseSkewChecks.push({ name, landingPr: entry.landingPr, verdict: 'fix-incomplete', issue: entry.issue || null });
            continue;
          }
          if (skipped) verificationSkipped.push({ name, landingPr: entry.landingPr });
        }
        remainingActionable.push(check);
        continue;
      }
      const { verified, skipped } = await resolveExclusionVerdict(typeof check === 'string' ? null : check, entry.logGrep);
      if (verified) {
        baseSkewChecks.push({ name, landingPr: entry.landingPr, verdict: 'needs-rebase' });
      } else {
        remainingActionable.push(check); // log content didn't match, or (skipped) couldn't be checked at all -- either way, treat as a real failure
        if (skipped) verificationSkipped.push({ name, landingPr: entry.landingPr });
      }
    } catch (e) {
      remainingActionable.push(check); // fail open on API error too
    }
  }
  return { baseSkewChecks, remainingActionable, verificationSkipped };
};

// Bounded per-job log fetch, gated to checks that already matched a tracked-
// regression entry BY NAME -- cost stays proportional to that list's size
// (2 entries as of 2026-09-15), never to total PR/check volume. Confirms the
// job's actual failure text still contains the entry's registered signature
// before letting the name match suppress it, closing the gap where a
// same-named job fails for an unrelated reason (seen 2026-09-15 on #13102:
// tracked-#13024's job name matched a FileCheck mismatch that had nothing to
// do with the SPVDB `unique_id_` assertion #13024 actually tracks -- harmless
// there only because #13102 had other, differently-named failures keeping it
// in the actionable tail; a PR whose ONLY failure was that same false match
// would have been silently and totally skipped). Range-limited to the last
// 128KB since failure signal is almost always near the end of a CI log and
// full logs can run into the MB range, which this script's time/size budget
// can't absorb per-match. Fails open (trusts the name match) on a fetch
// error or missing registered signature -- never blocks a real exclusion on
// this check being unavailable, since the fallback is exactly today's
// name-only behavior. Deliberately does NOT fail open on a missing jobId --
// that decision belongs solely to resolveExclusionVerdict (this function's
// only caller), which already routes a null id to
// verifyExclusionSignatureCrossRepo or to {verified:false, skipped:true}
// before ever reaching here. (Parent flagged 2026-09-27: the same fail-open
// living inside this function too was a live footgun -- any future direct
// call with a null/undefined jobId would have silently returned
// verified:true instead of failing safe, regardless of what
// resolveExclusionVerdict decided.) Contract now: caller guarantees jobId is
// real before calling.
const verifyExclusionSignature = async (jobId, logGrepTerms) => {
  if (!logGrepTerms || logGrepTerms.length === 0) return true;
  try {
    const r = await fetch('https://api.github.com/repos/' + REPO + '/actions/jobs/' + jobId + '/logs', {
      headers: { ...H, Range: 'bytes=-131072' },
    });
    if (!r.ok && r.status !== 206) return true;
    const text = await r.text();
    return logGrepTerms.every((t) => text.includes(t));
  } catch (e) {
    return true;
  }
};

// Cross-repo counterpart to verifyExclusionSignature, for a base-skew entry
// whose `context` is a legacy commit-status pointing at a run in ANOTHER
// repo (e.g. 'SlangPy Tests' -> shader-slang/slangpy) rather than a check-run
// in this one. fetchCheckRuns always sets id:null for a legacy status (no
// job id in THIS repo's Checks API exists to fetch logs from), so
// verifyExclusionSignature(id, ...) can never run its content check for that
// case -- it just fails open on the null id, which meant adding a `logGrep`
// to the 'SlangPy Tests' entry alone did nothing (discovered 2026-09-26 on
// #11709: a genuine slangpy-runner network flake, unrelated to the
// MatrixLayoutMode base-skew signature, still matched on name+ancestry
// alone). The status DOES carry a resolvable target_url
// (https://github.com/<owner>/<repo>/actions/runs/<runId>), so this resolves
// that URL, fetches the run's FAILED jobs in the other repo, and checks each
// one's last-128KB log tail for the same logGrep terms -- verified (all
// terms present) if ANY failed job's log matches, since a cross-repo run can
// span multiple platform jobs and the registered failure mode may only
// reproduce on one of them. Same fail-open contract as verifyExclusionSignature:
// no target_url, no logGrepTerms, an unparseable URL, an API error, or zero
// failed jobs to check all return true (trust the name+ancestry match) --
// this function only ever turns a match INTO a non-match on a genuinely
// fetched, genuinely non-matching log, never the reverse.
const RUN_URL_RE = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)/;
const verifyExclusionSignatureCrossRepo = async (targetUrl, logGrepTerms) => {
  if (!targetUrl || !logGrepTerms || logGrepTerms.length === 0) return true;
  const m = RUN_URL_RE.exec(targetUrl);
  if (!m) return true;
  const [, owner, repo, runId] = m;
  try {
    const jobsRes = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/actions/runs/' + runId + '/jobs?per_page=100', { headers: H });
    if (!jobsRes.ok) return true;
    const jobsDoc = await jobsRes.json();
    const failedJobs = (jobsDoc.jobs || []).filter((j) => j.conclusion === 'failure');
    if (failedJobs.length === 0) return true;
    for (const j of failedJobs) {
      const r = await fetch('https://api.github.com/repos/' + owner + '/' + repo + '/actions/jobs/' + j.id + '/logs', {
        headers: { ...H, Range: 'bytes=-131072' },
      });
      if (!r.ok && r.status !== 206) continue;
      const text = await r.text();
      if (logGrepTerms.every((t) => text.includes(t))) return true;
    }
    return false;
  } catch (e) {
    return true;
  }
};

// Single entry point both splitExclusions (tracked-regressions.json) and
// classifyBaseSkew (base-skew-signatures.json) call to verify a logGrep
// signature -- replaces calling verifyExclusionSignature/
// verifyExclusionSignatureCrossRepo directly so the two call sites can't
// diverge on how they treat a check with no fetchable log. Before this
// existed, verifyExclusionSignature's own `!jobId` guard silently returned
// verified:true (trust the name match) for ANY check with no same-repo job
// id -- exactly the state a legacy cross-repo commit-status is ALWAYS in.
// That is what let 'SlangPy Tests' keep matching on name+ancestry alone even
// after a logGrep was added to its entry (discovered 2026-09-26 on #11709).
// Adding the target_url cross-repo path fixed that one entry, but the actual
// contract bug was the id-only short-circuit itself, which would have
// silently reopened the identical gap for the next commit-status-backed
// entry anyone adds, in either registry. The contract now:
//   - entry declares no logGrep at all -> {verified:true, skipped:false}.
//     Unchanged pre-Fix-3 name+ancestry-only behavior; this function only
//     tightens entries that opted into content verification.
//   - same-repo id present -> verifyExclusionSignature (direct log fetch).
//   - no id, but a target_url this function can parse into a repo/run ->
//     verifyExclusionSignatureCrossRepo.
//   - logGrep WAS declared but neither a usable id nor a resolvable
//     target_url exists (includes the full-scan tail's bare-name shape,
//     which structurally never carries either) -> {verified:false,
//     skipped:true}. The entry asked for content verification and nothing
//     here can perform it; that is could-not-verify, not trust-the-match --
//     the opposite of every fail-open branch inside the two fetch
//     helpers, which only fire once a log fetch was genuinely attempted (the
//     #12583 rule: fail open on a fetch that happened and degraded, never on
//     one that never had anywhere to point).
const resolveExclusionVerdict = async (check, logGrepTerms) => {
  if (!logGrepTerms || logGrepTerms.length === 0) return { verified: true, skipped: false };
  const id = check && check.id;
  const targetUrl = check && check.target_url;
  if (id) return { verified: await verifyExclusionSignature(id, logGrepTerms), skipped: false };
  if (targetUrl && RUN_URL_RE.test(targetUrl)) {
    return { verified: await verifyExclusionSignatureCrossRepo(targetUrl, logGrepTerms), skipped: false };
  }
  return { verified: false, skipped: true };
};

// All check-runs for a commit, as {name, conclusion, completed_at, id}.
// Superset of what latestCheckRunCompletion used to compute inline --
// callers that only need the latest completion timestamp derive it via
// maxCompletedAt. Also unions in legacy commit statuses (via the combined-
// status endpoint, already deduped to one entry per context) -- e.g.
// 'SlangPy Tests' is a cross-repo status, not a Checks-API check-run, and
// was previously invisible to this function entirely (discovered 2026-09-15
// while tracing why base-skew classification needed a signal this function
// didn't carry). Status entries get id:null since they have no job to fetch
// logs for (verifyExclusionSignature/classifyBaseSkew treat that as
// 'can't verify further, trust the name match' for exclusions, and base-skew
// matching only needs the name). Fails open on the statuses call: a fetch
// error there must not drop native check-run coverage.
const fetchCheckRuns = async (sha) => {
  const out = [];
  for (let page = 1; page <= 3; page++) {
    const raw = await api('/commits/' + sha + '/check-runs?per_page=100&page=' + page);
    for (const cr of raw.check_runs) {
      out.push({ name: cr.name, status: cr.status, conclusion: cr.conclusion, completed_at: cr.completed_at, id: cr.id, check_suite_id: cr.check_suite ? cr.check_suite.id : null });
    }
    if (raw.check_runs.length < 100) break;
  }
  try {
    const combined = await api('/commits/' + sha + '/status');
    for (const s of combined.statuses || []) {
      out.push({
        name: s.context,
        // The legacy Statuses API has no separate status/conclusion split --
        // only 'state' (error/failure/pending/success). Synthesize 'status'
        // from it for schema consistency with check-runs (see
        // BLOCKED_STATUS): a 'pending' external status (e.g. a cross-repo
        // check whose webhook hasn't reported yet) is not the same kind of
        // stall as an approval gate, but folding it into 'blocked' only adds
        // a visibility line -- it never suppresses or misclassifies a real
        // failure, so the imprecision is accepted rather than worth a second
        // vocabulary.
        status: s.state === 'pending' ? 'pending' : 'completed',
        conclusion: s.state === 'success' ? 'success' : s.state === 'pending' ? null : 'failure',
        completed_at: s.updated_at,
        id: null,
        check_suite_id: null,
        // A legacy status has no job id in THIS repo's Checks API (id stays
        // null above), but a cross-repo status like 'SlangPy Tests' points at
        // its real run via target_url (e.g.
        // https://github.com/shader-slang/slangpy/actions/runs/<runId>).
        // Carried through so classifyBaseSkew/verifyExclusionSignatureCrossRepo
        // can resolve and log-verify it -- see their comments for why id alone
        // (always null here) can never drive that check.
        target_url: s.target_url || null,
      });
    }
  } catch (e) {
    // fail-open: statuses are a supplement, not the primary source
  }
  return out;
};

// Advisory payload field for gate 0j: is there a `check-ci` run on this head,
// and what did it conclude? check-ci is the CI workflow's aggregate job (it
// lists every build/test job in its `needs`), so conclusion SUCCESS is the
// positive evidence `resolved` needs -- an empty failure set is vacuously true
// when no CI ever ran (#13453, 2026-10-11: 3 contexts, no check-ci, 15 false
// 'resolved' rows). {present:false} means ABSENT, which is a different fact
// from a failed probe (callers pass null for that). This field is a hint only;
// the enforcing check is sweeplib.touch_tracker_verdict's live probe, which
// refuses 'resolved' unless check-ci is SUCCESS on the exact head sha.
const checkCiFromRuns = (checkRuns, suiteEventById = new Map()) => {
  const cands = (checkRuns || []).filter((cr) => cr.name === 'check-ci' && cr.id != null);
  if (cands.length === 0) return { present: false, conclusion: null };
  const best = pickLatestAttempt(cands, suiteEventById);
  return { present: true, conclusion: best.status === 'completed' ? best.conclusion : best.status };
};

const maxCompletedAt = (checkRuns) => {
  let maxTs = null;
  for (const cr of checkRuns) {
    if (cr.completed_at && (!maxTs || cr.completed_at > maxTs)) maxTs = cr.completed_at;
  }
  return maxTs;
};

// Jobs for a single workflow run (used for merge-group runs behind an
// eviction) as {name, status, conclusion, id} -- same shape as fetchCheckRuns
// so both feed the same splitExclusions helper.
const fetchRunJobs = async (runId) => {
  const raw = await api('/actions/runs/' + runId + '/jobs?per_page=100');
  return (raw.jobs || []).map((j) => ({ name: j.name, status: j.status, conclusion: j.conclusion, id: j.id }));
};

// A fork-PR's pull_request-triggered workflows held for maintainer approval
// (conclusion:'action_required') never create a check-run/job object -- they
// stall one layer above the Checks API, at the workflow-run level -- so
// splitExclusions's own conclusion==='action_required' branch below (added
// 2026-09-22 for #12544) can never see it, and neither can fetchNonGreenRollups'
// GraphQL contexts (same underlying Checks-API-backed store). Confirmed live
// 2026-09-22 on #13218: /commits/{sha}/check-runs +/status and GraphQL
// statusCheckRollup.contexts both returned the identical 8 success/skipped
// rows (zero action_required), and statusCheckRollup.state itself read
// SUCCESS -- the wedge doesn't even make the rollup non-green. The only
// surface that shows it is the Actions runs API. Filtered to
// event:'pull_request' because sibling runs on the same sha triggered by
// pull_request_review/pull_request_review_comment/pull_request_target can
// also read action_required without gating the PR's own required checks --
// verified live: two runs named 'PR Maintenance' on #13218's sha, one
// pull_request_review/action_required, one pull_request_target/success.
// Deduped by name+highest id within that filtered set (not via
// dedupeByLatestAttempt on the raw list) because that same-name-different-
// event collision would otherwise let the wrong one win depending on id
// order alone.
// Raw workflow-run list for a commit sha -- the shared fetch behind both
// actionRequiredBlocksFromRuns (below) and checkSuiteEventMap (see
// dedupeByLatestAttempt), so callers that need both derive them from one
// API call instead of two.
const fetchRunsForSha = async (headSha) => {
  const raw = await api('/actions/runs?head_sha=' + headSha + '&per_page=100');
  return raw.workflow_runs || [];
};

// REST equivalent of GraphQL's PullRequest.mergeStateStatus (CLEAN/BLOCKED/
// BEHIND/DIRTY/DRAFT/HAS_HOOKS/UNKNOWN/UNSTABLE) -- the list endpoint used to
// fetch `prs` above never includes this (GitHub computes it asynchronously
// and only exposes it on the single-PR endpoint), so it needs its own
// per-number call. Added 2026-09-30 so a 'resolved' verdict has POSITIVE
// evidence behind it instead of being inferred from blockedChecks/
// actionableFailingChecks happening to be empty -- the same 'empty bucket
// read as clean' mistake that produced a false resolved for both the
// action_required case (no check-run object exists at all) and the
// falcor-build-approval-gate CANCELLED-timeout case (see GATE_JOB_NAMES):
// any future blind spot this script doesn't yet have a bucket for will still
// show up here, because mergeStateStatus is GitHub's own rollup of every
// required check plus review/merge-queue state, not something this script
// derives. Uppercased to match the GraphQL enum's casing (REST returns it
// lowercase) so a payload consumer sees one vocabulary regardless of which
// path produced the entry. Fails open to 'UNKNOWN' (never throws into the
// per-PR Promise.all) so an API hiccup degrades to 'no positive evidence
// either way' rather than losing check-run coverage for the PR too --
// 'UNKNOWN' must never be treated as clean by a consumer of this field.
const fetchMergeStateStatus = async (number) => {
  const full = await api('/pulls/' + number);
  return (full.mergeable_state || 'unknown').toUpperCase();
};

// A workflow name can have more than one pull_request-triggered run on the
// SAME sha -- e.g. re-triggered by repeated label add/remove -- and one of
// them can be sitting in action_required (a fork-PR approval stall that
// never creates a check-run, see this function's own comment above) while a
// DIFFERENT run of that exact name already ran to a real completed
// conclusion. When that happens, GitHub's own Checks-API rollup (what
// gh pr checks / statusCheckRollup show) reflects only the completed run's
// check-run -- the action_required run produced zero check-run objects
// (confirmed live 2026-09-24 on PR #13178's 'Verify PR Labels' run
// 35897697276: check_suite 97205531551, latest_check_runs_count:0 via
// GET /check-suites/{id} -- even though the run itself is real, current, and
// still reads action_required right now, not expired/404) so it cannot
// actually gate anything and reporting it as blocked is a phantom entry.
// Distinguish this from the original #12544/#13218 motivating case (a
// workflow name with NO resolved run at all on this sha, still genuinely
// wedged) by tracking which names have at least one pull_request run that
// reached a real conclusion, and skipping the action_required entry for any
// name in that set.
const actionRequiredBlocksFromRuns = (runs) => {
  const resolvedNames = new Set();
  for (const r of runs) {
    if (r.event === 'pull_request' && r.status === 'completed' && r.conclusion !== 'action_required') {
      resolvedNames.add(r.name);
    }
  }
  const byName = new Map();
  for (const r of runs) {
    if (r.event !== 'pull_request' || r.conclusion !== 'action_required') continue;
    if (resolvedNames.has(r.name)) continue;
    const prior = byName.get(r.name);
    if (!prior || r.id > prior.id) byName.set(r.name, r);
  }
  return [...byName.values()].map((r) => ({ name: r.name, status: 'action_required', id: r.id }));
};

// check_suite_id -> triggering event, for every workflow run on a commit
// (unlike actionRequiredBlocksFromRuns, not filtered by event/conclusion) --
// lets dedupeByLatestAttempt distinguish a genuine same-run rerun (one
// check_suite, safe to resolve by highest id) from a same-name collision
// across sibling runs triggered by different events on the same sha. See
// dedupeByLatestAttempt's own comment for the motivating #12563 case.
const checkSuiteEventMap = (runs) => {
  const m = new Map();
  for (const r of runs) {
    if (r.check_suite_id != null) m.set(r.check_suite_id, r.event);
  }
  return m;
};

// Collapse REST check-run/job history to one entry per name before any
// classification. A rerun (of a check-run or a workflow job) creates a NEW
// entry with a new, larger id and the same name -- REST returns the full
// attempt history, not latest-only. Without this collapse, a superseded
// failure stays visible to the FAIL-based branches in splitExclusions below
// even after a later attempt on the same name supersedes it. Entries with
// id == null (legacy commit-status contexts, which have no rerun concept
// and whose combined-status endpoint already returns only the latest state
// per context) pass through unconditionally rather than being keyed on a
// shared null.
//
// Within one name, ids are monotonically increasing SO LONG AS all
// candidates share one check_suite (a true rerun sequence) -- but when a
// name's candidates come from DIFFERENT check_suites, id order reflects
// coincidental wall-clock timing between unrelated runs, not supersession.
// Confirmed live on PR #12563's commit (2026-09-23): a 'workflow_dispatch'
// sibling run on the same sha as the real 'pull_request' CI run named a job
// 'wait-for-human-priority' (and 'check-ci') identically to the pull_request
// run's own job of the same name. The workflow_dispatch job's id happened to
// land HIGHER for 'wait-for-human-priority' (picking its FAILURE over the
// pull_request run's SUCCESS) while for 'check-ci' the pull_request job's id
// happened to land higher (masking the same bug by accident) -- GitHub's own
// statusCheckRollup correctly resolves both names to the pull_request run
// regardless of id, proving id-order-across-suites is not a valid
// supersession signal. suiteEventById (from checkSuiteEventMap) breaks the
// tie: only when a name's candidates span more than one check_suite do we
// prefer the pull_request-suite candidate; a name with candidates from only
// one suite (a genuine rerun, or a check that only ever runs under
// pull_request_target/pull_request_review with no pull_request entry at
// all) is untouched and keeps the plain highest-id resolution.
const dedupeByLatestAttempt = (items, suiteEventById = new Map()) => {
  const byName = new Map();
  const noId = [];
  for (const item of items) {
    if (item.id == null) { noId.push(item); continue; }
    if (!byName.has(item.name)) byName.set(item.name, []);
    byName.get(item.name).push(item);
  }
  const out = [];
  for (const candidates of byName.values()) out.push(pickLatestAttempt(candidates, suiteEventById));
  return [...out, ...noId];
};

const pickLatestAttempt = (candidates, suiteEventById) => {
  let pool = candidates;
  if (candidates.length > 1) {
    const suiteIds = new Set(candidates.map((c) => c.check_suite_id).filter((id) => id != null));
    if (suiteIds.size > 1) {
      const prCandidates = candidates.filter((c) => suiteEventById.get(c.check_suite_id) === 'pull_request');
      if (prCandidates.length > 0) pool = prCandidates;
    }
  }
  return pool.reduce((best, c) => (c.id > best.id ? c : best));
};

// Split a set of check-runs/jobs into ones matching an open tracked-regression
// entry (by job name, then content-verified -- see verifyExclusionSignature)
// vs everything else that's still red. Never silently drops a failing entry:
// a name match whose log doesn't contain the registered signature is pushed
// back into actionableFailingChecks (and listed in signatureMismatches)
// rather than excluded, so a same-named-but-different failure is never
// rendered invisible by this filter.
//
// Blocked (status in BLOCKED_STATUS, e.g. the falcor-build-approval-gate
// WAITING on manual review) is a third bucket, not folded into 'actionable'
// or dropped: conclusion is null on a blocked entry, so it would otherwise
// satisfy neither FAIL nor 'not FAIL' in any useful sense -- it just vanished
// from every category before this change (see BLOCKED_STATUS's own comment).
// dedupeByLatestAttempt above guarantees at most one entry per name already,
// so the blocked branch needs no dedup of its own here.
//
// conclusion:'action_required' (added 2026-09-22, PR #12544) is the OTHER way
// a check-run stalls on a manual actor: unlike the falcor gate it reaches
// status:'completed' with a real conclusion, so it satisfies neither
// BLOCKED_STATUS (a status set) nor FAIL (action_required isn't a failure).
// This branch only catches a check-run that itself carries that conclusion
// (a legitimate Checks-API value some third-party checks set directly) --
// it does NOT catch a fork-PR's pull_request workflow held for maintainer
// approval, despite that being the #12544 motivating case: that mechanism
// stalls one layer above the Checks API and never creates a check-run object
// at all, so this branch is structurally inert for it (confirmed live
// 2026-09-22 on #13218 -- zero action_required rows here despite 5 real
// pull_request-triggered runs sitting action_required). See
// actionRequiredBlocksFromRuns above for the fix that actually covers that
// case, wired in at the splitExclusions call sites below via the floor's
// pre-fetched map. Checked via conclusion, not status, because that's the
// field GitHub actually sets.
const splitExclusions = async (checkRuns, excludedJobNames, issueForJob, signatureForJob, suiteEventById = new Map()) => {
  const excludedChecks = [];
  const actionableFailingChecks = [];
  const signatureMismatches = [];
  const blockedChecks = [];
  for (const cr of dedupeByLatestAttempt(checkRuns, suiteEventById)) {
    if (BLOCKED_STATUS.has(cr.status) || cr.conclusion === 'action_required') {
      blockedChecks.push({ name: cr.name, status: cr.conclusion === 'action_required' ? 'action_required' : cr.status, id: cr.id });
      continue;
    }
    // See GATE_JOB_NAMES's comment: a gate that timed out from WAITING into a
    // terminal CANCELLED conclusion is still blocked, not a failure to
    // investigate -- must be checked before the generic FAIL branch below,
    // which would otherwise claim it via FAIL.has('cancelled').
    if (GATE_JOB_NAMES.has(cr.name) && cr.conclusion === 'cancelled') {
      blockedChecks.push({ name: cr.name, status: 'gate_timeout', id: cr.id });
      continue;
    }
    if (!FAIL.has(cr.conclusion)) continue;
    if (excludedJobNames.has(cr.name)) {
      const { verified, skipped } = await resolveExclusionVerdict(cr, signatureForJob.get(cr.name));
      if (verified) {
        excludedChecks.push({ name: cr.name, issue: issueForJob.get(cr.name) });
      } else {
        // {name, id, target_url} (not a bare name) so classifyBaseSkew can run
        // its own logGrep verification (Fix 3) against this same job's log --
        // target_url is the cross-repo fallback verifyExclusionSignatureCrossRepo
        // needs when id is null (legacy status, e.g. 'SlangPy Tests').
        actionableFailingChecks.push({ name: cr.name, id: cr.id, target_url: cr.target_url });
        // skipped:true means this entry declared logGrep but had neither a
        // job id nor a resolvable target_url to check it against (see
        // resolveExclusionVerdict) -- distinct from a genuine content
        // mismatch, surfaced so a run of unverifiable-but-excludable entries
        // doesn't look identical to real signature mismatches in the report.
        signatureMismatches.push({ name: cr.name, issue: issueForJob.get(cr.name), skipped });
      }
    } else {
      actionableFailingChecks.push({ name: cr.name, id: cr.id, target_url: cr.target_url });
    }
  }
  return { excludedChecks, actionableFailingChecks, signatureMismatches, blockedChecks };
};

// GraphQL-side equivalent of FAIL, applied to the uppercase enum values
// StatusCheckRollupContext returns (CheckConclusionState / StatusState) --
// kept separate from FAIL (lowercase REST conclusions) rather than
// normalizing case, so each vocabulary stays traceable to the API that
// actually produces it.
const GRAPHQL_FAIL = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'STARTUP_FAILURE', 'ERROR']);

// GraphQL-side equivalent of BLOCKED_STATUS, same case-separation rationale.
// CheckRun.status is CheckStatusState (QUEUED/IN_PROGRESS/COMPLETED/WAITING/
// REQUESTED/PENDING); StatusContext has no separate status field, only
// state:PENDING, which is why fetchNonGreenRollups treats a bare
// StatusContext PENDING as blocked directly rather than looking it up here.
const GRAPHQL_BLOCKED = new Set(['WAITING', 'REQUESTED', 'PENDING']);

// All open non-draft PRs whose latest commit's statusCheckRollup is not a
// clean SUCCESS -- a handful of GraphQL calls instead of a per-PR REST
// check-runs call, so a full-scan fire stays cheap even though it covers
// every open PR rather than just the top-N freshness floor. Also pulls each
// failing context's name/conclusion and the commit oid inline (no extra
// round-trip) so classifyBaseSkew can run against the full tail, not just
// the floor -- added 2026-09-15 after #12848/#12992/#13078 (this sweep's
// actual base-skew case) landed outside the floor and so never got
// classified: exclusionFieldsForFloor only has data for PRs whose check-runs
// were fetched via the floor's per-PR REST call, and this GraphQL-only tail
// deliberately skips that REST call for budget reasons (see the comment at
// its call site). Base-skew classification alone stays cheap enough to run
// on the whole tail because classifyBaseSkew only spends an API call on
// names that match the (currently 1-entry) base-skew registry; it does NOT
// extend Fix 2's log-verified exclusion coverage to the tail, which would
// need a real per-job log fetch and was intentionally left floor-only.
// Page/contexts sizing (first:20, contexts last:15) is deliberately smaller
// than GraphQL's max (100/100): measured live 2026-09-15 that first:100 with
// contexts(last:100) -- a connection nested inside a connection, multiplying
// GitHub's query-cost estimate -- reliably 504s ('GitHub GraphQL 504 Gateway
// Timeout'); first:50/last:15 was the smallest bump back to a size that
// still reliably returned then (measured ~29s wall time for a
// 151-PR/90-nonGreen repo snapshot) while still capturing 'SlangPy Tests'
// within the last 15 contexts on every PR tested. Adding `status` to the
// CheckRun fragment (2026-09-19) is a cheap scalar, not a new connection, so
// it does not reproduce that 504 -- but the last:15 WINDOW ITSELF is still a
// real precision limit for the blocked case specifically: measured live on
// #12563's 105-check-run commit that both falcor-build-approval-gate entries
// (created early, ~85 check-runs before the window's tail) fall outside
// contexts(last:15) even with `status` present, while the top-level
// `rollup` (`state`) still correctly read PENDING. rollupUnexplained is the
// mitigation for exactly that residual gap (see below).
// 2026-09-30: first:50 has since degraded further as the open-PR count grew
// (151 -> 354 open PRs since 2026-09-15) -- live-measured today, first:50
// now reliably 502/504s in ~11s (3/3), not just approaches 30s. Reduced to
// first:20, which reliably returns 200 in ~2-7s/page. But this only fixes
// the per-page failure mode: fetchNonGreenRollups pages through ALL open
// PRs serially (no filtering happens server-side), so at first:20 a full
// scan now needs ceil(354/20)=18 sequential round-trips -- live-measured
// total 70.25s for the full cursor loop alone, still >2x the runner's
// documented 30s --script budget (see ncl tasks help create), before the
// floor-PR fetch and everything else a full-scan fire also does. The
// page-size fix is necessary but NOT sufficient to make a full scan
// complete; see ci-babysitter/full-scan-timeout-2026-09-30.md for the
// budget-extension claim this is contingent on and why it is unverified.
const fetchNonGreenRollups = async () => {
  const out = [];
  let cursor = null;
  for (;;) {
    const data = await graphql(
      'query($owner:String!,$name:String!,$cursor:String){' +
      ' repository(owner:$owner,name:$name){' +
      '  pullRequests(states:OPEN,first:20,after:$cursor,orderBy:{field:UPDATED_AT,direction:DESC}){' +
      '   pageInfo{hasNextPage endCursor}' +
      '   nodes{number title isDraft updatedAt mergeStateStatus commits(last:1){nodes{commit{oid statusCheckRollup{state contexts(last:15){nodes{' +
      '    ...on CheckRun{name status conclusion}' +
      '    ...on StatusContext{context state}' +
      '   }}}}}}}' +
      '  }' +
      ' }' +
      '}',
      { owner: REPO_OWNER, name: REPO_NAME, cursor }
    );
    const page = data.repository.pullRequests;
    for (const n of page.nodes) {
      if (n.isDraft) continue;
      const commit = n.commits.nodes[0]?.commit;
      const rollup = commit?.statusCheckRollup?.state;
      if (rollup && rollup !== 'SUCCESS') {
        const contextNodes = commit?.statusCheckRollup?.contexts?.nodes || [];
        // See GATE_JOB_NAMES's comment (REST side, splitExclusions): a gate
        // that timed out from WAITING into terminal CANCELLED is blocked, not
        // a failure to investigate -- excluded here so it lands only in
        // blockedContextNames below, never double-counted as both.
        const isGateTimeout = (c) => GATE_JOB_NAMES.has(c.name) && c.conclusion === 'CANCELLED';
        const failingContextNames = contextNodes
          .filter((c) => GRAPHQL_FAIL.has(c.conclusion || c.state) && !isGateTimeout(c))
          .map((c) => c.name || c.context);
        // A CheckRun is blocked via its own `status`; a bare StatusContext
        // has no status field, only state:PENDING (see GRAPHQL_BLOCKED's
        // comment), so PENDING state without a conclusion also counts here.
        // conclusion:ACTION_REQUIRED here catches a CheckRun that itself
        // carries that conclusion directly -- it does NOT catch a fork-PR's
        // pull_request workflow held for maintainer approval (the #12544/
        // #13218 fork-approval-gate case): that mechanism never creates a
        // CheckRun object, so it never reaches this `contexts` connection at
        // all (confirmed live 2026-09-22: statusCheckRollup.contexts and REST
        // /commits/{sha}/check-runs returned the identical 8 rows for #13218,
        // zero ACTION_REQUIRED, and statusCheckRollup.state itself read
        // SUCCESS). That case is deliberately NOT fixed here -- this tail
        // path only runs for non-SUCCESS rollups (see the `rollup !==
        // 'SUCCESS'` filter below), which structurally excludes it regardless
        // of instrumentation; see actionRequiredBlocksFromRuns for the
        // floor-only fix and its comment for why extending it to this
        // full-scan tail wouldn't help. This branch is kept for the (different, legitimate)
        // case where a CheckRun does carry ACTION_REQUIRED directly.
        const blockedContextNames = contextNodes
          .filter((c) => GRAPHQL_BLOCKED.has(c.status) || c.conclusion === 'ACTION_REQUIRED' || (c.state === 'PENDING' && c.conclusion === undefined) || isGateTimeout(c))
          .map((c) => c.name || c.context);
        // rollupUnexplained: the tail's own window (contexts(last:15)) found
        // nothing that accounts for a non-SUCCESS rollup on this PR -- either
        // the real cause sits outside the window (the #12563 case) or it's a
        // rollup state this script doesn't have a GraphQL vocabulary entry
        // for. This is the visible 'check this one by hand' breadcrumb Gate
        // 0f (see below) reads and acts on -- it must stay wired to that
        // action, not sit as a decorative field only this comment explains.
        const rollupUnexplained = failingContextNames.length === 0 && blockedContextNames.length === 0;
        out.push({ number: n.number, title: n.title, updatedAt: n.updatedAt, rollup, headSha: commit?.oid, mergeStateStatus: n.mergeStateStatus, failingContextNames, blockedContextNames, rollupUnexplained });
      }
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
};

// Re-verify a rollupUnexplained:true tail entry via REST before trusting it,
// analogous to mergeStateStatus's 'positive evidence' requirement for
// 'resolved' (see fetchMergeStateStatus's comment): fetchNonGreenRollups's
// GraphQL contexts(last:15) window can miss the real explanation (the #12563
// gate case) OR the GraphQL rollup itself can be a stale/miscomputed read on
// an old, rarely-touched commit -- confirmed live 2026-09-30 on #13032 (two
// check-runs both named 'board-sync / board-sync' on an 18-day-stale head,
// one cancelled/one success ~1.5h apart; a fresh GraphQL requery of the SAME
// commit read statusCheckRollup.state:SUCCESS, while the sweep's own
// first:20/contexts(last:15) read had reported it non-SUCCESS with an empty
// contexts window on two separate sweeps, 09-19 and 09-30). The floor path
// already resolves exactly this class of same-name-different-check-suite
// collision via dedupeByLatestAttempt/checkSuiteEventMap (see their
// comments' #12563 case); this reuses those same helpers against REST
// instead of re-deriving GitHub's rollup logic from scratch. Gated to fire
// ONLY when rollupUnexplained is already true (parent instruction
// 2026-09-30: root-cause #13032 the same way as the gate-0j fix, not just
// flag it as 'watch') -- cost stays proportional to the rare mismatch case,
// not to total tail volume, matching classifyBaseSkew's and
// verifyExclusionSignature's existing budget philosophy. Fails open by
// leaving rollupUnexplained untouched (never clears it on an error): an API
// hiccup here must degrade to 'still flagged, needs a human look', not to
// 'silently cleared' -- the same asymmetry fetchMergeStateStatus uses for
// 'resolved'.
const verifyRollupUnexplained = async (headSha) => {
  try {
    const [checkRuns, runs] = await Promise.all([fetchCheckRuns(headSha), fetchRunsForSha(headSha)]);
    const suiteEventById = checkSuiteEventMap(runs);
    const deduped = dedupeByLatestAttempt(checkRuns, suiteEventById);
    const stillBad = deduped.some((cr) => FAIL.has(cr.conclusion) || (cr.status && BLOCKED_STATUS.has(cr.status)));
    return { reverified: true, reverifiedClean: !stillBad };
  } catch (e) {
    return { reverified: false, reverifiedClean: false };
  }
};

// ---------------------------------------------------------------------------
// Wake decision. Everything above gathers facts; this section decides whether
// those facts are worth a model turn. It is pure (no I/O, no clock) so the
// sibling test file can drive it with fixture payloads.
// ---------------------------------------------------------------------------

const STATE_VERSION = 1;

const sortedNames = (list) => (list || []).map((c) => (typeof c === 'string' ? c : c.name)).sort();

// The part of a PR entry that decideWake compares across fires: which checks
// are still red and unexplained, which are stalled on a human, and whether the
// rollup is non-green for a reason this script could not name. Together with
// headSha this is all the state the gate persists per PR.
export const fingerprintPr = (pr) => ({
  headSha: pr.headSha || null,
  failing: sortedNames(pr.actionableFailingChecks),
  blocked: sortedNames(pr.blockedChecks),
  rollupUnexplained: !!pr.rollupUnexplained,
});

// Decide whether the sweep agent has anything to do, given the payload this
// script built (`summary`: driftCheck, prs, evicted) and the state saved on the
// previous fire. Returns the verdict, the reasons (one per PR and cause, so
// the agent knows what to look at), and the state to persist for next time.
//
// The sweep prompt asks the agent, for each PR with failures, to classify the
// failure, rerun intermittent ones and requeue merge-queue evictions. So a PR
// is actionable while it carries a failing check that neither the
// tracked-regression ledger nor the base-skew registry explains -- and it
// stays actionable on every fire until that list is empty, because a failure
// that is still red two hours later is exactly what the agent should look at
// again (the agent's own rerun-tracker bounds how often it actually reruns).
// Blocked checks are different: a gate waiting on a human stays waiting for
// days and the babysitter cannot approve it, so it wakes the agent once, when
// it first appears, not on every fire. The same once-per-event rule applies to
// a merge-queue eviction, keyed by its run id, since the requeue decision is
// made once per eviction. A tracked PR whose head or failure set moved since
// the previous fire wakes the agent even if nothing is red now, so it can
// close out whatever it recorded about that PR. Deployment drift wakes on
// every fire on purpose: a skipped redeploy must stay loud until fixed.
export const decideWake = (summary, previousState) => {
  const prevPrs = (previousState && previousState.prs) || {};
  const prevEvicted = new Set((previousState && previousState.evictedRunIds) || []);
  const wakeReasons = [];
  const nextState = { version: STATE_VERSION, prs: {}, evictedRunIds: [] };

  if (summary.driftCheck && summary.driftCheck.status === 'drift') {
    wakeReasons.push({ number: null, reason: 'deployment-drift' });
  }

  for (const pr of summary.prs || []) {
    const fp = fingerprintPr(pr);
    const prev = prevPrs[String(pr.number)] || null;

    if (fp.failing.length > 0) {
      wakeReasons.push({ number: pr.number, reason: 'failing-unexcluded', checks: fp.failing });
    }
    if (fp.rollupUnexplained) {
      wakeReasons.push({ number: pr.number, reason: 'rollup-unexplained' });
    }
    const newlyBlocked = fp.blocked.filter((name) => !prev || !(prev.blocked || []).includes(name));
    if (newlyBlocked.length > 0) {
      wakeReasons.push({ number: pr.number, reason: 'newly-blocked', checks: newlyBlocked });
    }
    if (prev) {
      if (prev.headSha && fp.headSha && prev.headSha !== fp.headSha) {
        wakeReasons.push({ number: pr.number, reason: 'tracked-head-changed', from: prev.headSha, to: fp.headSha });
      } else if ((prev.failing || []).length > 0 && fp.failing.length === 0) {
        // Same head, failures gone: a rerun passed or is in flight (a
        // superseded failure disappears from the deduped list as soon as the
        // new attempt starts). The agent checks checkCi/mergeStateStatus to
        // tell the two apart.
        wakeReasons.push({ number: pr.number, reason: 'tracked-failures-cleared', checks: prev.failing });
      }
    }

    const tracked = fp.failing.length > 0 || fp.blocked.length > 0 || fp.rollupUnexplained;
    if (tracked) nextState.prs[String(pr.number)] = fp;
  }

  for (const e of summary.evicted || []) {
    if (e.error) {
      wakeReasons.push({ number: null, reason: 'evicted-scan-error', error: e.error });
      continue;
    }
    nextState.evictedRunIds.push(e.mergeGroupRunId);
    if (prevEvicted.has(e.mergeGroupRunId)) continue;
    // An eviction whose jobs could not be fetched (exclusionChecked:false) is
    // treated as actionable: the requeue decision needs a look, and failing
    // open here costs one wake per eviction at most.
    const actionable = e.exclusionChecked === false || (e.actionableFailingChecks || []).length > 0;
    if (actionable) {
      wakeReasons.push({ number: e.number, reason: 'evicted-from-merge-queue', runId: e.mergeGroupRunId, checks: sortedNames(e.actionableFailingChecks) });
    }
  }

  return { wakeAgent: wakeReasons.length > 0, wakeReasons, nextState };
};

// The counts-only payload printed when the gate stays asleep. The host logs
// this line, so it carries enough to see at a glance what the sweep saw
// without reproducing the per-PR detail the agent would need.
export const sleepSummary = (data, nextState) => ({
  totalNonDraft: data.totalNonDraft,
  prCount: data.prCount,
  mode: data.mode,
  prsWithFailures: (data.prs || []).filter((p) =>
    (p.excludedChecks || []).length > 0 || (p.baseSkewChecks || []).length > 0 || (p.actionableFailingChecks || []).length > 0).length,
  prsAllFailuresExcluded: (data.prs || []).filter((p) => p.allFailuresExcluded).length,
  prsWithBlockedChecks: data.exclusions.prsWithBlockedChecks,
  evictedCount: (data.evicted || []).length,
  trackedPrs: Object.keys(nextState.prs).length,
  driftStatus: data.driftCheck ? data.driftCheck.status : 'unknown',
  exclusionsActive: data.exclusions.activeCount,
  exclusionsLoadError: data.exclusions.loadError,
  floorCheckRunErrors: data.floorCheckRunErrors,
  activityErrors: data.activityErrors,
});

// The line printed when the sweep itself failed. Waking here is deliberate:
// a gate that cannot evaluate must hand the problem to the agent, never go
// quiet.
export const errorGate = (driftCheck, error) => ({ wakeAgent: true, data: { driftCheck, error: error.message } });

// Previous-fire state, or null when there is none or it cannot be read. A
// missing or corrupt file degrades to 'everything is new', which only means
// one extra wake, never a missed one.
const loadPreviousState = () => {
  try {
    const doc = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    return doc && doc.version === STATE_VERSION ? doc : null;
  } catch (e) {
    return null;
  }
};

// Write the state through a temp file and rename, so a fire killed mid-write
// (the host enforces a hard timeout) leaves the previous state intact rather
// than a truncated document. Returns an error message instead of throwing
// because a state-write failure must not turn a computed verdict into the
// error path.
const saveState = (state) => {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    const tmp = STATE_PATH + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2) + '\n');
    fs.renameSync(tmp, STATE_PATH);
    return null;
  } catch (e) {
    return e.message;
  }
};

const main = async () => {
  let driftCheck = checkDeploymentDrift();

  try {
    const nowUtcHour = new Date().getUTCHours();
    const isFullScan = FULL_SCAN_HOURS.includes(nowUtcHour);

    const baseSkewEntries = loadBaseSkewSignatures();
    const { openEntries: exclusionEntries, loadError: exclusionsLoadError, needsBaseSkewGuardCount } =
      await loadAndRefreshExclusions(baseSkewEntries);
    const excludedJobNames = new Set(exclusionEntries.map((e) => e.job));
    const issueForJob = new Map(exclusionEntries.map((e) => [e.job, e.issue]));
    const signatureForJob = new Map(exclusionEntries.map((e) => [e.job, e.logGrep]));

    const prs = await fetchAllPages(
      '/pulls?state=open&sort=updated&direction=desc',
      100,
      function (raw) { return raw; }
    );
    const nonDraft = prs.filter((p) => !p.draft);
    const openNums = new Set(nonDraft.map((p) => p.number));

    const floor = nonDraft.slice(0, PRS_CAP);
    const floorNums = new Set(floor.map((p) => p.number));

    // Floor coverage is mandatory in BOTH modes (the freshness floor is unioned
    // into a full-scan fire too, via the floor merge below) -- fetch check-runs
    // for it unconditionally, before branching on isFullScan. Bounded to
    // PRS_CAP (20) parallel calls regardless of mode.
    const floorCheckRuns = new Map();
    let floorCheckRunErrors = 0;
    // Fetched alongside check-runs, same unconditional per-floor-PR-call
    // precedent -- see actionRequiredBlocksFromRuns's comment above for why
    // this is floor-only, not extended to the full-scan tail. Fails open to [] (never
    // throws into the outer Promise.all) so an Actions-API hiccup degrades to
    // 'no action_required blocks seen' rather than losing check-run coverage
    // for the PR too.
    const floorActionRequiredBlocks = new Map();
    // check_suite_id -> event, derived from the same Actions-runs fetch as
    // floorActionRequiredBlocks (no extra API call) -- see checkSuiteEventMap.
    const floorCheckSuiteEvents = new Map();
    // See fetchMergeStateStatus's comment -- same unconditional per-floor-PR
    // call precedent as the other two fetches in this loop.
    const floorMergeState = new Map();
    await Promise.all(floor.map(async (p) => {
      try {
        floorCheckRuns.set(p.number, await fetchCheckRuns(p.head.sha));
      } catch (e) {
        floorCheckRunErrors++;
      }
      try {
        const runs = await fetchRunsForSha(p.head.sha);
        floorActionRequiredBlocks.set(p.number, actionRequiredBlocksFromRuns(runs));
        floorCheckSuiteEvents.set(p.number, checkSuiteEventMap(runs));
      } catch (e) {
        floorActionRequiredBlocks.set(p.number, []);
        floorCheckSuiteEvents.set(p.number, new Map());
      }
      try {
        floorMergeState.set(p.number, await fetchMergeStateStatus(p.number));
      } catch (e) {
        floorMergeState.set(p.number, 'UNKNOWN');
      }
    }));
    const floorHeadShaByNumber = new Map(floor.map((p) => [p.number, p.head.sha]));
    const exclusionFieldsForFloor = async (number) => {
      const checkRuns = floorCheckRuns.get(number);
      if (!checkRuns) return { exclusionChecked: false, mergeStateStatus: floorMergeState.get(number) || 'UNKNOWN' };
      const { excludedChecks, actionableFailingChecks, signatureMismatches, blockedChecks: checkRunBlocked } =
        await splitExclusions(checkRuns, excludedJobNames, issueForJob, signatureForJob, floorCheckSuiteEvents.get(number));
      const { baseSkewChecks, remainingActionable, verificationSkipped: baseSkewVerificationSkipped } =
        await classifyBaseSkew(actionableFailingChecks, floorHeadShaByNumber.get(number), baseSkewEntries);
      // Merge in the Actions-runs-sourced blocks (see actionRequiredBlocksFromRuns);
      // dedup by name defensively even though the two sources shouldn't collide
      // in practice (an action_required workflow run has zero check-runs).
      const blockedByName = new Map(checkRunBlocked.map((b) => [b.name, b]));
      for (const b of floorActionRequiredBlocks.get(number) || []) {
        if (!blockedByName.has(b.name)) blockedByName.set(b.name, b);
      }
      const blockedChecks = [...blockedByName.values()];
      return {
        exclusionChecked: true,
        mergeStateStatus: floorMergeState.get(number) || 'UNKNOWN',
        checkCi: checkCiFromRuns(checkRuns, floorCheckSuiteEvents.get(number)),
        excludedChecks,
        signatureMismatches,
        baseSkewChecks,
        baseSkewVerificationSkipped,
        blockedChecks,
        // The failing checks that nothing above explains -- the list the sweep
        // prompt's 'rerun or investigate' step is about, and the input
        // decideWake reads. allFailuresExcluded/onlyBlocked below are derived
        // from the same list, so exposing it keeps the gate decision and the
        // agent's view of the PR on one source of truth.
        actionableFailingChecks: remainingActionable,
        allFailuresExcluded: (excludedChecks.length > 0 || baseSkewChecks.length > 0) && remainingActionable.length === 0,
        // Mirrors allFailuresExcluded's shape for the third (blocked) state --
        // true only when blocked is the ENTIRE story (nothing excluded,
        // base-skewed, or still actionable), so this PR can be reported as
        // 'wedged, not failing' rather than folded into either of the other
        // two summary buckets.
        onlyBlocked: blockedChecks.length > 0 && excludedChecks.length === 0 && baseSkewChecks.length === 0 && remainingActionable.length === 0,
      };
    };

    let unionAll;
    let scanTruncated = false;
    let activityErrors = 0;
    let activePrCount = 0;
    let nonGreenCount = null;

    if (isFullScan) {
      const nonGreen = await fetchNonGreenRollups();
      nonGreenCount = nonGreen.length;
      // Union with the floor too -- a freshly-opened/pushed PR can be green so
      // far but still deserves its normal freshness-floor visibility. Deferred:
      // per-PR check-run fetch for the broader nonGreen tail (not in floor) --
      // that population is uncapped and only appears twice a day, so extending
      // Fix 2's log-verified exclusion coverage to it risks the 30s/1MB script
      // budget for a case that hasn't yet shown a real miss. Those entries
      // carry exclusionChecked:false and rely on the agent's own step-0
      // cross-check. Base-skew classification (Fix 1) is the exception: it's
      // already covered for the tail via fetchNonGreenRollups's inline
      // failingContextNames/headSha (no extra REST call), so a tail-only PR
      // still gets baseSkewChecks populated even though exclusionChecked stays
      // false -- see the fetchNonGreenRollups comment for why this one case is
      // cheap enough to not defer.
      const merged = new Map();
      for (const p of nonGreen) {
        const entry = { number: p.number, title: p.title, updatedAt: p.updatedAt, inFloor: floorNums.has(p.number), hasNewActivity: false, fullScan: true, rollup: p.rollup, headSha: p.headSha, ...(await exclusionFieldsForFloor(p.number)) };
        if (!entry.exclusionChecked && p.headSha && p.failingContextNames?.length) {
          const { baseSkewChecks, verificationSkipped } = await classifyBaseSkew(p.failingContextNames, p.headSha, baseSkewEntries);
          if (baseSkewChecks.length > 0) entry.baseSkewChecks = baseSkewChecks;
          if (verificationSkipped.length > 0) entry.baseSkewVerificationSkipped = verificationSkipped;
        }
        // Tail-only (not floor-covered): the REST-based splitExclusions never
        // ran, so blockedChecks/rollupUnexplained come straight from the
        // GraphQL tail's own fields instead. rollupUnexplained is the signal
        // Gate 0f (below) is wired to act on -- it must survive onto the
        // entry unconditionally, not just when something else is empty.
        if (!entry.exclusionChecked) {
          // The tail never ran splitExclusions (no REST check-runs call, see
          // above), so its actionable list is the GraphQL failing names minus
          // tracked-regression job names (matched by name only, with no log
          // verification) and minus the base-skew matches classified just
          // above. Name-only is the same cross-check the agent's own step 0
          // performs for these entries; the gate accepts that leniency because
          // the alternative is waking on every full scan for every stale PR
          // carrying a known regression.
          const baseSkewNames = new Set((entry.baseSkewChecks || []).map((b) => b.name));
          entry.actionableFailingChecks = (p.failingContextNames || [])
            .filter((name) => !excludedJobNames.has(name) && !baseSkewNames.has(name))
            .map((name) => ({ name, id: null, target_url: null }));
          if (p.blockedContextNames?.length) {
            entry.blockedChecks = p.blockedContextNames.map((name) => ({ name, status: 'unknown-see-rollup', id: null }));
            entry.onlyBlocked = !entry.baseSkewChecks?.length && p.failingContextNames?.length === 0;
          }
          entry.rollupUnexplained = !!p.rollupUnexplained;
          // #13032 fix (parent, 2026-09-30): a rollupUnexplained:true reading is
          // re-verified via REST + the floor's own dedup helpers before being
          // trusted -- see verifyRollupUnexplained's comment for the false
          // positive this closes. Only ever clears the flag on POSITIVE
          // evidence (reverified && clean); an error or a genuinely-still-bad
          // deduped result leaves it set.
          if (entry.rollupUnexplained && p.headSha) {
            const { reverified, reverifiedClean } = await verifyRollupUnexplained(p.headSha);
            entry.rollupReverified = reverified;
            if (reverified && reverifiedClean) entry.rollupUnexplained = false;
          }
          // Not floor-covered, so exclusionFieldsForFloor's early return left
          // this 'UNKNOWN' (no REST call made for this number) -- the GraphQL
          // tail already carries the real value for free (see
          // fetchNonGreenRollups's query), so prefer it here.
          entry.mergeStateStatus = p.mergeStateStatus || 'UNKNOWN';
        }
        merged.set(p.number, entry);
      }
      for (const p of floor) {
        if (!merged.has(p.number)) merged.set(p.number, { number: p.number, title: p.title, updatedAt: p.updated_at, inFloor: true, hasNewActivity: false, fullScan: true, rollup: 'SUCCESS_OR_UNKNOWN', headSha: p.head.sha, ...(await exclusionFieldsForFloor(p.number)) });
      }
      unionAll = [...merged.values()];
    } else {
      const remainderAll = nonDraft.slice(PRS_CAP);
      scanTruncated = remainderAll.length > CHECKRUN_SCAN_CAP;
      const remainder = remainderAll.slice(0, CHECKRUN_SCAN_CAP);

      const cutoffIso = new Date(Date.now() - ACTIVITY_WINDOW_HOURS * 3600 * 1000).toISOString();
      const REMAINDER_CONCURRENCY = 15; // bounded: fast enough for the 30s budget, low enough to stay under GitHub's secondary rate limit
      const remainderResults = await mapWithConcurrency(remainder, REMAINDER_CONCURRENCY, async (p) => {
        try {
          const checkRuns = await fetchCheckRuns(p.head.sha);
          return { p, checkRuns, maxTs: maxCompletedAt(checkRuns) };
        } catch (e) {
          return { p, error: e };
        }
      });
      const activeExtra = [];
      for (const r of remainderResults) {
        if (r.error) { activityErrors++; continue; }
        if (r.maxTs && r.maxTs > cutoffIso) {
          activeExtra.push({ number: r.p.number, title: r.p.title, updatedAt: r.p.updated_at, lastCheckRunCompletedAt: r.maxTs, checkRuns: r.checkRuns, headSha: r.p.head.sha });
        }
      }
      activePrCount = activeExtra.length;

      const floorOut = await Promise.all(floor.map(async (p) => ({ number: p.number, title: p.title, updatedAt: p.updated_at, inFloor: true, hasNewActivity: false, fullScan: false, headSha: p.head.sha, ...(await exclusionFieldsForFloor(p.number)) })));
      const activeOut = await Promise.all(activeExtra.map(async (p) => {
        // Same merge as exclusionFieldsForFloor's floorActionRequiredBlocks --
        // activeExtra is bounded by the activity window (typically small), so
        // the extra per-PR Actions-runs call is cheap here too, and skipping it
        // would leave the identical wedge invisible the moment a PR ages out of
        // the top-20 floor while still showing recent check-run activity. Also
        // yields the check_suite_id -> event map for dedupeByLatestAttempt
        // (see checkSuiteEventMap), from the same call.
        let runs = [];
        try {
          runs = await fetchRunsForSha(p.headSha);
        } catch (e) {
          runs = [];
        }
        // Same rationale as floorMergeState -- activeExtra is bounded by the
        // activity window, so this extra per-PR call is cheap here too.
        let mergeStateStatus = 'UNKNOWN';
        try {
          mergeStateStatus = await fetchMergeStateStatus(p.number);
        } catch (e) {
          mergeStateStatus = 'UNKNOWN';
        }
        const actionRequiredBlocks = actionRequiredBlocksFromRuns(runs);
        const suiteEventById = checkSuiteEventMap(runs);
        const { excludedChecks, actionableFailingChecks, signatureMismatches, blockedChecks: checkRunBlocked } =
          await splitExclusions(p.checkRuns, excludedJobNames, issueForJob, signatureForJob, suiteEventById);
        const { baseSkewChecks, remainingActionable, verificationSkipped: baseSkewVerificationSkipped } =
          await classifyBaseSkew(actionableFailingChecks, p.headSha, baseSkewEntries);
        const blockedByName = new Map(checkRunBlocked.map((b) => [b.name, b]));
        for (const b of actionRequiredBlocks) {
          if (!blockedByName.has(b.name)) blockedByName.set(b.name, b);
        }
        const blockedChecks = [...blockedByName.values()];
        return {
          number: p.number, title: p.title, updatedAt: p.updatedAt, inFloor: false, hasNewActivity: true, fullScan: false,
          headSha: p.headSha,
          exclusionChecked: true, mergeStateStatus, checkCi: checkCiFromRuns(p.checkRuns, suiteEventById), excludedChecks, signatureMismatches, baseSkewChecks, baseSkewVerificationSkipped, blockedChecks,
          actionableFailingChecks: remainingActionable,
          allFailuresExcluded: (excludedChecks.length > 0 || baseSkewChecks.length > 0) && remainingActionable.length === 0,
          onlyBlocked: blockedChecks.length > 0 && excludedChecks.length === 0 && baseSkewChecks.length === 0 && remainingActionable.length === 0,
        };
      }));
      unionAll = floorOut.concat(activeOut);
    }

    unionAll.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const cap = isFullScan ? FULL_SCAN_CAP : UNION_CAP;
    const unionTruncated = unionAll.length > cap;
    const unionCapped = unionAll.slice(0, cap);
    // Bare PR numbers cut off the payload by the cap slice above -- exposed so
    // the agent can feed them to sweeplib.never_classified_among() and catch a
    // never-triaged PR the same sweep it drops out of view, rather than only
    // via the whole-tracker drain. Free: unionAll is already fully computed
    // above; this is exposition of existing data, no new API calls. Computed
    // in both modes (not just isFullScan) since UNION_CAP=40 can truncate too,
    // though that population (floor + active-in-last-3h) is small enough that
    // it rarely does.
    const truncatedTailNumbers = unionAll.slice(cap).map((p) => p.number);

    const sinceMs = Date.now() - 24 * 3600 * 1000;
    const evicted = [];
    try {
      const runs = await fetchAllPages(
        '/actions/runs?event=merge_group',
        100,
        function (raw) { return raw.workflow_runs; },
        function (items) {
          const oldest = items[items.length - 1];
          const ts = new Date(oldest.run_started_at || oldest.created_at).getTime();
          return ts < sinceMs;
        }
      );
      const seen = new Set();
      for (const r of runs) {
        if (!FAIL.has(r.conclusion)) continue;
        if (new Date(r.run_started_at || r.created_at).getTime() < sinceMs) continue;
        const m = /pr-(\d+)-/.exec(r.head_branch || '');
        if (!m) continue;
        const num = Number(m[1]);
        if (!openNums.has(num)) continue;
        if (seen.has(num)) continue;
        seen.add(num);
        evicted.push({
          number: num, mergeGroupRunId: r.id, workflow: r.name,
          headBranch: r.head_branch, conclusion: r.conclusion,
          runStartedAt: r.run_started_at, runUrl: r.html_url,
        });
      }
    } catch (e) { evicted.push({ error: e.message }); }

    // Evicted entries are bounded (24h window, matched to an open PR) and are
    // exactly where PR #12910's incident wasn't -- covering them is cheap and
    // was explicitly in scope alongside the floor.
    await Promise.all(evicted.filter((e) => !e.error).map(async (e) => {
      try {
        const jobs = await fetchRunJobs(e.mergeGroupRunId);
        const { excludedChecks, actionableFailingChecks, signatureMismatches, blockedChecks } =
          await splitExclusions(jobs, excludedJobNames, issueForJob, signatureForJob);
        e.exclusionChecked = true;
        e.excludedChecks = excludedChecks;
        e.signatureMismatches = signatureMismatches;
        e.blockedChecks = blockedChecks;
        e.actionableFailingChecks = actionableFailingChecks;
        e.allFailuresExcluded = excludedChecks.length > 0 && actionableFailingChecks.length === 0;
        e.onlyBlocked = blockedChecks.length > 0 && excludedChecks.length === 0 && actionableFailingChecks.length === 0;
      } catch (err) {
        e.exclusionChecked = false;
        e.jobsError = err.message;
      }
    }));

    const prsWithExcludedChecks = unionCapped.filter((p) => (p.excludedChecks || []).length > 0).length;
    const evictedWithExcludedChecks = evicted.filter((e) => (e.excludedChecks || []).length > 0).length;
    const prsWithBlockedChecks = unionCapped.filter((p) => (p.blockedChecks || []).length > 0).length;
    const evictedWithBlockedChecks = evicted.filter((e) => (e.blockedChecks || []).length > 0).length;
    const prsWithRollupUnexplained = unionCapped.filter((p) => p.rollupUnexplained).length;
    // Visible counter for resolveExclusionVerdict's skipped:true verdict -- an
    // entry that declared logGrep but had no id/target_url to check it
    // against, so it fell through to actionable rather than being trusted on
    // name+ancestry alone (see resolveExclusionVerdict's own comment for why
    // this must never be silent). Rolls up both registries: signatureMismatches
    // (tracked-regressions.json, via splitExclusions) and
    // baseSkewVerificationSkipped (base-skew-signatures.json, via
    // classifyBaseSkew) across PRs and evicted entries alike.
    const skippedCountFor = (list) =>
      list.reduce((n, e) => n + (e.signatureMismatches || []).filter((m) => m.skipped).length + (e.baseSkewVerificationSkipped || []).length, 0);
    const verificationSkippedCount = skippedCountFor(unionCapped) + skippedCountFor(evicted);

    const data = {
        driftCheck: driftCheck,
        totalNonDraft: nonDraft.length,
        prCount: unionCapped.length,
        mode: isFullScan ? 'full-scan' : 'floor+activity',
        prsCap: PRS_CAP,
        prsTruncated: nonDraft.length > PRS_CAP,
        unionCap: cap,
        unionTruncated: unionTruncated,
        truncatedTailNumbers: truncatedTailNumbers,
        nonGreenCount: nonGreenCount,
        activityWindowHours: isFullScan ? null : ACTIVITY_WINDOW_HOURS,
        checkRunScanCap: isFullScan ? null : CHECKRUN_SCAN_CAP,
        checkRunScanTruncated: isFullScan ? null : scanTruncated,
        activityErrors: isFullScan ? null : activityErrors,
        activePrCount: isFullScan ? null : activePrCount,
        floorCheckRunErrors: floorCheckRunErrors,
        exclusions: {
          activeCount: excludedJobNames.size,
          loadError: exclusionsLoadError,
          needsBaseSkewGuardCount: needsBaseSkewGuardCount,
          verificationSkippedCount: verificationSkippedCount,
          prsWithExcludedChecks: prsWithExcludedChecks,
          evictedWithExcludedChecks: evictedWithExcludedChecks,
          prsWithBlockedChecks: prsWithBlockedChecks,
          evictedWithBlockedChecks: evictedWithBlockedChecks,
          prsWithRollupUnexplained: prsWithRollupUnexplained,
        },
        prs: unionCapped,
        evicted: evicted,
    };

    const { wakeAgent, wakeReasons, nextState } = decideWake(data, loadPreviousState());
    const stateWriteError = saveState(nextState);
    if (wakeAgent) {
      console.log(JSON.stringify({ wakeAgent: true, data: { ...data, wakeReasons, stateWriteError } }));
    } else {
      console.log(JSON.stringify({ wakeAgent: false, data: { ...sleepSummary(data, nextState), stateWriteError } }));
    }
  } catch (e) {
    console.log(JSON.stringify(errorGate(driftCheck, e)));
  }
};

// The decision helpers above are importable by the test file; the sweep
// itself only runs when this file is the program node was started with.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
