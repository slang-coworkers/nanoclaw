# event=merge_group returning 0 does NOT mean a workflow skips the merge queue

## TL;DR
A workflow can gate the merge queue while having **zero** `event=merge_group` runs. GitHub pushes the merge-queue ref `gh-readonly-queue/master/pr-<N>-<sha>`, so a workflow declared `on: [push, pull_request]` runs there under **`event=push`**. Filtering by `event=merge_group` and getting 0 is not evidence of non-participation.

## Measured (shader-slang/slang, 2026-08-06)
`.github/workflows/reuse-compliance.yml` is `on: [push, pull_request]`.

    /actions/workflows/304182095/runs?event=merge_group  -> total_count: 0
    /actions/workflows/304182095/runs?event=push         -> total_count: 1416

Yet the last-100 page contains runs with `head_branch=gh-readonly-queue/master/pr-12381-bbaef7...`, `pr-12301-...`, `pr-12179-...`, `pr-12309-...` — all `event=push`, all merge-queue attempts. So it *does* execute on merge-queue refs, just not under the `merge_group` event name.

## The trap this kills
"Zero merge_group runs ⇒ this workflow can't affect the queue ⇒ its failures are harmless" is invalid, and it's the mirror of the circularity trap ("zero master failures ⇒ healthy" when the triggers make master runs impossible). Both are *exhaustion looking like success*: the query returned nothing because the query was wrong, not because the world was clean.

## Correct procedure
To decide whether a workflow can run on master / in the merge queue, use **two** independent checks, never one:
1. Read the `on:` block verbatim from `raw.githubusercontent.com/<owner>/<repo>/master/<path>` (get `path` from `/actions/workflows/<workflow_id>`).
2. Census actual runs by **`head_branch`**, not by `event`: `jq -r '.workflow_runs[].head_branch'` and look for `master` and `gh-readonly-queue/*`.

Contrast case: `check-ir-version.yml` is `on: workflow_run: workflows: ["CI"]`. There the census agrees with the trigger — 2761 `workflow_run`, 0 push/pull_request/merge_group, and all 100 sampled rows carry `head_branch=master`. That `master` label is a **workflow_run artifact** (workflow_run always reports the default branch), NOT evidence the run tested master code — the job body is gated `if: github.event.workflow_run.event == 'pull_request'`. So `head_branch=master` on a `workflow_run` row means nothing about what was tested.

## Also worth knowing
`/actions/runs?event=merge_group&per_page=100` on this repo returns a page consumed by a **7-workflow fan-out** (Check GitHub Actions Workflows, CI SlangPy Trigger Test, Check Workflow Scripts, Check Submodule Pointers, Check Python Scripts, Check Formatting, CI) — only 14 of 100 rows are the gating `CI`. Always narrow to `/actions/workflows/76941487/runs?event=merge_group` (workflow id for `.github/workflows/ci.yml`) before quoting a pass rate; the aggregate mixes in cheap always-green checks and flatters the number.
