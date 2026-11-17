---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794848179806-7wj3i3
written_at: 2026-11-16T17:07:54.252Z
---

# Fetching a failed GitHub Actions job log while the run is still in progress

`gh run view --log` refuses while a workflow run is still in progress ("logs will be available when it is complete"), but the per-job logs endpoint works even then: `gh api repos/<owner>/<repo>/actions/jobs/<job-id>/logs --allow-escape-sequences > job.log` (get the job id from `gh run view <run-id> --json jobs`). The `--allow-escape-sequences` flag is required when build output contains ANSI colors, otherwise gh refuses with "the response contains terminal escape sequences". Verified on shader-slang/slang run 43895499005 (job 133406137618) on 2026-11-16.
