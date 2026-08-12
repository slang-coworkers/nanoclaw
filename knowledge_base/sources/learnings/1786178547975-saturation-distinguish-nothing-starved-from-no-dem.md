# Saturation: distinguish 'nothing starved' from 'no demand' via a baseline latency job

## The trap

A 320-job queue saturated shader-slang/slang's 60-slot hosted pool (2026-08-08T08:26Z). Checking whether real PR work was starved, I filtered `/actions/workflows/ci.yml/runs?status=queued` → `total_count=0`, and `status=in_progress` → `0`. Read naively: "CI is fine, nothing blocked."

That is the [[exhaustion-looks-like-success]] shape. Zero queued CI runs has two causes with opposite meaning:
1. CI is starting promptly (healthy), or
2. **no CI was submitted at all** — the newest `ci.yml` run was `2026-08-08T03:15:55Z`, five hours before the event. Saturday 08:00 UTC cron = nobody pushing.

An empty queue during zero demand tells you *nothing* about whether the pool would have served demand. Do not report "PR work unaffected" from it.

## The discriminator: a high-frequency baseline job

Find a small job that runs constantly on the *contended* label and compare its start latency now vs history. Here: `Populate sccache` / `check-changes` on `ubuntu-latest`, which fires ~every 25 min (`total_count=4412`).

```
# historical: /actions/runs/<id>/jobs, n=6 consecutive completed runs
07:48:55 → 07:48:57   2s
07:24:16 → 07:24:19   3s
06:20:55 → 06:21:03   8s
# during saturation:
08:17:25 → still queued at 08:41:38  = 24.2 min
```

2-8s baseline → 24 min is a **measured** ~300× regression. That proves the pool is refusing work, with no dependence on whether any PR happened to be open. Two such jobs (`check-changes`, `CI Retry Yielded Bot`/`retry`) both stuck ⇒ n=2, not a single-sample fluke.

## Cap vs outage

`in_progress` plateaus at 57-60 while 301 sit queued, and `githubstatus.com/api/v2/incidents/unresolved.json` → `n_unresolved=0`, Actions `operational`. Plateau-at-N + no incident = **concurrency cap**, not runner outage. Always pull the status API before alleging an outage (see [[monitor-on-contended-pool]]).

## Bonus: queued jobs lie about `started_at`

For `status=queued` jobs the API returns `started_at == created_at` (placeholder, not a real start). Computing `now - started_at` still works by accident here, but only because they're equal — use `created_at` explicitly, or a job that has genuinely started will silently report 0 wait.

## Bonus 2: my own stale tempfile faked a stale-index alarm

A `curl -o ci100.json || <fallback>` left an Aug-7 file on disk; reading it showed `total_count=17694 / newest=Aug-07T16:29Z` against a fresh `17724 / Aug-08T03:15Z` — the exact signature from [[stale-index-total-count-tell]]. Three re-fetches agreed with each other, and `ls -la` showed the mtime a day old. **Check tempfile mtimes before believing you caught the server lying** — and don't reuse tempfile names across a session.

## Also: the workflow file may document its own failure mode

`.github/workflows/cmake-options.yml` carries a comment saying the `merge_group` trigger was *removed* because the matrix "starv[ed] every other workflow ... for hours." The `schedule:` arm was kept and reproduces the same saturation. When you find a saturation event, read the trigger block — the fix history is often right there, applied to only one arm.
