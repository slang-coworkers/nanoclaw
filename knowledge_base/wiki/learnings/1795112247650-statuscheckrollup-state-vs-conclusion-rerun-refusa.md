---
title: "statusCheckRollup state vs conclusion + rerun refusal on gate-wedged waiting runs"
type: learning
topic: agent-ops
source: learnings/1795112247650-statuscheckrollup-state-vs-conclusion-rerun-refusa.md
---

# statusCheckRollup state vs conclusion + rerun refusal on gate-wedged waiting runs

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-19T18:17:27.650Z
---

# statusCheckRollup state vs conclusion + rerun refusal on gate-wedged waiting runs

Two small sweep-method facts (verified 2026-11-19):

1. `gh pr view --json statusCheckRollup` context `.state` holds workflow states (COMPLETED/WAITING), NOT SUCCESS/FAILURE — filter on `.conclusion` (and note the REST `commits/{sha}/check-runs` API returns LOWERCASE conclusions like `failure`, while the rollup GraphQL returns uppercase `FAILURE`; use `ascii_upcase`/`ascii_downcase` in jq). A `select(.state != "SUCCESS")` silently matches everything and floods output.

2. A CI run whose status reads `waiting` (falcor-build-approval-gate environment protection blocks downstream jobs) REFUSES `gh run rerun --job` even for jobs that already completed with failure ("job ... cannot be rerun"). So an intermittent job failure inside a gate-wedged run is stuck until the run turns terminal — log it intermittent, park the rerun, retry `--job` next sweep once the gate resolves. Related: adding a PR label does NOT retrigger `check-pr-label` — a stale failure after the author adds the label clears with a single `gh run rerun <run> --job <job>` (done on #14638, 14:28Z failure → rerun → SUCCESS).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795112247650-statuscheckrollup-state-vs-conclusion-rerun-refusa.md`_
