# GitHub Actions: judging "workflow stopped firing" and sizing a merge_group window

# Two traps when triaging GitHub Actions from the REST API

Both hit while triaging shader-slang/slang on 2026-08-05. Unauthenticated `curl` against api.github.com works fine (60 req/hr), except `/actions/jobs/<id>/logs` which returns **403 without auth** — job/step *names* and `runner_name` are available, log *contents* are not.

## 1. "No run in N days" is not evidence a workflow is dead — check `state` + the cron first

Before claiming a scheduled workflow stopped firing, fetch `/actions/workflows?per_page=100` and read the `state` field: `active` vs `disabled_inactivity` vs `disabled_manually`. GitHub auto-disables scheduled workflows after 60 days of repo inactivity, and that is the *only* silent-stop mechanism worth alleging.

Then compare the declared cron against the observed timestamps. A **weekly** cron (`0 8 * * 6` = Saturdays) makes a 4-day gap after a Saturday completely expected — the next fire simply isn't due yet. `CMake Options` looked "dead for 4 days"; it was `active`, weekly, had fired **12 consecutive Saturdays with exactly 7-day gaps and zero misses**, and the next run was 3 days out. Nothing was wrong.

Derive cadence from the timestamps rather than assuming daily. `for d in $(jq -r '...created_at[0:10]'); do` + `date -u -d` subtraction prints the gap sequence, which exposes both the period and any real misses.

Corollary: a *chronically failing* workflow is a separate finding from a *non-firing* one. Don't let one answer the other — `CMake Options` was firing perfectly and still red in 10 of its last 11 runs, with a **different** option failing each time (IR_BREAK_ALLOC at the Configure step, PCH at the Build step, 31 options at once). Varying failure identity argues against a single root cause.

## 2. `?event=merge_group&per_page=100` is a ~32-hour window, not "recent history"

Every merge-queue entry fans out into **one run per workflow** — 7 in this repo (CI + 6 Check* workflows). So 100 runs ≈ 14 queue entries ≈ 32 hours. Always print `[.workflow_runs[].created_at] | (min+" .. "+max)` and quote that span next to any count, otherwise "6 failures" reads as a long-run trend when it covers a day and a half.

Worse, a mixed tally is meaningless: the 6 lightweight Check* workflows are ~100% green and dilute everything. Filter to the gating workflow (`select(.name=="CI")`) before tallying — 23/25 success across all workflows became 7 success / 6 failure / 2 cancelled on CI alone. Wildly different story, same data.

## 3. Merge-queue failures: check whether the PR merged anyway, and on how many runners

Two checks separate a code regression from infrastructure flake:

- **`runner_name` on every failing job.** A per-runner fault is indistinguishable from a code regression in the job name alone. Here `falcor-image-test` failed on **both** SLANGWIN4 and SLANGWIN5, which rules *out* a single bad runner while still not implicating code.
- **Did the PR merge later?** Query each PR's `merged`/`merged_at`. 5 of 6 PRs whose merge_group CI failed merged within hours on a *subsequent* queue attempt with no code change addressing the failure. That is the signature of flaky gating, and it's much stronger evidence than reading any single run.

Also check `run_attempt` — all 6 were `attempt=1`, meaning nobody re-ran them in place; the queue just re-queued the PR. And note the merge_group `head_sha` is the queue's **temporary merge commit**, not the PR head (`133aa07b` vs PR 12322's `ba156ebf`) — don't try to match them.
