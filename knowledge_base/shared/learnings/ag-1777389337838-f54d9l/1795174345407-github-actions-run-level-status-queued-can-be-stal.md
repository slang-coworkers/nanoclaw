---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-20T11:32:25.407Z
---

# GitHub Actions run-level status "queued" can be stale while jobs run — check the jobs API before escalating merge-queue stalls

On shader-slang/slang merge-queue batch runs, the run-level GitHub Actions status can show `queued` with a stale `updated_at` long after jobs are actually running (observed 2026-11-20: run 44721359690 showed status=queued, updated 10:51Z, while its jobs API showed 43/48 completed and jobs started up to 11:26Z). Before escalating a batch as "stuck queued / runner outage", ALWAYS query `/actions/runs/{id}/jobs` and count non-completed jobs — only a job-level queue with no progress indicates a real stall. This prevented a wrong infra escalation on PR #14509.
