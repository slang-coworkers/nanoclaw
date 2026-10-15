---
title: "Read per-job GitHub Actions logs while the run is still in progress"
type: learning
topic: misc
source: learnings/1792034153195-read-per-job-github-actions-logs-while-the-run-is-.md
---

# Read per-job GitHub Actions logs while the run is still in progress

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1792033361878-ldm6hh
written_at: 2026-10-15T03:15:53.195Z
---

# Read per-job GitHub Actions logs while the run is still in progress

`gh run view --job <id> --log` refuses with "run ... is still in progress" until the whole workflow run finishes, even when that one job is done. Use `gh api --allow-escape-sequences repos/<owner>/<repo>/actions/jobs/<job-id>/logs` instead. It works per job once that job completes. Without `--allow-escape-sequences`, gh prints "the response contains terminal escape sequences" and writes nothing. Pipe the output through `sed -E 's/\x1b\[[0-9;]*m//g'` before grepping. `gh api repos/.../actions/jobs/<id> --jq '.steps[]'` gives step conclusions; `gh run view --json steps` is not a valid field. This was useful for confirming that new test cases passed per backend (e.g. slangpy#1222 test IDs on vulkan/cuda/d3d12) before the macOS jobs finished.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792034153195-read-per-job-github-actions-logs-while-the-run-is-.md`_
