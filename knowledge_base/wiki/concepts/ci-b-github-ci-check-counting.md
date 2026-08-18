---
title: "Counting and reading GitHub CI checks: two surfaces, unstable tallies, attempt-keyed verdicts"
type: concept
group: ci
tags: [ci, github-api, check-runs, commit-status, pagination, attempts, counting]
source_count: 8
---

## TL;DR

- **GitHub CI truth lives in TWO disjoint API surfaces.** GitHub-Actions jobs land in `commits/<sha>/check-runs`; external reporters and cross-repo dispatches (`license/cla`, `SlangPy Tests`) post *commit statuses* to `commits/<sha>/status`. They can be entirely disjoint — every check-run green while the combined status is `failure`. **Green requires BOTH** `failure`-count == 0 on check-runs AND `.state ∈ {success, empty}` on status. A check-runs-only probe structurally cannot see the other surface, and the PR web UI *merges* both — so your API count will disagree with what the maintainer sees.
- **`check_runs.total_count` is none of the numbers you want.** It is not the job count, not the distinct-check count, not the build count. Re-runs *add* entries rather than replacing them, so the same SHA reports different totals over time (measured: 15 → 29 on one unchanged head; one chain published 14/15/16/28/29 for the same 14 jobs). Report `[.check_runs[].name]|unique|length` for the stable job count; latest-run-per-name for pass/fail.
- **check-runs pagination silently truncates at 100** with no error/flag — biased toward the busiest PRs (most likely to carry a real red), and it always fails *open* (toward green). Reconcile the merged length against `total_count` with `>=`, and verify the fetch returned a check-runs object (not a 502 error body) before counting.
- **A run verdict attaches to an ATTEMPT, not a run id.** A re-run keeps the same run id, head SHA, and `conclusion: failure` string while completely changing what executed (attempt 1: nothing built; attempt 2: full matrix, real reds). `runs/<id>/jobs` returns the *latest* attempt only. Write "attempt N was X", never "run <id> was X"; enumerate `attempts/<n>/jobs`.
- **`conclusion` vs `status`:** `conclusion` is empty/null for both "in flight" and "finished with no result." Use `.conclusion // "RUNNING"` and check `status == "completed"`, or an in-progress run vanishes from the tally.
- **Sum-check any decomposition** (`build` + `pre-commit` + `board-sync` + `license/cla`) against your own total, and **never describe a sparse matrix as a cross-product** — enumerate job names and count the cells that actually exist.
- **Cross-check your red set against a second, independent instrument** (`statusCheckRollup`); a fix verified only by the instrument that produced the bug is unverified.

---

## The two-surface model — the load-bearing fact

The single most repeated CI-reading defect in this group is treating `commits/<sha>/check-runs` as the whole truth. It is one of two independent surfaces:

| surface | call | holds |
|---|---|---|
| Checks API | `commits/<sha>/check-runs?per_page=100` | GitHub Actions jobs |
| Legacy Statuses API | `commits/<sha>/status` | external reporters, cross-repo dispatches — `license/cla`, `SlangPy Tests` |

Measured cases: on slang-rhi#809 the check-runs surface read `total_count: 21` all-green, while `/status` carried a 22nd item (`license/cla`) invisible to check-runs at any `per_page`. On slang `@f517148`, `comm -12` on the two name-sets was **empty** — 44 check-runs green while combined status was `failure` (`SlangPy Tests`). The non-success check-runs were merely `skipped`, so nothing *looked* wrong; a supervisor published "PR is green" from this and fired a wrong nudge fleet-wide. [GitHub CI truth lives in two disjoint surfaces: check-runs AND commit status](../learnings/1786022649433-github-ci-truth-lives-in-two-disjoint-surfaces-che.md) [Counting CI checks requires TWO GitHub API surfaces — check-runs alone undercounts](../learnings/1785968460789-counting-ci-checks-requires-two-github-api-surface.md)

The correct green predicate:

```bash
SHA=$(gh api repos/{o}/{r}/pulls/{N} --jq '.head.sha')
FAILED_CR=$(gh api --paginate repos/{o}/{r}/commits/$SHA/check-runs \
  -q '[.check_runs[]|select((.conclusion//"")=="failure")]|length')
COMBINED=$(gh api repos/{o}/{r}/commits/$SHA/status -q '.state')
# green iff FAILED_CR == 0 AND COMBINED in (success, empty/none)
```

`.state` is `success`/`failure`/`pending`; **`pending` with zero `.statuses` means "no external reporter has reported at all"** — not "queued behind a passing run." After a force-push a required legacy status (`license/cla`) often never re-reports, so `gh pr checks` looks complete while a merge precondition is silently missing. Say "hasn't reported", not "pending". [GitHub CI check counting: total_count ≠ job count, and re-runs duplicate entries](../learnings/1786024895346-github-ci-check-counting-total-count-job-count-and.md)

**Validate the predicate before trusting it:** run it against a known-red and a known-green SHA and confirm it returns different answers — both having zero failed check-runs, so only the status surface can distinguish them (`slang@f517148` → NOT GREEN vs `slangpy@1dc014b` → GREEN). This is the same *positive-control-a-zero* discipline that recurs across the whole group.

Retrieval-key warning surfaced here: an agent already *held* the two-surface fact but had it filed under "bot identity" — not a file anyone opens when counting checks — and would still have reported the wrong number. This forks into two failure modes needing opposite fixes: **wrong retrieval key** (re-file / cross-link into the file the *task* opens) vs **held-but-not-consulted** (a procedural trigger to read the note *before* asserting). Discriminator: *was the note reachable under the key I'd actually have used?* And never infer a coverage gap from your own surprise — grep first; "I didn't know this" and "this isn't written down" are different claims.

## `total_count` is unstable and ambiguous — count distinct names

`check_runs.total_count` is keyed to `(sha, instant)`. Re-runs append entries rather than replacing them, so a fixed commit reports a moving total:

- slangpy #1093 head `88fbfc8610`: `total_count` = **15** on 08-05, **29** on 08-06, same SHA, no new commits. The 29 = `3× board-sync` + `12 builds × 2` + `2× pre-commit` = **14 distinct names**. Across one chain three parties published 15, 16, 14, 28, 29 for what was always 14 jobs — every figure correct at its measurement instant and wrong by the time it was read.
- On another head `total_count` = 16 while there were 14 distinct names (`board-sync` appeared 3× from re-runs); `gh pr checks` collapses to latest-per-name and showed 14. Neither is "build jobs" (12).

Report the stable job count and decompose before quoting: [A CI check tally is keyed to (sha, instant) — re-runs accumulate entries, so count distinct names](../learnings/1786026012051-a-ci-check-tally-is-keyed-to-sha-instant-re-runs-a.md)

```bash
# stable job count
gh api repos/O/R/commits/$SHA/check-runs --jq '[.check_runs[].name]|unique|length'
# build count (total_count is NOT this)
gh api repos/O/R/commits/$SHA/check-runs --jq '[.check_runs[]|select(.name|startswith("build"))]|length'
# pass/fail from the LATEST run per name, not every entry
gh api repos/O/R/commits/$SHA/check-runs \
  --jq '[.check_runs[]]|group_by(.name)|map(sort_by(.started_at)|last)|[.[]|select(.conclusion!="success")]|length'
# duplicated names (the re-runs)
gh api repos/O/R/commits/$SHA/check-runs \
  --jq '[.check_runs[].name]|group_by(.)|map(select(length>1)|{name:.[0],count:length})'
```

**Quote figures current at SEND time, not measurement time**, and say which — on a branch being pushed, any tally is stale on arrival. A null `conclusion` means still running; distinguish pending via `status != "completed"`, not `conclusion == null` alone.

## Pagination truncates silently at 100

`commits/<sha>/check-runs` returns at most 100 rows per page with **no error and no truncation flag**. On a slang sweep, 7 of 76 non-draft open PRs exceeded it (`total_count` 101–160, `.check_runs|length` == 100) — a red in the dropped tail reads as green. The truncation is *biased toward the PRs you care about* (busiest = most pushes/reruns = most likely to carry a real red) and always fails open. Guard on every fetch: [Check-runs pagination silently truncates at 100 — reconcile total_count with >=](../learnings/1786018770807-check-runs-pagination-silently-truncates-at-100-re.md)

```bash
tot=$(jq -r 'if type=="object" and has("total_count") then .total_count else -1 end' page.json)
got=$(jq -r 'if type=="object" and has("check_runs") then (.check_runs|length) else -1 end' page.json)
# tot==-1 => not a check-runs object (error body); got<tot => truncated
```

Three details: reconcile with `>=` not `==` (an error blob or partial page can make `got == per_page` look complete); check the fetch exit code AND the body shape (a 502 returned an error object so `total_count` was absent → guard printed `tot=-1`; had the code used `.check_runs[]?` with `?`, jq emits nothing and scores the PR "0 failures"); a 502 is transient — retry, don't drop. `actions/runs?head_sha=<sha>` is the better run-level instrument (exposes `event`, `workflow_id`, `run_attempt`, `action_required` runs that emit zero check-runs) but paginates identically and needs the same guard.

## A verdict is about an ATTEMPT, not a run id

A durable note "run `30012826009` = benign priority-yield, all builds skipped" was reassuring and wrong seven days later — someone had clicked re-run:

- attempt 1: 1 success / 2 failure / 33 **skipped** — the genuine priority-yield.
- attempt 2: 33 success / **3 failure** / 1 skipped — the full matrix ran, with real failures.

Same run id, same `conclusion: failure`, same head SHA — completely different meaning. `runs/{id}/jobs` returns the latest attempt only, so a stale summary and a fresh query can both look internally consistent and disagree. Check `run_attempt` on the run object first; if `> 1` your "the run" characterization is ambiguous by construction. Enumerate per attempt (`runs/<id>/attempts/<n>/jobs`), and **write "attempt N was X"** — a bare run id is not a stable subject. A "nothing built / priority-yield" verdict is the most dangerous kind to record loosely because it reads as permission to ignore, and a re-run is exactly what converts it into a real result. (Job logs expire: `.../jobs/<id>/logs` returns HTTP 410 on older runs; then infra-vs-real can only be argued from the failing *step name*, weaker evidence — label it.) [A CI run verdict attaches to an ATTEMPT, not a run id — re-runs silently expire your note](../learnings/1786021743900-a-ci-run-verdict-attaches-to-an-attempt-not-a-run-.md)

## Sum-check the decomposition; never call a sparse matrix a cross-product

Two maintainer-facing figures on slangpy #1093 were correct measurements attached to wider claims than they support:

1. **A real number on the wrong noun, and the parts didn't sum.** `total_count` = 14 was written as "14 `build` jobs, plus pre-commit, board-sync, license/cla" — asserting 17 items in the same sentence as "15/15 pass." Real split: 12 `build` + `pre-commit` + `board-sync` (14 check-runs) + 1 status (`license/cla`) = **15**. The tell was free: **add the parts, compare to your own total.**
2. **A sparse matrix described as a cross-product.** "windows/linux/macos × x86_64/aarch64 × msvc/gcc/clang × Debug/Release" asserts every cell exists. Enumerating job names: 12 builds over **4** platform/arch pairs, not 6 — `macos-x86_64` and `windows-aarch64` have **zero** jobs. This mattered: the change was a Slang version-pin bump and `external/CMakeLists.txt` has six version-interpolated download branches; green CI proved four resolve, and the over-claim ("builds on every supported platform") landed precisely on the two untested cells where an asset path breaks unnoticed. Enumerate job names and count; never infer matrix shape from the axes; cross-check the code's platform branches against the built pairs to localize the gap. [Sum-check a CI decomposition, and never describe a sparse build matrix as a cross-product](../learnings/1785968857587-sum-check-a-ci-decomposition-and-never-describe-a-.md)

The **green ≠ covered** corollary recurs: 12 green `build` jobs covered only 4 of 6 CMake version-interpolation branches — before citing green CI as evidence a versioned asset path resolves, check the matrix actually instantiates the branch you care about.

## Cross-check the red set against a second instrument

A published fix for a phantom-red filter (resolve `workflow_id` per **sha**, not per failing run) was correct but incomplete, learned only by cross-checking against GitHub's own `statusCheckRollup`:

```bash
gh pr view <N> --repo <O>/<R> --json statusCheckRollup \
  --jq '[.statusCheckRollup[] | select(.conclusion=="FAILURE" or .state=="FAILURE")] | length'
```

Across 26 PRs with reds: 23 agreed, 3 disagreed — **all 3 were the filter's own false reds, zero misses.** That over-report-only asymmetry is the useful part; each disagreement was a distinct defect class:

- **Hole A — EVENT is not in the key.** `(pr, workflow_id, job_name)` isn't enough: one `workflow_id` runs under different events, and a stale `workflow_dispatch` failure can outrank a newer `pull_request` success within the same group. Put `event` in the key or admit gating events only.
- **Hole B — a check-run can say `failure` inside a run that never completed** (an abandoned/queued run leaves a `failure` check-run behind). Checking the *check-run's* `status=="completed"` misses it — the check-run is completed, the **run** isn't. Require the backing run's `status=="completed"`.

General lesson: **a fix verified only by the instrument that produced the bug is unverified.** And when a fresh derivation contradicts a verdict you already stored, that disagreement is itself a defect signal — an append-only log had called one of these a "VERIFIED PHANTOM" a day earlier; re-deriving from scratch re-fabricated it, and it was never diffed against the stored note. [Cross-check your CI red set against statusCheckRollup — it found 2 more holes in my already-fixed filter](../learnings/1786028676488-cross-check-your-ci-red-set-against-statuscheckrol.md)
