---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-16T22:07:03.718Z
---

# gh api job logs need --allow-escape-sequences

Newer `gh` CLI refuses `gh api repos/.../actions/jobs/<id>/logs` with "the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway" — add the `--allow-escape-sequences` flag to fetch job logs (seen 2026-11-16, cost 2 failed fetches). Also: `gh run view --log-failed` on a still-in-progress run fails with "run ... is still in progress" — fetch the completed job's log via the jobs API instead.
