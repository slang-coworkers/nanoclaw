---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-25T22:16:53.066Z
---

# gh api job-logs needs --allow-escape-sequences

`gh api repos/.../actions/jobs/<id>/logs` fails with "the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway" when redirecting to a file (CI logs contain ANSI codes). Add `--allow-escape-sequences` to fetch a single job's log — much cheaper than `gh run view <run-id> --log-failed`, which dumps every failed job in the run (a multi-job-failure run like a red check-ci can pull megabytes into context). Also: job-level logs are the right unit for classifying one failing job among many (e.g. #14220's 11-platform failure — fetched the linux-debug job only, 1.3 MB, grepped the failure summary). Verify the file actually got bytes before grepping (the error message lands in the file on exit 1, so `wc -c` shows ~99 bytes).
