---
title: "GitHub CLI / API Silent-Wrong-Answer Traps"
type: concept
group: general
tags: [github, gh-cli, gh-api, ci, pagination, merge-queue, actions-api, jq, discord]
source_count: 32
---

## TL;DR

A catalogue of concrete `gh api` / `gh` CLI / GitHub-Actions gotchas that all share one
shape — **the instrument answers a narrower question than the one you asked, without
saying so, and the failure reads as good news** (a `0`, a `success`, an empty list, a
plausible old row). Each entry pairs the trap with the affirmative check that catches it.

Fast lookups:
- **Pagination**: default is 30/page; `--paginate` is *dropped* when `--jq` is present;
  any count landing on 30/50/100 is a page size until proven otherwise.
- **SHAs**: `head_sha=<short>` silently returns `total_count:0`; always use the full 40-char SHA.
- **`search/code`**: indexes only the *default branch* and caps at ~384 KB; useless for your fix branch or a negative.
- **Contents API**: files >1 MB come back `encoding:"none"`, empty content, HTTP 200 — fetch the blob and assert `wc -c == .size`.
- **Combined `success` status** can sit on a commit with *zero* check-runs; gate on a nonzero count of non-skipped check-runs, not on absence-of-failures.
- **`gh issue view` succeeds on PR numbers**; `gh pr view` is the discriminator (issues and PRs share one counter).
- **`gh run list --limit N`** (newest-first) cannot see a *stuck* run — the blocker is old, so it sinks past any page window.
- **Commits API**: `422` = unpushed, `404` = repo-unreachable — do not conflate.
- **Merge-queue** branch names are `pr-N-BASEsha`, not the PR's own head; `reason=merged` is not an eviction.
- **Discord** caps messages at 2000 chars, and the 400 error *misreports* the bound.

## Pagination is the master trap

`gh api …/check-runs` returns **only the first 30** without `--paginate` — no warning, no
truncation marker, well-formed JSON. A census built from it looks complete (measured: 30
checks read as "29 skipped, 1 success"; the truth with `--paginate` was 46 → "42 skipped,
4 success"). **A display limit silently becomes a denominator whenever you count the output
of something that truncates** — the same defect hit three people three ways in one review
(`head -20`, `head -25`, un-paginated API). Always `--paginate` on any list endpoint you
count; treat a round total (30/50/100) as suspect; prefer the tool's own summary line as an
independent reading; and **print names, not counts** so a duplicate or truncation is
visible. Companion: a `conclusion:success` run with exactly one non-skipped job (a
license-header check) compiled nothing — enumerate the non-skipped *job names* before
calling a `success` a CI signal. [gh api check-runs truncates at 30 without --paginate — any count near a round number is a page boundary](wiki/learnings/1786060908492-gh-api-check-runs-truncates-at-30-without-paginate.md)

Truncation can **fabricate** an alarm, not just hide one. A `per_page=40` read of
merge-queue landings missed the newest row, inflating the apparent gap to "106 min, exceeds
median" when 3 pages of `per_page=100` (26 landings) showed the current gap at the 24th
percentile. **A truncated page is not a window** — print `n` and the oldest timestamp
before computing any rate/median; if your denominator is 1-2 samples you have an anecdote
wearing a statistic's name. And **truncation biases whichever way the missing rows would
have argued**, so don't assume the safe direction. The cheap detector: run the query at two
`per_page` values and compare *both* `total_count` and the newest row. [A truncated per_page read can FABRICATE an alarm, not just hide one](wiki/learnings/1786116846576-a-truncated-per-page-read-can-fabricate-an-alarm-n.md)

A **wrong corpus** is a different failure that looks the same: `?per_page=100` on the
repo-wide feed (`total_count=40000`) has your target workflow occupying 1 of 100 rows, so
bumping `per_page` just buys more irrelevant rows. Ask which *population* the endpoint
enumerates before asking how much of it you got — `/actions/workflows/<id>/runs` is the
right corpus (`total=204`, pages exactly). Corollaries: group runner counts *by label set*
never aggregate; the capacity quantity is `runners × job duration`, not runner count; and a
stuck-CI discriminator tree (`status=waiting` + pending_deployments ⇒ policy gate;
`status=queued` ⇒ capacity, where busy and absent pools read identically). [A per_page bump does not fix a wrong-corpus query (GitHub Actions)](wiki/learnings/1786118180435-a-per-page-bump-does-not-fix-a-wrong-corpus-query-.md)

A wrong corpus **announces itself as EXHAUSTED, not as wrong** — "the matching rows aged
out of the 100-row window" is plausible, self-consistent, and closes the investigation. It
*mimics good practice* (stating a limit reads as rigor), so **a false bound is more
dangerous than a false figure, because reporting a bound reads as rigor and nobody audits
rigor.** The fix: attach the trigger to the *symptom* — *any time rows are missing, name
the endpoint's population before offering any explanation for their absence; missing rows
are wrong-corpus until proven otherwise.* [A wrong corpus announces itself as EXHAUSTED, not as wrong — so a false bound suppresses the follow-up a false figure would invite](wiki/learnings/1786122066488-a-wrong-corpus-announces-itself-as-exhausted-not-a.md)

`--paginate` also silently returns page 1 only when `--jq` is present; the reliable form is
manual `&page=N` until empty, unioned by id. Both this and `search/code`'s size cap are why
these APIs are unusable for *negatives*. See the flag-combination survey under the
false-negatives page.

## SHAs, blobs, and search indexing

`?head_sha=<short>` does **not** resolve abbreviated SHAs — returns `total_count:0`, HTTP
200, byte-identical to a bogus all-zeros SHA. Since this is exactly the alarm a
CI-coverage check exists to raise, a short SHA manufactures a *false negative that reads as
a coverage gap*. Resolve to the full SHA first and keep a bogus-SHA control in the same
breath. General rule: **absence of an error is not evidence a filter was honored** — any
filter you rely on for a negative needs a control value proving the filter is live. [GitHub Actions runs API: head_sha needs the FULL 40-char sha — a short sha silently returns total_count 0](wiki/learnings/1786066503112-github-actions-runs-api-head-sha-needs-the-full-40.md)

`gh api search/code` returns `total_count:0` for any string that exists **only on a
non-default branch**, no error, and `ref:<branch>` qualifiers are *silently ignored*. Since
every fix ships on a `fix/*` branch, `search/code` is structurally blind to in-flight work
— answer with `git grep` at the ref or `contents?ref=<branch>`. A same-file positive
control passes while the real query still reads 0 (the control varies only the size axis).
It also silently omits large files, so it's unusable for negatives for two independent
reasons. [gh api search/code indexes ONLY the default branch — your fix branch is invisible, and a same-file positive control does not catch it](wiki/learnings/1786124936587-gh-api-search-code-indexes-only-the-default-branch.md)

The Contents API returns `encoding:"none"` and **empty content** for files >1 MB —
HTTP 200, no error field. Piped through `base64 -d` you get a 0-byte file and every
`sed -n 'Np'` returns empty, which reads exactly like "the cited line doesn't exist." Fetch
the blob (`git/blobs/$sha`, strip newlines) instead, and **assert the byte count equals the
API's reported `size`** — one comparison converts a silent empty into a loud mismatch.
Companion: GitHub code search tokenizes, so it cannot confirm a *phrase* (6 hits, all
word-level false positives); it is a lead generator, and blast-radius claims must be
verified by reading the candidate files. [GitHub Contents API returns encoding:"none" and EMPTY content for files >1MB — no error, reads as "the line isn't there"](wiki/learnings/1786132088899-github-contents-api-returns-encoding-none-and-empt.md)

`gh api --jq` does **not** accept jq's `--arg` — it fails `unknown flag: --arg`, and inside
a loop with `2>/dev/null` every iteration errors and the output file stays empty (a clean,
plausible `0 rows`). Pipe to a real `jq` instead. Companions: `created=>=DATE` embedded in a
URL query string silently yields an unfiltered set (pass it as an encoded `-f` param); and
`assert got >= total_count` before trusting any paged sweep. **Pair every query with a
must-hit control** — in CI triage the broken-instrument zero always reads as good news. [gh api --jq does not accept jq's --arg (silent zero rows)](wiki/learnings/1786091512952-gh-api-jq-does-not-accept-jq-s-arg-silent-zero-row.md)

## `success` rollups and check-run states

A `success` combined status can sit on a commit with **zero check-runs and zero
check-suites** — the only reporters being external status contexts (`license/cla`,
`CodeRabbit`), so nothing was ever built. Distinct from the docs-only "34/36 skipped" case:
here the jobs *do not exist at all*, so any jq iterating `check_runs[]` yields an empty set
and "no failures found" renders as success. **Gate on a nonzero count of non-skipped
check-runs, not on the absence of failures.** Three controls made the finding attributable
rather than a broken-CI guess: cross-head (prior head had 48 runs), repo-wide liveness
(100+ runs after the push), and push-registered (external statuses posted, so the ref update
was observed). [A `success` combined status can sit on a commit with ZERO check-runs — count runs, don't read the rollup](wiki/learnings/1786066992116-a-success-combined-status-can-sit-on-a-commit-with.md)

Post-outage recovery: **only a fresh terminal success in the class you gate on can
authorize action** — cheap GitHub-hosted checks recover first and manufacture survivor bias.
Filter `steps>0` and treat an empty result as a broken probe (doc-only `skipped` runs have
`runner_name=None`, zero steps). `steps=0` on a `failure` means *untested*, not broken (an
`actionlint` red with `steps:0` was an outage artifact; rerun → immediate success). And a
green 45-check-run rollup can still time out of the merge queue on a stuck *commit status*
— query both `/check-runs` and `/status`. [Post-outage: only a terminal success in the GATING class authorizes reruns](wiki/learnings/1786062123477-post-outage-only-a-terminal-success-in-the-gating-.md)

`check-pr-label` reds go **stale** on a `labeled` event: adding the missing label re-runs
the workflow green on the same SHA, but the original failing row stays attached, so
`filter=latest` returns *both* rows (same name, different `run_id`). Group by
`(pr, workflow_id, event, name)`, take newest by `started_at`, and require the backing run
to be `completed` and the newest run id. Check the *live label set* before trusting a
`check-pr-label` red, and identify a bare job name by its workflow **path** (`review`
resolves to `claude-pr-review.yml` and exists in two workflows). [check-pr-label/label reds go stale on a 'labeled' event — filter=latest returns BOTH the red and the green](wiki/learnings/1786097842024-check-pr-label-label-reds-go-stale-on-a-labeled-ev.md)

A **currency filter** can make a red PR jump 0→N with no new break: a check-run group is
counted CURRENT only if its backing run is `completed`; a run in flight at sweep 1 has its
8 failure rows correctly excluded, then all 8 become current at once when it goes terminal.
"0→8 in two hours" reads like an urgent multi-platform regression but is an artifact of
*when you looked*. Discriminator: same head SHA + a failing run whose `run_started_at`
*predates* your earlier sweep ⇒ you're watching a run land, not a new break. [A currency filter can make a red PR jump 0 -> N with no new break](wiki/learnings/1786170103814-a-currency-filter-can-make-a-red-pr-jump-0-n-with-.md)

An expired job log (**151 B / rc=1 / HTTP 410**) makes its own must-hit control score 0 —
the zero is *unreadability*, not absence. Check `rc` and `size` and classify the size first
(Falcor logs: ~309 KB real, ~2.2 KB GitLab bridge, 151 B expired, 215 B / rc=0
BlobNotFound). Related: **a field correct inside its window is silently wrong outside it** —
`steps[]` past ~7d retention returns `[]` (reads as untested), `git log --follow` past a
graft returns the graft's date, `totalCount` beside a filtered list returns the *unfiltered*
total. **Write a rule's domain in the same sentence** ("`steps==0` means untested *within
retention; past it, unknown*"), pair the field with an independent witness, and store the
derived bucket not the perishable raw row. [A 151 B / HTTP 410 job log makes its own control score 0 — the zero is unreadability, not absence](wiki/learnings/1786097853694-a-151-b-http-410-job-log-makes-its-own-control-sco.md) [A field correct inside its window is silently wrong outside it — state the domain with the rule](wiki/learnings/1786119402065-a-field-correct-inside-its-window-is-silently-wron.md)

## Merge-queue and run-list traps

The merge-queue branch name is `gh-readonly-queue/master/pr-<N>-<sha>` where the trailing
SHA is **the base the batch was built on**, not PR N's head — so the same SHA appears under
different `pr-N` names, and a wake payload blaming "the PR named in the branch" misfires
whenever batches stack. A batch tip becoming the *next* batch's base is positive proof the
queue *advanced* past that PR. `RemovedFromMergeQueueEvent.reason` vocabulary: `merged`
(normal removal, **not** an eviction — outnumbered evictions 6-to-2 in 24h), `failed_checks`,
`checks_timed_out`, `manual`. Compare `enqueuedAt` vs `run_started_at` before attributing;
sibling batches at the same `run_started_at` on the same base are a near-perfect flake
control. [merge-queue branch name is pr-N-BASEsha, not the PR's own sha — and the batch tip becoming the next batch's base proves the queue ADVANCED](wiki/learnings/1786105103694-merge-queue-branch-name-is-pr-n-basesha-not-the-pr.md)

`mergeQueueEntry.state == "UNMERGEABLE"` is not a trigger: two PRs carried the identical
string and needed opposite responses — discriminate on `headCommit` (`null` + nothing
terminally failed ⇒ speculative-stacking backpressure, WAIT; `<sha>` + newest run
terminally failed + entry live ⇒ sanctioned rerun). The green head rollup, approval, and
empty removal timeline carry *zero information* for this question. The better dynamic rule:
`UNMERGEABLE` at position N>1 is *inherited* and should self-clear — **the state alone isn't
the anomaly; the state surviving its cause is.** Generalizes: for any inherited/derived
state, ask "has this state outlived what produced it?" [UNMERGEABLE in a merge queue is not a trigger — discriminate on headCommit, and treat "state outliving its cause" as the real anomaly](wiki/learnings/1786107684232-unmergeable-in-a-merge-queue-is-not-a-trigger-disc.md)

A **newest-first `gh run list --limit N` cannot see a stuck run** — the blocker in a
starvation problem is by definition OLD, keeps accumulating newer runs above it, and sinks
past any fixed `--limit`. The gate's own server-side enumeration has no page limit, so *my
population and the gate's population were different populations.* A correct filter
(including `waiting`, a real active state) over a truncated population still returns a false
zero, and a false zero is reassuring. Bound the population (`--limit 100` + select on all
three active states), or better read the server-side component's own decision line. [A newest-first `gh run list --limit N` cannot see a STUCK run — the blocker is old, so a page window is guaranteed to miss it](wiki/learnings/1786195218651-a-newest-first-gh-run-list-limit-n-cannot-see-a-st.md)

A wrong `--workflow <name>` returns *another workflow's stale runs* instead of erroring:
`--workflow retry-yielded-bot-ci.yml` (nonexistent; real file `ci-retry-yielded-bot.yml`)
returned a tidy list whose newest row was 6 weeks old. **The tell is a plausible but
suspiciously-old result set** — resolve the filename first with `git ls-tree`. Same atom:
*"CAN fail to happen" is not "WILL NOT happen"* — a note that a mechanism *may* expire
unrerun does not license "it will not clear until a human acts"; a negative-possibility
claim and a negative-certainty claim need different evidence (one observed miss vs
structural impossibility). ["CAN fail to happen" is not "WILL NOT happen" — and a wrong --workflow name returns another workflow's stale runs instead of erroring](wiki/learnings/1786193954308-can-fail-to-happen-is-not-will-not-happen-and-a-wr.md)

## Number-space, issue/PR, and commit-existence

Issues and PRs share one number counter per repo, and **`gh issue view <n>` succeeds on a
PR number** (returns a normal `{"state":"OPEN"}`), so it cannot discriminate — a census
concluding "these are all issues" from it is unfalsifiable. The discriminator is
`gh pr view <n>`, which *errors* on a true issue; always pair with a positive control so a
blanket auth/network failure can't masquerade as "all issues." Don't derive object kind from
a name, and an issue→PR `n+1` guess lands on a *real but wrong* object. [gh issue view succeeds on PR numbers — it cannot discriminate issue from PR](wiki/learnings/1786195554640-gh-issue-view-succeeds-on-pr-numbers-it-cannot-dis.md)

The Commits API distinguishes **422 (unpushed: `No commit found for SHA`) from 404
(repo-unreachable)** on the same endpoint — opposite meanings. Writing a reachability test
as "404 ⇒ unpushed" makes a typo'd repo, private repo, or revoked token read as "this
commit exists nowhere" for *every* SHA, a false positive on the exact question whose wrong
answer destroys data. The local half is safer: `git branch -r --contains <sha>` returns
empty (exit 0) for local-only but errors *loudly* (exit 129) for a missing object — provided
you check the exit code. Same shape as the topology-is-not-risk error it corrects: **one
output value covering several states.** [GitHub commits API: 422 means unpushed, 404 means repo-unreachable — do not conflate them in a reachability test](wiki/learnings/1786197539234-github-commits-api-422-means-unpushed-404-means-re.md)

A **frequency ranking over a 7d window cannot answer "should someone act now"** — a defect
fixed on day 2 still ranks #2 on day 7. A `SLANGWIN5 spirv-val 0/866` signature ranked #10
of 40 reruns and drew a "pull the runner from the pool" recommendation *after* its tracking
issue had closed `completed` 3 days earlier with zero occurrences since. Print `LAST`
alongside `n` for every bucket, resolve every tracking identifier and read its state
(`closed` inverts the recommendation), and keep the frequency question and the action
question on separate windows. Note `pulls/N` 404s for an issue number; `issues/N` serves
both. [A frequency ranking over a 7d window cannot answer "should someone act now" — check each signature's LAST fire and whether its tracking issue is CLOSED](wiki/learnings/1786199392008-a-frequency-ranking-over-a-7d-window-cannot-answer.md)

## The GitHub Actions monitoring substrate can itself be stale

`GET /actions/runs?event=schedule` served a **4h-old row as "newest"** — correctly
descending, no error, fully self-consistent — while the same query with a different
`per_page` returned the current row. Silent staleness in the *monitoring* substrate is
worse than in the monitored system, because it manufactures findings (the stale row read as
"stall now 4h+", escalating a healthy system). The detector costs one extra call: issue the
same query twice with different `per_page` and compare `total_count`; a mismatch means two
index snapshots. The reusable meta-lesson: **a pre-registered cheap detector beats post-hoc
reasoning** — write down the cheapest one-line test that would have caught a surprising
result, because the failure mode arrives when you're least suspicious. [A pre-registered cheap detector beats post-hoc reasoning — and the GitHub Actions API serves stale indexes](wiki/learnings/1786088344043-a-pre-registered-cheap-detector-beats-post-hoc-rea.md)

## Concurrency-group eviction erases its own evidence

A run evicted by a GitHub Actions `concurrency:` group **never enters `queued`** — it goes
straight to `cancelled`. So polling `status=queued` for eviction victims can't work: the
harm deletes the rows from the exact list you search, and *the more starvation there is, the
emptier the query looks.* Before trusting a scan for victims of mechanism M, ask "what does
a victim look like *after* M has acted on it?" and filter on a field M doesn't touch: count
`conclusion=cancelled` vs a base rate (1/95 quiet vs 2 of 5 saturated), and
`/runs/<id>/jobs` → `total_count:0` proves eviction-before-start. Two further principles:
**a dead instrument is not an unmeasurable quantity** (`run_started_at == created_at` reads
0 always, but the same queue-wait was one level down: job `started_at` − run `created_at`);
and **a control that runs only pre-publication has a blind spot the size of everything
already shipped** — re-run controls against your own published all-clears. [Concurrency-group eviction hides starvation from queue polls (and job started_at is the working queue-wait instrument)](wiki/learnings/1786185398615-concurrency-group-eviction-hides-starvation-from-q.md) [A concurrency eviction deletes its victims from the queue you search — and a dead instrument is not an unmeasurable quantity](wiki/learnings/1786185715359-a-concurrency-eviction-deletes-its-victims-from-th.md)

Distinguish **"nothing starved" from "no demand"** via a baseline latency job. An empty
`status=queued` CI query during zero demand (Saturday cron, no pushes) tells you nothing
about whether the pool would serve demand. Find a high-frequency job on the *contended*
label and compare start latency now vs history: `check-changes` went 2-8s → 24 min, a
measured ~300× regression proving the pool refuses work independent of whether any PR is
open. Plateau-at-N `in_progress` + no incident (`githubstatus.com/…/unresolved.json`) =
concurrency cap, not outage. Queued jobs report `started_at == created_at` (a placeholder) —
use `created_at`. And a stale tempfile can fake a stale-index alarm; check tempfile mtimes.
[Saturation: distinguish 'nothing starved' from 'no demand' via a baseline latency job](wiki/learnings/1786178547975-saturation-distinguish-nothing-starved-from-no-dem.md)

## Discord message cap

`discord_send_message` caps `content` at **2000 characters**, and the 400 error
(`code 50035`) *misreports* the bound — it echoed "4000" then "2000" on successive
attempts, with the number varying by payload length, inducing a wrong trim target that
degraded a support answer round by round. **Treat 2000 as the only true number regardless
of what the 400 says**, and prefer splitting to trimming (a `file:line` citation is what
makes a support answer trustworthy). `wc -m` returns *bytes* with no locale; measure with
Python `len()` on the UTF-8 string. Meta-lesson: the cap was already recorded in a task-end
ledger that is never loaded at session start — *an audit trail is not a memory.* [Discord message cap is 2000 chars — and the 400 error misreports the bound](wiki/learnings/1786205589314-discord-message-cap-is-2000-chars-and-the-400-erro.md)

## Compare directions, draft-PR silence, and stale-artifact stories

`gh api compare/<A>...<B>` reports `ahead_by`/`behind_by` **for B relative to base A** — so
`compare/<branch>...master` returning `ahead_by:282, behind_by:4` means the *branch is 282
behind*, not 4, and one call read in isolation states staleness backwards by two orders of
magnitude (the numbers are symmetric, so the output looks equally plausible either way).
Prefer an unambiguous local count: `git rev-list --count <merge_base>..origin/master` (take
`merge_base` from `.merge_base_commit.sha`, not the ref name), and restrict to changed files
to decide whether a rebase is *material*. `git merge-tree --write-tree` detects textual
conflicts with no worktree mutation but says nothing about *semantic* interaction; the compare
API caps `.files` at 300. [gh compare behind_by/ahead_by are relative to the FIRST ref — one call cannot tell you who is behind](wiki/learnings/1786065585317-gh-compare-behind-by-ahead-by-are-relative-to-the-.md)

**Draft PRs have NO formatting instrument** — `extras/formatting.sh` exits 0 when it *cannot
run* (clang-format absent from the container, so the C++ arm never runs), and `check-formatting`
is `skipped` on a draft. Two silent instruments read exactly like "formatting is fine"; it is
*unmeasured*. Proof-of-run for the C++ arm is the version line (`found clang-format 17.x,
required [17, 18)` — a half-open, max-*exclusive* gate, so repo docs saying "17-18" are wrong),
not the exit code. Report formatting as **UNVERIFIED, never "clean", when either instrument was
silent**, and don't chase a local install to manufacture a green (the pin matters — 9 of 1489
files differ between clang-format 17 and 18). The generalization: before trusting any green or
zero, ask *what would this print if it had measured nothing at all?* [Draft PRs have NO formatting instrument — formatting.sh false-greens locally and check-formatting skips remotely](wiki/learnings/1786062180500-draft-prs-have-no-formatting-instrument-formatting.md)

**A fresh success refutes any "stale artifact" story** — 54 `test-slang-rhi` check-run rows
claimed to be "pre-refactor artifacts" were refuted by one observation: *3 had conclusion
`success`, and a stale artifact cannot produce a fresh success.* Two defects produced the
false claim: a bad grep (grepping only the *caller* workflow — a check-run `<caller> /
<called>` means the job is defined in the *called* workflow; `grep -rln` over all of
`.github/workflows/` found it) and a bad substring filter merging two populations
(`'aarch64' in name and 'rhi' in name` unioned live and dead callers). **Before calling any
row stale/artifactual, check its conclusion distribution — any `success` kills the story** —
and never let a substring match stand in for a structural key. Bonus: 4 cancelled jobs with 4
distinct `completed_at` stamps = 4 independent timeouts (elapsed times predicted the configured
`timeout-minutes` before reading them — a prediction that lands beats a post-hoc match). [A fresh success refutes any "stale artifact" story — and grep across uses: targets, not just the caller](wiki/learnings/1786171009178-a-fresh-success-refutes-any-stale-artifact-story-a.md)

Two CI-evidence rules: **a rerun still `in_progress` cannot support "cleared on rerun"** (an
issue body said "cleared on rerun (attempt 2)"; re-measured, the attempt-2 job was
`status=in_progress, conclusion=null`, started 15 min *before* filing — the control is a
known-terminal sibling job returning `failure`, which proves `null` means "not finished" not
"couldn't see it"). Guard trigger is the *wording* ("cleared / passed on retry / self-healed")
— `gh api …/jobs/<id> --jq '{status,conclusion,completed_at}'` at that moment; `status !=
"completed"` ⇒ write "in flight, outcome unknown." And **"logs past retention" bounds ONE
artifact, not the evidence** — check-run *metadata* outlives logs, and a contemporaneous chain
memo written inside retention may hold the payload (state the two provenances *separately* —
the leg failure is re-fetchable, the memo claim is not). ID-type trap: a check-*suite* id 404s
on `/actions/runs/<id>` but resolves at `/check-suites/<id>`. [A rerun still in_progress cannot support "cleared on rerun" — and an aged-out log does not void a record written inside retention](wiki/learnings/1786135678017-a-rerun-still-in-progress-cannot-support-cleared-o.md)

**A carry-forward note can silently outlive the fact it describes** — a maintainer-rotation
answer had landed as the *newest* message in the channel, yet three consecutive daily reports
re-asserted "pending (asked 08-03)" because each run read the *carry-forward note* instead of
re-reading the *source channel*. A stale "pending" and a genuinely-unanswered ask are textually
identical in a summary. **A carry-forward note is a cache, and caches go stale silently; for
any "still pending / still unanswered / still open" claim, re-read the primary source before
repeating it.** Two traps: a negative/absence claim decays fastest (the falsifier arrives
*later* than the note), and check the newest N messages not just your 24h window (an answer
predating the window but postdating the note makes the stale claim look confirmed) — including
`referenced_message` for threaded replies. [A carry-forward note can silently outlive the fact it describes — re-read the source, not your own summary](wiki/learnings/1786177704297-a-carry-forward-note-can-silently-outlive-the-fact.md)

## jq: the dot rebinds inside `index(...)`

`jq '.threads[] | select(["id1","id2"] | index(.parent_id))'` looks right and returns **zero**
— inside `index(...)` the input `.` has rebound to the array literal on the left of the pipe,
so `.parent_id` tries to index that array. jq writes the error to stderr and prints nothing to
stdout, so a `cnt=$(echo "$ids" | grep -c .)` pipeline yields `0` — **byte-identical to "there
genuinely are no matches"** (it turned a 31-thread Discord sweep into "0 threads → all quiet").
Fix by binding the field first (`.parent_id as $p | select($M | index($p))`). Two defenses that
caught it: **guard on the enumeration count** (`[ "$cnt" -eq 0 ] && { echo ABORT; exit 1; }` —
a legitimately-empty enumeration is rare enough that aborting beats a false all-clear), and a
**positive control** (re-run the same path with a deliberately permissive parameter and require
>0 hits). Verify the JSON shape before writing paths — many endpoints return a bare array where
`.threads[]` would fail the same silent way. [jq: inside index(...) the dot rebinds — a parent_id filter silently returns zero](wiki/learnings/1786058282680-jq-inside-index-the-dot-rebinds-a-parent-id-filter.md)
