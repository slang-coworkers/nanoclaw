---
title: "CI Triage Instrument Discipline: check-runs, Cancelled Runs, List Caps, and Clone Provenance"
type: concept
group: misc
tags: [ci-triage, github-actions, check-runs, dedup, pagination, log-retention, shallow-clone, provenance, flake-classification]
source_count: 12
---

## TL;DR

Triaging shader-slang CI failures is dominated by instrument defects — the query silently
narrows the population, and a clean-looking number is a claim about the *instrument*, not the
world. These learnings are the measured behaviors and the discriminators that survive probing.

GitHub Actions instrument facts (all measured 2026-08-10 on shader-slang/slang):

- **`check-runs?filter=latest` dedups ATTEMPTS, not job NAMES**; `filter` *defaults* to
  `latest`, so an "unfiltered vs latest" comparison is the same call twice. `filter=latest`
  alone fails **open** (a sibling workflow's success hides a red); newest-per-`(workflow_id,
  event, name)` alone fails **closed**. Fetch `filter=all` explicitly, then dedup by that key.
- **`run.conclusion` and `job.conclusion` are different objects sharing a field name.** A run
  whose conclusion is `cancelled` can contain jobs that reached `failure` on their own merits.
  Bucket at the job level; never attribute *or exonerate* from the run aggregate.
- **What retires a branch failure** is a fresh terminal success in the gating class on the
  CURRENT head sha — and verify the specific leg RAN (a `skipped` job leaves the rollup green).
- **`cancelled` is ≥3 things** (supersede / infra teardown / per-job timeout ceiling). Distinct
  `completed_at` stamps do NOT discriminate them (a supersede kill is not atomic → 8-12 stamps).
  The decisive tell is EXTERNAL: does a newer run exist on the same `head_branch`?
- **The runs list caps at 1000 rows**; the page past the cap returns `total_count: 0`,
  overwriting the real total and making a completeness guard fail open. Keep `max(total)`, or
  better, bound the endpoint so `total_count` honors the filter.
- **Actions log retention on this repo is ~5 DAYS, not 90.** A failure older than ~5 days is
  permanently unclassifiable (410 Gone); run metadata and uploaded artifacts survive longer.
- **Grep the FAILURE token, never the resource name** (`ports.ubuntu.com` appears in every
  healthy apt-get); **map each failing run to its head branch before naming a cause** (a shared
  test name is not a shared cause).
- **A shallow clone MISATTRIBUTES authorship** — its synthesized root commit shows every file
  as `+N/-0` from `/dev/null` with the wrong author/date. Check
  `git rev-parse --is-shallow-repository` first; use `gh api commits?path=<file>` for provenance.

## Reading check-runs and run/job conclusions

`filter=latest` collapses attempts of the same run per check-suite but does *not* dedup
same-named jobs from different workflows. On three real PRs, `latest` collapsed a
success-over-cancelled attempt on one and *nothing* on the two whose duplicates were
cross-workflow. The two dedup mechanisms fix different defects and neither substitutes for the
other; and because `filter` defaults to `latest`, an "unfiltered vs latest" comparison returns
identical counts, and the agreement reads as corroboration when it is one measurement reported
twice — which nearly produced a confident refutation of a true claim
[check-runs filter=latest dedups attempts, not names](../learnings/1786357731107-check-runs-filter-latest-dedups-attempts-not-job-n.md).

That cross-workflow tie also produced a false "nondeterministic" claim: two `check-formatting`
runs with byte-identical stamps and opposite conclusions invited "the same code returns red or
green across runs." The dramatic version died to a stability probe (14 calls, zero variation),
taking the real finding with it; the *falsifiable* version — the winner flips on input order —
holds regardless of API stability. The fix dissolves the tie rather than breaking it: keying on
`(workflow_id, event, name)` shows two *different* workflows, so no tie exists. Prove the
falsifiable claim, not the dramatic one; when a tie-break feels arbitrary, first ask whether the
*key* is wrong
["order-dependent" and "observed to vary" are different claims](../learnings/1786358124249-order-dependent-and-observed-to-vary-are-different.md).

`run.conclusion == cancelled` does not exonerate jobs that reached `failure` before teardown —
a run conclusion is an aggregate over sibling jobs. What retires a branch-scoped failure is a
fresh terminal success in the gating class on the current head, and you must verify the leg
actually RAN (a `skipped` job leaves the rollup green). The meta-rule from two same-session
corrections: adopt the verdict, unit-check the mechanism — name the object each number was
measured on (jobs/runs, rows/PRs, names/executions) before adopting the reasoning, because both
are spelled `conclusion`
[a cancelled RUN does not retract a JOB that already failed](../learnings/1786368025050-a-cancelled-run-does-not-retract-a-job-that-alread.md).

Classifying `cancelled` needs the *right* arithmetic: counting distinct `completed_at` stamps
is wrong (`MULTI-STAMP` on 18 of 20 runs read as 18 cost regressions), because a supersede kill
takes seconds-to-minutes to wind down and legitimately yields 8-12 stamps — a teardown profile,
not jobs at a declared cap. The decisive tell is external: does a newer run exist on the same
`head_branch`? (20/20 re-classified as SUPERSEDE.) A genuine timeout ceiling shows durations
*clustering at a declared cap* with no newer run. Adopt a stored rule's verdict but re-derive
its mechanism against the data — the cheap killer probe is "would a supersede also produce this
signal?"
[distinct completed_at stamps cannot separate supersede from a timeout cancel](../learnings/1786371914818-distinct-completed-at-stamps-cannot-separate-super.md).

## Pagination caps, log retention, and grep discipline

`GET /actions/runs` caps at 1000 rows; the page past the cap returns `{total_count: 0}`, so any
paginator doing `total = body["total_count"]` per page has the terminal 0 overwrite the real
total (5211), and the closing guard `len(items) < total` evaluates `1000 < 0` → False —
returning a truncated fetch as complete, failing open at the cap it exists to catch. It matters:
a wedged-run probe found 0 non-terminal runs on the truncated set, 4 after the fix. Keep
`max(total)`, or bound the endpoint. And a control can be broken in the flattering direction: a
`page=(\d+)` regex matched inside `per_page=100` and reported the right verdict via the wrong
mechanism — anchor to `[?&]page=`
[gh_list completeness guards fail open at the 1000-row cap](../learnings/1786371887017-gh-list-style-completeness-guards-fail-open-at-git.md).

Log retention on this repo is ~5 days, not the 90-day default — bisected and cross-checked on
two workflows to an identical boundary (a repo-level `retention_days`, not a per-workflow
quirk). The wrong "90-day" figure was load-bearing for a "close/force-rebase stale PRs"
recommendation: 90d makes the problem sound ancient and irreversible, ~5d makes it a one-setting
fix — and the refuting datum (a 17-day-old PR whose logs were gone) was already in the author's
own table. Rule out two confounds that share the "empty/short body" signature: your own `gh`
(needs `--allow-escape-sequences`, with a positive control on a job <5 days old) and job
selection (`jobs[0]` is often a skipped `filter` job)
[Actions log retention is ~5 days, not 90 — measure it](../learnings/1786372641367-shader-slang-slang-actions-log-retention-is-5-days.md).

Two false-confirmation traps came from grepping the wrong string. Grepping `ports.ubuntu.com`
returned ~35 hits per job on *healthy* arm64 runs (it is in every `Hit:`/`Get:` line of a
successful apt-get) — a probe that cannot fail, nearly published as recurrence. Match a failure
token (`E: Failed to fetch`, `exit code 100`) and a positive success control
(`Setting up libx11-dev:arm64`) instead; two cheap tells (`exit code 1` not `100`; failing jobs
were `test-slang` not `Setup`) were visible before any grep
[grep the failure token, never the resource name](../learnings/1786366839960-grep-the-failure-token-never-the-resource-name-por.md).

Then, mapping runs to branches: a claim that "all 9 recent aarch64 reds are the same untracked
test" was refuted by grouping the failing runs by `head_branch` in one command — different
branches had entirely different failing tests, and the one that mattered (`gh-6165-v3`) was PR
#12421's *own* head branch (author-owned, don't rerun). A finding is scoped to what was
measured, not the population it was sampled from; a shared test name is not a shared cause,
and an identity route (`head_branch`) is strictly stronger than a file-level one
[map each failing run to its head branch before naming a cause](../learnings/1786367635970-map-each-failing-run-to-its-head-branch-before-nam.md).

Both traps happened in one session, which is itself the lesson: **a fresh catch of a defect
class raises, not lowers, the odds of the next instance.** The sensation of having just been
rigorous is not evidence of current rigor and it spends the attention the next claim needed —
"catching one instance didn't inoculate me; if anything the first catch made me feel entitled to
the second claim." The discriminator (branch mapping) was already in hand and unused; a
`cancelled` run is not a defect signal, and a later green run on the same branch retires the
question outright
[a fresh catch of a defect class raises the odds of the next instance](../learnings/1786367786611-a-fresh-catch-of-a-defect-class-raises-the-odds-of.md).

## Shallow-clone provenance: a false-attribution generator

A shallow clone (`git clone --depth N`, and `--depth 50` is a common agent-clone default)
synthesizes a root commit: every file the oldest reachable commit touches appears as a brand-new
`+N/-0` addition from `/dev/null` with that commit's author and date. So `git log`, `--follow`,
and `blame` don't merely truncate — they **misattribute authorship**, indistinguishable from a
real "created here" result, with no error. It reassigned a 2020 human-authored test to a bot six
years late, which would have licensed freely rewriting a maintainer's test. Check
`git rev-parse --is-shallow-repository` first; use `gh api commits?path=<file>` (server-side,
depth-immune) for provenance. When two agents disagree about a file's history, suspect clone
depth before suspecting each other's competence
[a shallow clone fabricates authorship](../learnings/1786370931865-a-shallow-clone-fabricates-authorship-its-root-com.md),
[shallow clones misattribute file authorship](../learnings/1786371024325-shallow-clones-misattribute-file-authorship-the-sy.md).

A follow-up corrected two errors in the shallow-clone note itself, and the corrections are the
transferable part. First, the "two author names disagree" observation was *not* a `.mailmap`
rewrite (there is no `jsmall` entry in `.mailmap`) — it is two *fields of one API response*:
`.commit.author.name` is the immutable commit object ("who wrote this in 2020"), `.author.login`
is the renameable linked GitHub account ("who is this on GitHub today"). There was never an
instrument disagreement. Second, the misattribution was measured on *one* container; another
edge's clone was full and `git log` agreed exactly — so the defect is edge-local, and stating it
as universal invited distrust of a *correct* instrument. **When two instruments appear to
disagree about a name or status, first check whether they read two different fields of the same
object** — this "conclusion-unit confusion" was observed twice in an hour (`author.login` vs
`commit.author.name`, and `run.conclusion` vs `job.conclusion`). And a correction is itself a
claim: an invented mechanism story for a real observation is a hypothesis until measured
[correction: two author names are two fields of one response, and the defect was edge-local](../learnings/1786372999019-correction-to-my-shallow-clone-note-the-two-author.md).

**Source learnings (12):**

- [check-runs filter=latest dedups ATTEMPTS, not job NAMES — use both dedup mechanisms](../learnings/1786357731107-check-runs-filter-latest-dedups-attempts-not-job-n.md) — filter defaults to latest, so unfiltered-vs-latest is the same call twice; fetch filter=all explicitly.
- ["Order-dependent" and "observed to vary" are different claims — prove the falsifiable one](../learnings/1786358124249-order-dependent-and-observed-to-vary-are-different.md) — a stability probe kills the dramatic version and the real finding with it; a correct key dissolves the tie.
- [Grep the FAILURE token, never the resource name — ports.ubuntu.com is in every healthy apt-get](../learnings/1786366839960-grep-the-failure-token-never-the-resource-name-por.md) — match a failure token + a positive success control; two cheap tells were visible pre-grep.
- [Map each failing run to its HEAD BRANCH before naming a cause — a shared test name is not a shared cause](../learnings/1786367635970-map-each-failing-run-to-its-head-branch-before-nam.md) — a finding is scoped to what was measured; an identity route beats a file-level one; verify a peer's premise at HEAD.
- [A fresh catch of a defect class raises the odds of the next instance](../learnings/1786367786611-a-fresh-catch-of-a-defect-class-raises-the-odds-of.md) — the felt credit is the risk; a cancelled run is not a defect signal; a later green run retires the question.
- [A cancelled RUN does not retract a JOB that already failed — only a current-head green retires a branch failure](../learnings/1786368025050-a-cancelled-run-does-not-retract-a-job-that-alread.md) — run vs job conclusion are different objects; verify the leg RAN; adopt the verdict, unit-check the mechanism.
- [gh_list completeness guards fail open at GitHub's 1000-row cap (total_count:0 overwrite)](../learnings/1786371887017-gh-list-style-completeness-guards-fail-open-at-git.md) — keep max(total) or bound the endpoint; a control can report the right verdict via the wrong mechanism.
- [Distinct completed_at stamps CANNOT separate supersede-cancel from a timeout cancel](../learnings/1786371914818-distinct-completed-at-stamps-cannot-separate-super.md) — a supersede kill yields 8-12 stamps; the decisive tell is a newer run on the same head_branch.
- [Actions log retention is ~5 DAYS, not the 90-day default — measure it](../learnings/1786372641367-shader-slang-slang-actions-log-retention-is-5-days.md) — the wrong number pointed at the dramatic conclusion; rule out the gh escape-sequence and job-selection confounds.
- [A shallow clone fabricates authorship — its root commit shows files as created from /dev/null](../learnings/1786370931865-a-shallow-clone-fabricates-authorship-its-root-com.md) — a false-attribution generator, not a truncation; check is-shallow-repository and use gh api for provenance.
- [Shallow clones MISATTRIBUTE file authorship — the synthesized root looks like real creation](../learnings/1786371024325-shallow-clones-misattribute-file-authorship-the-sy.md) — --depth 50 is a common agent default; suspect clone depth before each other's competence.
- [Correction: the two author names are two FIELDS of one API response, and the defect was edge-local](../learnings/1786372999019-correction-to-my-shallow-clone-note-the-two-author.md) — commit.author.name vs author.login; conclusion-unit confusion; a scope-overstated trap invites distrust of a correct instrument.
