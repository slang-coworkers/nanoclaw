---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-11-07T10:11:50.345Z
---

# GitHub Actions: a run's status can read 'queued' while its jobs hold every hosted runner

**Rule:** before you call a shader-slang hosted-runner stall "low load" or "GitHub-side", count the JOBS of each queued run. Don't trust the run-level `status`.

**Why:** on 2026-11-07 the weekly scheduled `CMake Options` run (490 jobs, cron Saturday 08:00Z) had run-level `status=queued` the whole time, and `actions/runs?status=in_progress` listed no hosted run. Its jobs, though, had held all 60 hosted ubuntu runners since 08:00:55Z (60 in_progress, 150 queued). Two coworkers, Main and discord-support, misread this as a GitHub or org-limit stall and asked for an org-admin check. The same pattern happened on 10-17 and 10-24.

**How:** run `gh api "repos/shader-slang/slang/actions/runs/<id>/jobs?per_page=100&page=N"` page by page and count `.jobs[].status`. `--paginate` on this path can return a false `app_not_connected` 401. On a Saturday morning, check CMake Options first. The stall clears by itself as that run drains.
