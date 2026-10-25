---
type: incident
title: shader-slang/slang Actions queue stall from 2026-10-17 07:56Z
description: Saturday ~08:00Z Actions queue stall on shader-slang/slang (10-17, recurred 10-24); likely the weekly 478-job cmake-options.yml matrix saturating GitHub-hosted concurrency. Originally: no workflow job started since 07:56:16Z on 10-17. Queued runs pile up with no runner, including GitHub-hosted ubuntu-latest jobs. Sibling repos (slangpy, slang-rhi) have nothing queued. githubstatus is all green. Cause unknown; raised with the operator.
tags: [slang, ci, github-actions, infra, open-question]
---

# Actions queue stall (shader-slang/slang, 10-17)

**Checked live 10-17 10:06Z:**
- `status=in_progress` gives 0. 34 runs created today are `queued`, newest 09:53:55Z, plus 2 old leftovers from May. Of the runs created 08:00–10:10Z, 35 completed, but all of them were `cancelled` (17) or `skipped` (18). None succeeded or ran a job. The last successful run was at 07:56:16Z (CI Retry Yielded Bot).
- It affects **GitHub-hosted** jobs, not only self-hosted ones. `check-formatting` in run 39022853205 has `labels=["ubuntu-latest"]`, `runner_name` empty, queued since 09:53:54Z. So it isn't one self-hosted pool going down.
- It is **specific to this repo**. shader-slang/slangpy and slang-rhi have 0 runs queued since 07Z. Their last successes, 07:02Z and 07:06Z, are just older activity, not a stall.
- githubstatus.com shows All Systems Operational and Actions operational, with no incident.
- The merge queue is blocked: #13283's merge_group CI 39022853282 has been queued since 09:53:53Z.

**Likely causes (inference, not verified):** a repo-level Actions concurrency or spending limit, or Actions disabled or restricted on the repo, or an org policy change applied to this repo. The bot can't read billing or org settings (`orgs/shader-slang/settings/billing/actions` → OneCLI `app_not_connected`, the known non-REST-path signature). Needs a repo or org admin.

Raised with the operator 10-17 10:1xZ.

## Resolved by ~10:10Z (checked 12:05Z)

- The first runs to finish after the stall were queued at 08:08Z and completed between 10:10:18Z and 10:11:29Z. So jobs started again at about **10:10Z**, about 2h14m after the last success at 07:56Z. That was only minutes after I raised it at 10:1xZ, so it most likely cleared without anyone acting. Whether someone acted is unknown.
- #13283's merge_group CI passed and it merged at 11:29:58Z, with no eviction. Live at 12:05Z: 1 run in progress, last success 11:58Z.
- **Cause never established.** githubstatus showed no incident, and the bot has no billing, org-settings or runner access. Record it as a 2h14m repo-scoped stall that cleared on its own. If it recurs, look at the repo's Actions settings and billing first.

## Recurred 2026-10-24 (Saturday again): likely cause is the weekly `cmake-options.yml` matrix

- **Both stalls start on a Saturday at about 08:00Z.** `cmake-options.yml` has `cron: "0 8 * * 6"`. Its scheduled run 40076365432 was created at 08:00:46Z and is the oldest queued run today. The 10-17 run 39015775119 ran from 08:01Z to 12:21Z, and the 10-17 stall was 07:56–10:10Z.
- **That run has 478 jobs on GitHub-hosted runners**: windows-latest, windows-2022, windows-2025-vs2026, ubuntu-22.04, ubuntu-24.04-arm and macos-latest. At 10:04Z, 313 were completed, **60 in progress** and 105 queued. Its run-level `status` stays `queued` while those 60 jobs run, so counting `status=in_progress` **runs** reads "1" and misses them. That miscount is how the babysitter saw "only 1 in_progress".
- The workflow sets no top-level `max-parallel`; the matrix comes from a reusable workflow. The bot can't see the org's concurrent-job limit, so "the matrix saturates the concurrency cap" is an inference. It fits the same weekday and time, ubuntu-latest jobs from other workflows starving, and the stall clearing as the matrix drains.
- **Pagination 401:** `gh api --paginate` on the jobs endpoint fails on the next-page request with `app_not_connected`, while the same pages fetched with `&page=N` succeed. GitHub is still connected; use explicit `page=` loops.
- Possible fixes, all needing a maintainer: `max-parallel` on the matrix, or moving the cron off peak.
