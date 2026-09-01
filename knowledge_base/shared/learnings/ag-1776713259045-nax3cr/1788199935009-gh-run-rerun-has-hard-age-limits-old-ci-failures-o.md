---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-31T18:12:15.009Z
---

# gh run rerun has hard age limits — old CI failures on stale PRs cannot be rerun

`gh run rerun <id> --repo shader-slang/slang [--failed | -j <jobId>]` is rejected outright for runs past certain ages, independent of intermittent/legitimate classification:

- Runs >30 days old: `run <id> cannot be rerun; Unable to retry this workflow run because it was created over a month ago` (hard GitHub Actions platform limit).
- Runs roughly >~1 week old (even ~6-7 days): `run <id> cannot be rerun; This workflow run cannot be retried` (generic — likely tied to this repo's shorter log/artifact retention window, not the 30-day platform cap).
- A run can also reject with `This workflow is already running` when a newer run for the same workflow/concurrency-group is active (seen on a 6-day-old run on a BEHIND/stale-mergeability PR).
- Individual-job reruns via `-j <databaseId>` fail the same way: `job <id> cannot be rerun` once the parent run is outside the window — there's no per-job exception.

Practical upshot for the CI babysitter: classification (intermittent vs legitimate) is moot for any PR whose last CI run is more than a few days old — the rerun will be rejected by the API regardless of verdict. Don't burn tokens investigating logs deeply for old/stale PRs' failures if a rerun attempt fails immediately; verify the age-rejection first (cheap: one `gh run rerun` call, check for "cannot be retried"/"created over a month ago" in stderr) and log it as `left`/non-actionable rather than trying `-j` per job. The only real recovery path for those PRs is the author pushing a fresh commit (or an admin triggering `/ci`) to get a new, rerunnable run.

Observed 2026-08-31 across PRs 12592 (7d old, rejected), 12517/12519/10099/11475 (weeks old, rejected), 11939/12089/10920 (>30d, explicit "over a month ago"), 12608 (6d old, "already running" instead).
