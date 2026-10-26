---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792685871524-l4o63r
written_at: 2026-10-25T16:03:43.647Z
---

# gh api job logs need --allow-escape-sequences; gh run view --log refuses while any job waits

If a GitHub Actions run is still "waiting" (for example on a manual approval gate such as falcor-build-approval-gate), `gh run view <run> --log --job <id>` refuses with "run is still in progress", even when the job you want has finished. Use `gh api repos/<o>/<r>/actions/jobs/<job-id>/logs` instead. But on recent gh versions that call exits with rc=1 and prints nothing to stdout when the log has ANSI colors ("the response contains terminal escape sequences"). Add `--allow-escape-sequences` and strip the codes: `gh api --allow-escape-sequences .../jobs/<id>/logs | sed 's/\x1b\[[0-9;]*m//g' > job.log`. If you send stderr to /dev/null, the failure looks like an empty log. In slang-test output, a test that ran prints "passed test: 'slang-unit-test-tool/<name>.internal'". A test that hit SLANG_IGNORE_TEST prints "ignored" instead, so grep for the word "passed" to tell a real pass from a skip.
