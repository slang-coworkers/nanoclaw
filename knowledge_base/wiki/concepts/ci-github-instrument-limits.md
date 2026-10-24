---
title: "GitHub/git Instrument Limits — Caps, Silent Truncation & Endpoint Splits"
type: concept
group: ci-tooling
tags: [gh-cli, github-api, git, pagination, truncation, absence-claims, controls, slang]
source_count: 8
---

# GitHub/git Instrument Limits — Caps, Silent Truncation & Endpoint Splits

Split out of [gh CLI Usage & PR/Issue Mechanics](../concepts/ci-gh-cli-usage.md) at the 40 KB page cap. That page covers *how to drive* `gh`; this one covers *how its readings mislead*: measured caps, silently truncated arrays, endpoints that answer a narrower question than the one asked, and the controls that catch them. Most entries were filed after a wrong fact reached a human.

## TL;DR

- **Every GitHub collection has a cap, and none announces it.** Sub-collections (`/comments`, `/reviews`, `/timeline`, `/files`, `/commits`, `/check-runs`) default to **30**; `gh pr view --json files` caps at **100**; a commit's `.files[]` caps at **300**; `search/code` `items[]` caps at 30/page. Pass `per_page=100`, then confirm the last page is shorter than `per_page`.
- **A round number is a cap signature.** Exactly 30 / 100 / 200 / 300 / 1000 means "assume truncated" until a second instrument agrees.
- **Two counts of the same thing disagreeing means one is a page, not a population.** Reconcile on raw page length, never on your post-filter count.
- **An absence claim is the cap's favourite victim.** A zero reads as clean evidence and licenses action. Bound the collection before believing any zero.
- **A control must be independent of the failure mode it is meant to catch.** A control drawn from the same truncated page cannot detect the truncation; non-zero and plausible proves only that the query ran.
- **A full-set histogram answers "did I read all the rows?", never "did I query all the object classes?"** A commit carries check-runs *and* legacy statuses, which do not overlap. A zero is a finding only once the universe is closed.
- **Endpoint splits are symmetric; state both directions.** `pulls/N/reviews` is blind to conversation; a comments endpoint is blind to review state (an empty-body `APPROVED` is invisible to it).
- **Pick the endpoint by the question:** `pulls/N/files` is cumulative vs base (it inherits everything a merge dragged in); `commits/<sha>` is what that push wrote.
- **`gh run list --workflow` does not constrain results.** Read `.name`, `.event` and `.head_repository` off the rows you got before characterizing "CI".
- **A disconfirming probe needs more scrutiny than the claim it retracts.** Ask whether the instrument can even represent the thing now called absent. `gh run view --json jobs` shows only the latest attempt, so one re-run hides a real failure.
- **Never key CI state on a job/check-run name alone.** Names repeat across workflows; key on `(pr, workflow_id, job name)`. Name-keyed dedup fails open.
- **A check that goes red with no local change: diff the last-green log against the first-red log.** Inputs like an upstream default branch, a floating tag or `@latest` are hidden external dependencies, and a rerun cannot fix them.
- **git ancestry gives confident false negatives** from squash-merge sha rewriting and from shallow clones. Verify merges by content (`git show origin/master:<path> | grep <new-symbol>`) or ask the server (`compare/<base>...<sha>`, `pulls/N --jq .merged`).
- **Prove the commit exists before trusting a negative about its tree.** `git cat-file -e <sha>:<path>` gives rc=128 both for "path not in tree" and "commit never fetched". Gate on `git cat-file -t <sha>` → `commit`.
- **A 401/403 is path-classed, never global.** `gh api user` 403 is correct App behavior (no user identity); `permissions.push=false` describes git refs, not `issues:write`.
- **Infra capability is a per-session measurement.** GraphQL availability changed 4× in three weeks. Write capability notes with a timestamp and a probe, re-probe at session start, and sweep deferred artifacts when a capability recovers.
- **`gh search` (issues, prs, code, `is:merged`) is not a counting or absence instrument;** the index lags. For dedup and absence, enumerate `issues?state=open&per_page=100` and match locally.
- **A proxy inverts when its precondition flips.** `comments==0` proxies "no public artifact" only for issues filed by others; on a bot-authored issue the body is the artifact.
- **`gh api` has no `--arg`;** inline the value into `--jq`. `wc -m` returns bytes unless the locale says otherwise.

Older folds on the same subject — the `--paginate` page-2 401, `total_count` scope, summarizing-tool negatives, path-classed 401s, and the 300-file patch cap — are in [part 2](../concepts/ci-github-pagination-and-count-limits.md).

## The Measured Cap Table

Each figure was measured against a second instrument that disagreed. None of these endpoints emits an error, a warning or an `incomplete_results` flag; the array just ends.

| read | silent cap | how it was caught |
|---|---|---|
| any sub-collection with no `per_page` (`/comments`, `/reviews`, `/timeline`, `/files`, `/commits`, `/check-runs`) | **30** (page 1) | `pulls/12179/comments` → 30; `?per_page=100` → 39 |
| `gh pr view --json files` | **100** | disagreed with an uncapped path enumeration |
| a commit's `.files[]` (`commits/<sha>`) | **300** | API 300 vs `git show --name-only -m <sha>` → 713 |
| `search/code` `items[]` | 30/page, and `total_count` counts **matches, not files** | — |
| `compare/<base>...<head>` per-file `additions`/`deletions` | **`0/0` for files that DID change** | same file reports `1/1` with a patch in a per-commit view |

The sub-collection cap does the most harm. These endpoints sort oldest-first, so the truncated tail is exactly the recent activity you are looking for. Five real review comments on slang#12179 were reported to a parent as nonexistent, and the non-zero control (18 comments on an earlier date) passed because it came off the same page 1 ([gh sub-collection reads truncate at 30 by default](../learnings/1785847203466-gh-sub-collection-reads-truncate-at-30-by-default-.md)).

The 300-file commit cap has the same shape. `.stats` is not a control for it: `{additions, deletions, total}` are computed server-side over the real diff, so they look consistent with a truncated `.files[]`. Control against git or a window-containment check, and pass `-m` for merges or git suppresses the diff ([gh api commit .files is silently truncated at 300](../learnings/1785828442240-gh-api-commit-files-is-silently-truncated-at-300-a.md)). Separately, `gh api` has no `--arg`: it is silently ignored and yields zero rows, so inline the value into the `--jq` program ([gh api has no --arg flag](../learnings/1785868475644-gh-api-has-no-arg-flag-jq-arg-silently-yields-zero.md)).

The `compare` truncation fails toward permissiveness in a gate. The approver's `tier_eligible` clause sums per-file counts, so a truncated `0/0` reads as "small enough." It was caught on a 124-file PR by holding the file fixed and varying only the request, the positive-control shape for an instrument suspected of declining at scale. Blob shas (`contents/{path}?ref={base}` vs `?ref={head}`) confirmed that 8/8 sampled `0/0` entries had changed. It is non-monotonic: a 101-file compare came back clean while a 41-file one truncated, so file count does not predict truncation ([compare API silently truncates per-file counts to 0/0](../learnings/1785863597767-approver-clause-gap-github-s-compare-api-silently-.md), [gh pr view --json files silently caps at 100](../learnings/1785860688057-gh-pr-view-json-files-silently-caps-at-100-countin.md)).

**`--paginate` under the OneCLI proxy 401s on page 2 and truncates silently**, and the error JSON lands on stdout as an extra datum. The blob has no trailing newline, so `wc -l` reports 100 while `grep -c ''` and `jq -s 'length'` report 101. The worse consequence is `jq -s '.[-1]'` returning an error object where a caller expects a data row ([CORRECTION: gh api --paginate 401s on page 2](../learnings/1785838985522-correction-gh-api-paginate-401s-on-page-2-under-th.md)). The claim took three revisions, which means the real question was "which counter?", not "what is the number?". The exit code is what launders the failure into a green report: `gh` exits 1, but the pipeline exits 0 (`PIPESTATUS=(1 0)`). Use `set -o pipefail` or check `${PIPESTATUS[0]}`, and never count with `2>&1`: gh's newline-terminated stderr line fuses onto the unterminated blob and fabricates the extra row ([gh --paginate 401: gh exits 1, the pipeline exits 0, error JSON on stdout](../learnings/1785839249462-correction-v2-the-gh-paginate-401-gh-exits-1-the-p.md)). When two agents publish contradictory measurements, the resolution is usually different subjects (gh alone vs gh in a pipeline), not that one is wrong. A plausible mechanism attached to a correct conclusion draws no pushback, so audit the mechanism separately.

An instrument outside GitHub has the same shape: `wc -m` returns bytes when `LANG`/`LC_ALL`/`LC_CTYPE` are unset, as they are in these containers. So `wc -c == wc -m` is evidence about the locale, not the file. Two instruments agreeing is not corroboration when both degenerate to the same wrong value; first ask whether they could disagree ([wc -m silently returns BYTES under a non-UTF-8 locale](../learnings/1785832446547-wc-m-silently-returns-bytes-under-a-non-utf-8-loca.md)).

## Object Classes and Endpoint Splits

A full-set histogram answers "did I read all the rows?" and says nothing about "did I query all the object classes?". A commit has two non-overlapping status classes: `commits/<sha>/check-runs` (Actions) and `commits/<sha>/status` (legacy statuses). On slang#12186 the legacy set held `license/cla` and `SlangPy Tests`. A sweep of all 128 check-runs found neither, and the resulting claim, "the operative requirement is something other than a pending check", was a negative over a half-enumerated universe. It survived only because both legacy contexts were `success`. A matcher trap rode along: `test("cla|SlangPy";"i")` matched 19 check-runs because `cla` matches `clang`. Anchor a matcher before believing either polarity ([a commit has TWO status object classes](../learnings/1785849575805-a-commit-has-two-status-object-classes-enumerate-b.md)).

Endpoint splits are symmetric. The fleet knew "`pulls/N/reviews` alone misses comments", but not the inverse: an approval carries no comment body, so an empty-body `APPROVED` is invisible to any comments tool. #12324 was reported to the approver as having no APPROVED review, although `jkiviluoto-nv` had approved 53 minutes earlier; `pulls/N/reviews`, the MCP reviews tool, GraphQL `reviewDecision` and `latestReviews` all showed it ([an empty-body APPROVED is invisible to a comments endpoint](../learnings/1785849572099-an-empty-body-approved-is-invisible-to-a-comments-.md)). A rule learned in one direction teaches only that direction, so state both. When a fresh measurement contradicts yours, audit your instrument before disputing the peer. Read review state from `pulls/{n}/reviews` or GraphQL, inline feedback from `pulls/{n}/comments`, and conversation from `issues/{n}/comments`.

**`pulls/N/files` is cumulative vs the base; `commits/<sha>` is what that push wrote.** A note claimed push `08181a69b4` carried 33 added `.github/workflows/*.yml`, so the bot-can't-push-workflows issue was stale. Measured, that commit has 1 parent, 2 files, +2/−3 and no workflow paths; the paths live in a two-parent merge, and there are 72 of them. The retraction was two-part (wrong commit and a fabricated count), and it nearly led to contradicting a correct peer. The `workflows` App permission gates the push at receive time, so inherited ancestry in a cumulative view is not evidence of a push ([pulls-N-files is cumulative, commits-sha is what the push wrote](../learnings/1785847094771-pulls-n-files-is-cumulative-commits-sha-is-what-th.md)).

**`gh run list --workflow <f>` can return rows from other workflows.** A supervisor reported "CI hasn't run in over two weeks" on slang#11135 from rows that were a `pull_request_review_comment`-triggered bot-assistant gate, not the build pipeline. Read `.name`, `.event` and `.head_repository` off the returned rows before asserting CI state. `action_required` on a fork PR is a maintainer approval gate, not a failure ([gh run list --workflow does NOT constrain results](../learnings/1785847099622-gh-run-list-workflow-does-not-constrain-results-ch.md)).

## Runs, Attempts and Job Names

**`gh run view <id> --json jobs` and `GET /actions/runs/{id}/jobs` return only the latest attempt.** A Falcor failure on a PR head was correctly reported, then retracted after `gh run view 31047790392 --json jobs` showed `Test (Falcor) = SUCCESS`. The tell is `gh api …/actions/runs/<id> --jq .run_attempt` > 1; then read `…/actions/runs/<id>/attempts/1/jobs`. On that run (`run_attempt: 2`) attempt 1 held `Test (Falcor)` FAILURE (job `92454170957`, runner SLANGWIN4, `Mogwai.exe` return code `0xC0000005`). Every returned job also carries `run_attempt` ([gh run view --json jobs shows only the latest attempt](../learnings/1785992152145-gh-run-view-json-jobs-shows-only-the-latest-attemp.md)).

Rules from that retraction:
- **A disconfirming probe needs more scrutiny than the claim it kills.** Over-retraction costs as much as over-claiming and is harder to catch, because withdrawing reads as rigour. Ask whether the instrument can represent the thing now called absent.
- **Two failure modes can produce the same symptom.** The retraction borrowed a mistake already admitted that session (confusing `Test (Falcor)` with `Test (Falcor Perf)`); fixing one says nothing about the other.
- **An API that collapses history loses the comparison, not just a data point.** Attempt 1 failed and attempt 2 passed on one sha: the same-SHA pass/fail pair a flake investigation wants.
- **Search the issue tracker first.** One `gh issue list` on the failure signature found it already tracked with 8 prior occurrences. Finding the owner is cheaper than proving it isn't yours.

**Job and check-run names are not unique across workflows, so a name-keyed probe fails open.** `shader-slang/slang` uses job name `check-formatting` in both `check-formatting.yml` and `check-toc.yml`. On #11389 (`378491c6cdcc`) the formatting row is `failure` (run `26865648843`, 05:31:16Z) and the TOC row `success` (run `26865648858`, 05:37:22Z). Newest-wins dedup on `.name` (`sort_by(.started_at)|last`) picks the TOC success, and it cleared real formatting reds on #11389 and #9809. This is the inverse of the `workflow_dispatch` phantom red (one sha, two suites): that one shows stale reds, this one hides live ones. Key on `(pr, workflow_id, job name)`, recovering the workflow from `details_url` (`/actions/runs/<run_id>/job/<job_id>`) or `.path` in `actions/runs?head_sha=<sha>` ([check-formatting is a job name shared by two slang workflows](../learnings/1785990188609-check-formatting-is-a-job-name-shared-by-two-slang.md)).

Scope it precisely. 70/79 non-draft open slang PRs carry at least one duplicated check-run name on their head sha (up to 43 names; `build` ×5 on #11389), but most are benign retries converging on one verdict. The exploitable shape is a `failure` and a non-failure under one name from different run ids: 17/79 (22%). It does not flap: 6 consecutive calls on #9809 returned the same order and `success` each time. The real defect is that #9809's two rows share identical `started_at` and `completed_at` (22:10:16Z / 22:10:59Z), so no sort key discriminates them and the verdict is unspecified. "Unspecified" and "observed to vary" are different claims, and only one is falsifiable; overstating a real defect is still a fabrication. Say "order-dependent, therefore unreliable" ([correction: 17/79 exploitable, and it does not flap](../learnings/1785990889561-correction-the-check-runs-name-collision-is-exploi.md)). The detector:

```bash
gh api "/repos/O/R/commits/$SHA/check-runs?per_page=100" --jq '
  [.check_runs[]|{name,c:.conclusion,r:(.details_url|split("/")[7])}]
  | group_by(.name) | map(select(length>1))
  | map(select(any(.c=="failure")) | select(any(.c!="failure")))
  | map(select(([.[]|.r]|unique|length)>1))'
```

`split("/")[7]` is the run id. Index 6 is the literal string `"runs"`, which makes every row identical and returns a confident zero.

**A check that goes red with no local change: diff the last-green job log against the first-red one.** `Check Submodule Pointers` failed 6 consecutive slang merge-queue runs, though nothing had touched `external/mimalloc` since 07-15. The green log (21:19:58Z) said `pinned 8c532c32 … against main (remote default branch)`; the red one (22:33:19Z) said `… against main3`. Upstream microsoft/mimalloc had changed its default branch to `main3`, and the `.gitmodules` stanza has no `branch =` line, so the checker follows the remote default (`git ls-remote --symref <url> HEAD` → `refs/heads/main3`). Any check whose input is an upstream default branch, a floating tag or `@latest` has a hidden external dependency, and a rerun cannot fix it: 95 success / 5 failure over the last 100 runs is a state change, not a flake rate. Three side traps:
- The ~1h failure cadence was merge-queue arrival, not a cron; the workflow has no `schedule:` block. Read the `on:` block before calling anything "the nightly".
- Red is not blocking. #12352, #12353 and #12322 merged with it red because it is not a required check, so it is never grounds for a requeue or an eviction.
- On a busy repo `/actions/runs?per_page=100` spans about 12 minutes (04:30:03→04:42:38 of `total_count=40000`), so a name filter over it reads as "this workflow never runs". Resolve the id from `/actions/workflows`, query `/actions/workflows/<id>/runs`, and report the window your page spans ([diff the last-green log against the first-red log](../learnings/1785992236992-a-ci-failure-that-starts-with-no-local-commit-diff.md), [check-submodules went red after mimalloc flipped its default branch](../learnings/1785989696877-check-submodules-went-red-for-all-merge-group-runs.md)).

## Ancestry, Presence, and Shallow Clones

`git merge-base --is-ancestor <my-sha> origin/master` returning no does not mean your work did not land. Two mechanisms give a false negative that looks like a true one. Squash-merge rewrites the sha: shader-slang repos are squash-only, so slang#12238 head `f3b5b51188` → no, while the change merged as `645ac5eef2`. A shallow clone cannot see objects outside its depth, so ancestry returns false, not an error. Either one leads to reporting "my fix isn't on master" about merged work, or redoing it ([local git ancestry gives confident false negatives](../learnings/1785847142026-local-git-ancestry-gives-confident-false-negatives.md), [shallow clone mode 4: ancestry predicates false-negative at a graft root](../learnings/1785838259620-shallow-clone-mode-4-ancestry-predicates-false-neg.md)).

Verify by content, which holds under both mechanisms: `git show origin/master:<path> | grep -n <NewSymbol>` (pick a symbol that cannot pre-date the change), `git ls-tree origin/master <new-test>`, or `git log origin/master --grep=<issue>`. For ancestry on an unfetched sha, ask the server: `compare/<base>...<sha> --jq .status`, or `pulls/<n> --jq '{merged, merged_at, merge_commit_sha}'`.

File-existence probes fail the same way. `git cat-file -e <sha>:<path>` returns rc=128 both for "path not in that tree" and "I don't have that tree", and the idiomatic `2>/dev/null && echo PRESENT || echo absent` discards the only text that might separate them. The stderr only appears to separate them: the two messages differ when the file exists in the working tree. With the path absent on disk too, they are identical apart from the ref name:

```
A′ path absent in tree, absent on disk   → fatal: path 'zzz.slang' does not exist in 'HEAD'
B′ commit unfetched,   absent on disk    → fatal: path 'zzz.slang' does not exist in '948da432…'
```

So `exists on disk, but not in <X>` describes your checkout, not whether `<X>` was fetched, and it misleads exactly when you probe a PR head you never fetched. Establish the commit first: `git cat-file -t <sha>` must print `commit`, or `git ls-tree --name-only <sha> -- <dir>/` must list something. For presence at a sha you may not have, use the server: `contents/<path>?ref=<sha>` → 404 means absent ([git cat-file -e in a shallow clone reports FAKE ABSENCE](../learnings/1785847146872-git-cat-file-e-sha-path-in-a-shallow-clone-reports.md), [its stderr only appears to distinguish them](../learnings/1785847652028-approver-clause-gap-git-cat-file-e-sha-path-cannot.md), [verify commit-presence per-sha with the contents API](../learnings/1785841467377-verify-commit-presence-per-sha-with-the-contents-a.md)).

A negative from a tool that lacks the data looks the same as one from a tool that has it. The positive control is cheap: run the same query against something that must return yes (`origin/master~1` for ancestry, `cat-file -t` for presence). If that fails too, the instrument is blind. The `cat-file` finding was nearly dismissed because notes said tree reads are immune to shallow-clone effects; that held only for the ancestry case the rule was measured on. A rule's scope is the case it was measured on, so test a new case that merely resembles it.

## Capability Negatives and Perishable Infra Facts

**A 401/403 is path-classed, never global, and two signals do not measure what they seem to.** `permissions.push=false` describes push access to git refs; `issues:write` is a separate scope. `gh api user` 403 is correct for a GitHub App installation token, which has no user identity. An edge that is writing successfully returns both values, so neither is a control ([permissions.push=false and gh api user 403 do NOT measure issues:write](../learnings/1785838110268-permissions-push-false-and-gh-api-user-403-do-not-.md)). Before recording "I can't do X", construct a case where the probe must return positive and confirm it does; if you cannot, the probe is not a control.

**Infra capability is perishable.** GraphQL on this fleet went outage (07-17) → fixed (07-17) → recurred (08-03) → fixed (08-04), superseding the "GraphQL is 401" premise in five notes whose REST workarounds remain valid. Correcting a claim's extent ("my edge" → "fleet-wide") while keeping it in the present tense still leaves it wrong. Re-probe with one call before citing availability ([gh GraphQL RECOVERED — the 401 is OSCILLATING](../learnings/1785847386829-infra-gh-graphql-recovered-2026-08-04-12-41z-the-4.md)).

**A capability negative conceals itself.** A false ceiling is discharged by not trying, so it never appears in a transcript and hardens into a permanent-looking fact that spreads by copy-paste. A false floor (claiming a capability you lack) fails loudly the first time someone relies on it. The bot's GraphQL 401'd "Bad credentials" across several sessions and was written into doctrine as "GraphQL is disabled for our token" and "`gh pr view --json` 401s on the bot token" (stamped 6× in one concept file). On 08-04 it recovered with no action by anyone, and `updateIssue` mutations succeeded at once ([GraphQL 401 recovered untouched; four issues sat blocked behind the false ceiling](../learnings/1785839495372-a-capability-probe-is-a-measurement-with-a-timesta.md), [a capability claim phrased as a property of the token never expires](../learnings/1785839697908-a-capability-claim-written-as-a-property-of-the-to.md)). Meanwhile four issues (#12313, #12317, #12316, #12320) had sat with Issue Type blank because of the belief, three carrying the now-false public sentence "I was unable to set the native Issue Type this session due to a token limitation". Rules:
- **Phrase a capability finding with its timestamp and its probe.** Write "GraphQL 401'd at 09:4xZ; probe `gh api graphql -f query='{viewer{login}}'` before relying on it", not "on the bot token X 401s". Test: would the sentence still be true tomorrow if the cause were transient?
- **Re-probe at session start.** One call unblocked four chains.
- **Do not collapse independent capabilities.** On the edge that had just run four mutations, `gh api user` still 403'd and `permissions.push` was still `false`.
- **When a capability recovers, sweep the artifacts that deferred to it**, not only the wording. Grep your posted comments for the limitation sentence; the queue of things not attempted is the expensive half.
- **Key a lesson to the question that will summon it**, not to the incident. Both tiers filed this under the outage rather than the phrasing habit, so a task about capability never retrieved it.

## Search Is Not a Counting or Absence Instrument

`gh search issues` returns false zeroes because the index lags; a fresh or low-traffic issue is missing from results while it exists. It nearly led to filing a duplicate on "zero open issues track this". Use a structurally different instrument: enumerate `repos/{o}/{r}/issues?state=open&per_page=100` (paginated) and regex titles and bodies locally (60 open issues, one pass, no index) ([never dedup issues with gh search](../learnings/1785856116224-never-dedup-issues-with-gh-search-and-failed-on-a-.md), [title-only issue search is not a prior-art claim](../learnings/1785880085907-title-only-github-issue-search-is-not-prior-art-cl.md), [query the body dimension for prior art](../learnings/1785881386033-github-prior-art-search-query-the-body-dimension-a.md)).

Code search is stale in a way that reads as current: it returned a deleted file as a live hit ([a stale code-search index returns a deleted file as current](../learnings/1785856771209-a-stale-code-search-index-returns-a-deleted-file-a.md), [gh search code silently excludes files](../learnings/1785867483864-mechanism-established-gh-search-code-silently-excl.md)). The durable part is a correction. Two false advisories were first blamed on the stale index, but neither came from search: both were Devin diff-scoped flags forwarded unchecked. `search/code` was used once, after the challenge, and its stale hit was caught and overridden by a live per-workflow read. When one claim in a batch is challenged, re-audit the whole batch and check each item's provenance before assigning a common cause; a tidy shared mechanism is attractive and often wrong.

The same audit gave a second lesson: "a job failed on a run that used the box" is not "the job failed because of the box". A figure of 3 merge-queue evictions caused by a bad runner survived several review rounds. Checking per-job `runner_name` dropped one, whose only failing job was a Falcor image test that also fails on healthy hosts; the honest figure was 2. Ask which job failed on which `runner_name`, and whether it fails elsewhere in the same window.

## A Proxy Inverts When Its Precondition Flips

A supervisor nudge flagged "no resumable GitHub artifact" on slang#12337 and asked for a 5-bullet comment. `comments=0` was true, but "no artifact" was false: our bot authored the issue, so the artifact was its 8,783-byte body, which already held every fact the nudge listed (verified by grep with a zero-control). `comments=0` was intended, because the analysis went in through three in-place body PATCHes, and a PATCH notifies nobody. Posting would have degraded the artifact ([comments==0 only proxies "no artifact" for issues filed by SOMEONE ELSE](../learnings/1785846721964-comments-0-only-proxies-no-github-artifact-for-iss.md)).

`comments==0` is a valid artifact-absence proxy only for issues filed by others. On an issue we authored the proxy inverts: it fires hardest where the public footprint is most complete. It is the same family as `permissions.push` for `issues:write` and `rate_limit` as an auth probe: the instrument answers a different question, and its answer is locally correct. Before acting on a detector, check that its precondition holds for this case; a detector firing is a claim, not a fact.

**Source learnings (8):**

- [CORRECTION v2 — gh --paginate 401: gh exits 1, the pipeline exits 0, error JSON on stdout; don't count with `2>&1`, use `set -o pipefail`](../learnings/1785839249462-correction-v2-the-gh-paginate-401-gh-exits-1-the-p.md) — Contradictory measurements resolve to "different subjects" (gh-alone vs gh-in-a-pipeline), and a plausible mechanism on a correct conclusion draws no pushback.
- [A capability probe is a measurement with a timestamp, not a property — GraphQL 401 recovered untouched, 4 issues blocked behind the false ceiling](../learnings/1785839495372-a-capability-probe-is-a-measurement-with-a-timesta.md) — Re-probe at session start; when a capability recovers, sweep the artifacts that deferred to it.
- [A capability claim phrased as a property of the token never expires — a false ceiling is discharged by not trying](../learnings/1785839697908-a-capability-claim-written-as-a-property-of-the-to.md) — Key the lesson to the question that summons it (the phrasing habit), not the incident (the outage).
- [gh run view --json jobs shows ONLY the latest attempt — it hid a real failure and I retracted a true report](../learnings/1785992152145-gh-run-view-json-jobs-shows-only-the-latest-attemp.md) — Read `run_attempt`, then `attempts/<n>/jobs`; a disconfirming probe needs more scrutiny than the claim it kills.
- [check-formatting is a job name shared by TWO slang workflows — a name-keyed check-runs probe fails OPEN](../learnings/1785990188609-check-formatting-is-a-job-name-shared-by-two-slang.md) — Names are not unique across workflows; key CI state on `(pr, workflow_id, job name)`.
- [CORRECTION: the collision is exploitable on 17/79 PRs and does not flap between calls](../learnings/1785990889561-correction-the-check-runs-name-collision-is-exploi.md) — The dangerous shape is a `failure` + non-failure under one name from different run ids; "unspecified" ≠ "observed to vary".
- [A CI failure that starts with no local commit: diff the last-GREEN log against the first-RED log](../learnings/1785992236992-a-ci-failure-that-starts-with-no-local-commit-diff.md) — The log prints the resolved input, and the delta names the cause; any "upstream default branch" input is a hidden external dependency.
- [check-submodules went red for all merge_group runs after upstream mimalloc flipped its default branch](../learnings/1785989696877-check-submodules-went-red-for-all-merge-group-runs.md) — Rerun-cannot-succeed, not a flake; non-required, so never a requeue or eviction cause.

_Catalog: [index](../index.md)_
