---
title: "GitHub Actions & merge-queue CI: workflow ids, phantom red/green, eviction attribution, rerun bias"
type: concept
group: general
tags: [github-actions, ci, merge-queue, workflow-id, phantom-red, rerun, self-hosted-runner, eviction]
source_count: 20
---

## TL;DR

CI triage against the Actions/merge-queue API is a minefield of well-formed wrong answers:

- **A workflow rename mints a NEW Actions id**; per-id run history truncates silently at the
  rename (indistinguishable from retention). Read `state`, never derive it; follow
  `previous_filename` to find where history lives.
- **A complete population can be the wrong population** — a bound test (`total==returned`) that
  passes says nothing about whether the id spans your claimed window.
- **Phantom-red/green** needs *suite-level* grouping keyed on `(PR, workflow, event, job-name)`
  and *suite* `created_at` — job names are not unique across workflows, and name-keyed dedup
  fails **open** (hides reds).
- **A merge-queue eviction happens on the `beforeCommit`, not the PR head** — a green head is
  the *expected* post-eviction state. Read `RemovedFromMergeQueueEvent.beforeCommit.oid`; check
  both check-runs AND commit statuses there; never attribute a cause that postdates the eviction.
- **A windowed ratio describes the window, not the day** — and it biases toward whatever the
  recent rows say, over-reporting live defects and under-reporting resolved ones. Print bounds.
- **Rerunning the same run is biased toward the box that just failed it**; stop after 2. But
  reruns *do* work — a rerun is a pool draw and often escapes.
- **`run.created_at` is attempt-1's stamp** — reruns are invisible to a `created_at` window;
  key on the job's `started_at`.

## A workflow rename mints a new id; read state, never derive it

Renaming a workflow file mints a new Actions id and retires the old one — but **both
lifecycles occur**: the retired id may go `state: deleted` and drop from the listing, *or* stay
`active` but dormant with its job's history moved elsewhere. File-absence does not predict
`state` (both files 404 at master, states differed). **Read the `state` field; never derive
it.** The error shape: a lifecycle transition inferred from an observed effect ("the job runs
under a new id" ⇒ "the old id must be gone") when *going quiet* is equally compatible. Cost:
a peer cited the absolute version and concluded a control counting non-active workflows was
*inert*, nearly "fixing" a latent gap it wrongly believed undetectable — **a wrong stored fact
is worse than a missing one, and a fact that licenses skipping a check deserves *more*
scrutiny, not less.** Enumerate by filename across `previous_filename` (renames chain), never
by the `actions/workflows` listing. [A workflow rename mints a new Actions id; the old id MAY go state:deleted and vanish from the listing — read the state field, never derive it](../learnings/1785882085230-a-workflow-rename-mints-a-new-actions-id-the-retir.md) [GitHub Actions workflow id is NOT stable across a rename — per-id run history truncates silently](../learnings/1785899745853-github-actions-workflow-id-is-not-stable-across-a-.md)

**A complete population can be the wrong population.** `workflows/304423282/runs?per_page=100`
→ `total_count 36 == 36 returned` (COMPLETE ✅) → status=success 0 → headline "never completed
successfully in retained history." False — 16 successes existed under the pre-rename id. The
tell was in data already held: `created_at` was two seconds after the only commit touching the
file (a rename). A completeness check answers "did I get all rows of this query?" — never "is
this query's subject the thing I'm claiming about?" It's the dual of the stale-but-valid
control. Corollaries that recur: **a ≥N floor can hedge in the wrong direction** (`previous_filename`
made it exactly 36 with a known start — a bisect boundary — where "≥36, cannot tell" discards
the most actionable fact); a **line count is not an entry count** (195 lines = 155 comments +
16 blank + 24 entries); a `cancelled` night is **untested**, neither pass nor fail, so segment
by conclusion before quoting any streak. [A complete population can be the wrong population — GitHub workflow renames mint a new Actions id](../learnings/1785882545559-a-complete-population-can-be-the-wrong-population-.md)

## Phantom red/green: group at suite level, key on workflow not job-name

The stored rule "group check-runs by name; a newer same-named success ⇒ phantom" misses when
one sha carries two different *suites* whose check-run names differ — grouping one level up at
**workflow-run name** makes supersession obvious. Run the detector at suite level
(`actions/runs?head_sha=<FULL sha>`, group by `run['name']`, compare newest run vs newest bad
run). Pair with the full-sha requirement, or a truncated sha turns the detector into an
all-green machine. [Phantom-red needs SUITE-level grouping, not check-run-name grouping](../learnings/1785881696784-phantom-red-needs-suite-level-grouping-not-check-r.md)

Deeper: the filter must key on `(PR, WORKFLOW, event, job-name)` because **job names are not
unique across workflows** — `build (windows, release, cl, x86_64)` comes from three distinct
workflows, and name-keyed dedup pairs a `check-formatting` *failure* with a *Check Table of
Contents* success. 3 wrong dismissals of 18 (~83% right — which is what makes it dangerous),
and it fails **open** (hides reds, retiring the question). `filter=latest` is latest *per
check-suite*, not newest-per-name — both suites survive. Resolution order: enumerate all rows
via `check_name=`; resolve each `run_id` → workflow name AND event; a success clears a failure
only when workflow AND event match; compare *suite* `created_at`, never check-run `started_at`
(a re-run failure gets a newer `started_at` than the success it should lose to). Cheap
invalidity tell: the failure and its "clearing" success have different workflow names.
[Phantom-green filter must key on (PR, WORKFLOW, job-name) — job names are not unique across workflows](../learnings/1785946739283-phantom-green-filter-must-key-on-pr-workflow-job-n.md)

Two more Actions instrument defects that manufacture false negatives: `actions/runs?head_sha=`
is **exact-match** (an abbreviated sha → `total_count: 0`, no error — used to wrongly conclude
"fork PR runs aren't indexed"; the full sha returned 29 rows); and a run's `created_at` is
attempt-1's timestamp, so **reruns are invisible to a `created_at` window** (a suspect runner
vanished from its own pool, re-keying on the job's `started_at` restored the signal). Both
return well-formed JSON with a plausible number, and in both cases the wrong answer supported a
conclusion the investigator already found attractive. A peer's negative result is a claim about
their probe — reproduce it before adopting *or* disputing.
[Two GitHub Actions instrument defects that manufacture false negatives: head_sha is exact-match, and run created_at hides reruns](../learnings/1785906655238-two-github-actions-instrument-defects-that-manufac.md)

## Merge-queue eviction: read beforeCommit, compare timestamps

A `failed_checks` eviction and a green PR head are **not contradictory — they describe
different commits.** The merge-group commit (`beforeCommit`) is a distinct merge commit
exercising a surface the head never does; a failure there evicts while leaving head checks
green — so "head is green" is the *expected* post-eviction state, not evidence against
eviction. Take the sha from `RemovedFromMergeQueueEvent.beforeCommit.oid` (never the
`gh-readonly-queue/…/pr-N-<sha>` branch name — that trailing sha is the BASE, green by
construction). When two of your own verified findings appear to contradict, the likeliest
resolution is they measure different objects — name the object each fact is about.
[A green PR head and a failed_checks eviction are not contradictory — check beforeCommit, not the head](../learnings/1785940024410-a-green-pr-head-and-a-failed-checks-eviction-are-n.md)

An eviction can come from a **commit STATUS, not a check-run** — the two are independent APIs.
`#12328` was evicted with every check-run green; the cause was `SlangPy Tests` (a cross-repo
commit status) failing 31s before. A CI sweep must read BOTH `commits/<sha>/check-runs` AND
`commits/<sha>/status`. Get the reason from GitHub (`RemovedFromMergeQueueEvent.reason` —
`merged` = healthy exit, `failed_checks` = real eviction), and an eviction happens on the
merge-group commit which is nobody's PR head (a head-sha-only loop never queries it).
[Merge-queue failed_checks eviction can come from a COMMIT STATUS, not a check-run — check both surfaces](../learnings/1785874799588-merge-queue-failed-checks-eviction-can-come-from-a.md)

**Never attribute a cause that postdates the eviction.** Teardown artifacts (`cancelled`
siblings) postdate the eviction — a subagent confidently proposed a `cancelled materialx` job
as the sole evictor, but materialx *started* 12 minutes after the eviction. Only jobs/statuses
completing *before* the eviction instant are candidate causes; use `started_at` vs the event.
A subagent's confident "your memory is wrong" is a claim about its analysis — reproduce its
load-bearing step (here, one timestamp comparison it never ran) before overwriting a stored
fact. [Check a proposed cause against the eviction TIMESTAMP before accepting it — teardown artifacts postdate the eviction](../learnings/1785910481818-check-a-proposed-cause-against-the-eviction-timest.md)

**An eviction that "recovered on its own" — read the enqueuer, not the elapsed gap.** An
eviction → re-add with no bot action between looks self-healing; one field refuted it
(`AddedToMergeQueueEvent.actor = skiminki-nv`, the human author; `autoMergeRequest = null`, so
GitHub *could not* have requeued). The ~11h was an overnight human wait. A remembered
~15h auto-requeue constant lent false corroboration to an unmeasured claim. **Recovery is not
evidence of zero cost** — a flake billing a maintainer one manual re-add per occurrence is
exactly the number that makes the case for fixing it.
[A merge-queue eviction that "recovered on its own" — read the enqueuer, not the elapsed gap](../learnings/1785910832443-a-merge-queue-eviction-that-recovered-on-its-own-r.md)

Single-job rerun is **impossible while the run is `in_progress`** — `POST jobs/{id}/rerun`
returns 403 "already running" when any sibling job is still going. This is a state
precondition, not a permissions problem (don't conclude your token lacks `actions:write`).
Arm a monitor on run completion and fire `gh run rerun --failed` then. Bank the *intent*
without charging a rerun-cap slot — nothing was dispatched.
[Single-job rerun is impossible while the run is in_progress (403) — bank the intent, arm a monitor](../learnings/1785845763361-single-job-rerun-is-impossible-while-the-run-is-in.md)

## Windowed ratios, rerun bias, and pool-vs-job-scoped

A pass-fail ratio from one `per_page=100` listing describes **the window that listing
happened to cover** — width is a function of repo traffic (100 runs ≈ 68 minutes in a busy
repo), varying silently between sweeps. Strictly worse than a windowed zero: a ratio reads as
a *measurement*, fluent and quotable with a denominator attached. A truncated window has **no
fixed lean** — it inherits the recent period's verdict, so it over-reports a LIVE defect (the
passes fell off the end) and under-reports a RESOLVED one. Print the bounds beside every ratio;
`count >= per_page` is the truncation tell (`>=`, not `==`); ask which direction truncation
would push *this* claim before someone else finds out.
[A pass-fail RATIO from one per_page=100 listing describes the WINDOW, not the day — and it fails toward the indicting answer](../learnings/1785926557981-a-pass-fail-ratio-from-one-per-page-100-listing-de.md) [A truncated window has NO fixed lean — it biases toward whatever the recent rows say, so it over-reports live defects and under-reports resolved ones](../learnings/1785926828843-a-truncated-window-has-no-fixed-lean-it-biases-tow.md)

Before asking to reboot a "sick" self-hosted runner, re-slice the same box across **other job
types**: SLANGWIN5 read 0/4 on `test-compile-regression` but had 20 successes on
benchmark/falcor/falcor-perf in the same window ⇒ the defect is **job-scoped, not
host-scoped** — remedy is "reprovision the tool", not "reboot the box", and the runner-health
trigger correctly does not fire. Job-scoped + a runner label that is a *pool* ⇒ a rerun can
land on a different box and is worth firing. Order pool/frequency work by the job's
`started_at`, not the run's `created_at`. [A windowed job-vs-host ratio: check the SAME BOX on OTHER job types before asking for a reboot](../learnings/1785932377716-a-windowed-job-vs-host-ratio-check-the-same-box-on.md)

`gh run rerun --failed` on an already-failed run is **not a fair pool draw** — three attempts
at an unchanged head all drew the same defective SLANGWIN5, while fresh dispatches that day
were near-uniform over the 3-box pool. But the affinity is a *tendency, not a rule* (4 of 7
rerun draws escaped to a healthy box on the correct narrow population) — **this finding must
always travel with "reruns do work"**; a 4-of-7 tendency caps attempts, it does not stop
rerunning. Stop after 2 attempts on the same run; a third likely redraws the same box. Two
correction lessons of lasting value: **the denominator's *definition* is part of the figure**
(three defensible populations gave 0.57 / 0.67 / 1.00 — publish the selection rule or the
number is unauditable); and a "3-point monotonicity ⇒ treat as a floor" caution was FALSE —
three points establish no direction, and "floor" is a trend claim wearing a safety label. A
fresh dispatch is not a clean draw either (attempt 1 drew the defective box), and "a rebase
produces one" fails on a fork PR where no bot can push. [Rerunning the SAME run is biased toward the box that just failed it — not a fair pool draw](../learnings/1785861722411-rerunning-the-same-run-is-biased-toward-the-box-th.md)

`run_attempt - 1` is NOT a valid proxy for your own rerun count — the `nv-slang-bot[bot]`
identity is **shared** (by peer coworker agents authoring the PR, and by token-based in-repo
retry automation), so `triggering_actor` cannot attribute a rerun to you even after excluding
every workflow in the repo. Your own write-time ledger is the only sound cap ledger; never
reconcile it upward to match the API. The discriminator is a **timestamp** (your logged
decision time vs the attempt's `created_at`), never an identity — and a workflow's presence in
the tree is not evidence it fired (a `state=active` retry workflow had been dormant 6 weeks).
A cap keyed on *your* actions does not bound total reruns when a co-authoring coworker shares
your identity. [run_attempt-1 is NOT a valid proxy for your own rerun count — the bot identity is SHARED (see amendment: by peer coworkers, not by the retry workflows)](../learnings/1785874822609-run-attempt-1-is-not-a-valid-proxy-for-your-own-re.md)

## Judging "workflow stopped firing" and other Actions triage

"No run in N days" is not evidence a workflow is dead: read `state`
(`active`/`disabled_inactivity`/`disabled_manually`) and compare the declared cron against
observed timestamps — a *weekly* cron makes a 4-day gap expected. A *chronically failing*
workflow is a separate finding from a *non-firing* one; varying failure identity argues against
a single root cause. `?event=merge_group&per_page=100` is a ~32-hour window (each queue entry
fans out into ~7 runs), and a mixed tally is meaningless — filter to the gating workflow before
tallying. For merge-queue failures: check `runner_name` on every failing job (a per-runner
fault vs a code regression) and whether the PR merged later on a subsequent attempt (the
signature of flaky gating). `/actions/jobs/<id>/logs` needs auth (403 unauth); names and
`runner_name` are available. [GitHub Actions: judging "workflow stopped firing" and sizing a merge_group window](../learnings/1785899204426-github-actions-judging-workflow-stopped-firing-and.md)

A precheck's "latest failure" row may not be the scheduled run your watch waits for: a red
`workflow_dispatch` run on a `ci/cts-bisect-<PR>` branch is a maintainer's bisect, not the
nightly. Re-fetch the run list and filter on `event=schedule` AND `head_branch=master`
yourself — one call disambiguates even when both are red (the trap: the verdict agrees either
way). A cluster of `workflow_dispatch` runs on `ci/…-bisect-<PR>` branches means a human is
already bisecting — report as FYI, don't file an issue.
[A precheck's "latest failure" row may not be the scheduled run your watch is waiting for](../learnings/1785927321717-a-precheck-s-latest-failure-row-may-not-be-the-sch.md)

`.conclusion` at run level reports only the LATEST attempt and masks earlier failures —
enumerate `runs/<id>/attempts/<n>/jobs` when attempt history matters. A job failure inside a
merge-group run does not imply the PR was evicted (a retry on a healthy runner can rescue it
in-queue); occurrence counts and eviction counts measure different things. (These two live in
[Two verification failures no store audit can catch: compression drop and magnitude-preserving attribution error](../learnings/1785918806752-two-verification-failures-no-store-audit-can-catch.md).)

## Key a root-cause lookup on the ENTITY, and re-read a head SHA after your push

Key a root-cause memory lookup on the **entity** (PR/issue/commit id), not the symptom's
signature. The #12328 eviction was re-derived to a *refuted* materialx cause 90 minutes after
refuting it, because the lookup asked "what is a cancelled materialx job?" (routing to a
signature file silent on #12328) rather than "what evicted #12328?" (the index line names the
commit-status cause). Two properties made it survive: the symptom-keyed file was *genuinely
relevant* (materialx really misbehaved — a true finding about a different question), and the
story was *sufficient* (sufficiency feels like confirmation). **A file that doesn't mention your
entity has not answered your question**, even when it perfectly explains your symptom; entity
keys are unique, signatures are shared across unrelated causes. Cross-link bidirectionally so
the wrong retrieval path self-corrects. [Key a root-cause memory lookup on the ENTITY (PR/issue number), not the symptom's signature](../learnings/1785882088736-key-a-root-cause-memory-lookup-on-the-entity-pr-is.md)

A head-SHA read **expires the moment you push** — re-read after the push, never carry a pre-push
reading into a report. One rule covers two distinct causes producing identical symptoms: API
replication lag (a `gh pr view` ordered *after* a successful push returned the pre-push SHA,
agreeing seconds later) and read-before-push ordering (cost a peer ~2h, misreading its own stale
pre-force-push heads as a peer collision). "The API lags" prescribes *wait and re-read* (fixes
only lag); "a head read expires at your next push" prescribes *re-read after pushing* (fixes
both) — **prefer the framing whose remedy covers every cause producing the symptom.** Reconcile
three sources (`git rev-parse HEAD`, `git ls-remote`, `gh pr view`); commit timestamps do NOT
discriminate the two causes — only the actual call ordering (your transcript) does. Identical
`author_date` with a later `committer_date` is the rebase marker.
[A head-SHA read expires at your next push — covers both API lag and read-before-push](../learnings/1785883974677-a-head-sha-read-expires-at-your-next-push-covers-b.md)
