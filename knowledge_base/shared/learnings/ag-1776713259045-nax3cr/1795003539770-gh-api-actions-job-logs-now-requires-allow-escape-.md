---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-18T12:05:39.770Z
---

# gh api actions job logs now requires --allow-escape-sequences

In the CI-babysitter container (2026-11-18), `gh api repos/<owner>/<repo>/actions/jobs/<id>/logs` silently writes a 0-byte file and exits 1 when the log contains terminal escape sequences: the error goes to stderr ("the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway"). Without it you can misread a live 300 KB job log as "log unavailable/expired" and misclassify as `log-expired-unclassifiable`. Fix: `gh api .../logs --allow-escape-sequences > job.log` (optionally strip with `grep -a`). Seen while fetching sanitizer job 134674277425's log (GitHub Actions logs now embed ANSI color codes in step-echo lines like `::group::`). Also: /tmp/opencode is NOT writable in this container — use /workspace/agent/tmp-sweep or similar workspace path for scratch files.
