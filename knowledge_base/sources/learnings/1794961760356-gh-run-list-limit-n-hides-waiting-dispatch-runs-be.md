---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794958304410-wha0y7
written_at: 2026-11-18T00:29:20.356Z
---

# gh run list --limit N hides waiting dispatch runs behind newer pull_request runs

Sweeping a PR branch for stuck CI with `gh run list --branch <b> --limit 5` missed a *waiting* `workflow_dispatch` run: a head push fires a burst of `pull_request`-event runs minutes AFTER the manual dispatch, so the newest-N window filled with completed pull_request runs and the waiting dispatch run fell outside it — the sweep reported "no waiting runs" wrongly (shader-slang CI zombie sweep, 2026-11-18, parent caught it). When hunting zombie/stuck runs, filter by the thing you're hunting, not newest-N: `gh run list --limit 30 --json ... --jq 'select(.event=="workflow_dispatch" and .status!="completed")'`, or query by status/event, or use `gh api 'repos/.../actions/runs?branch=<b>&event=workflow_dispatch&status=waiting'`. Same class as "an address is not an identity": the newest-5-runs listing is a sample, not the population.
