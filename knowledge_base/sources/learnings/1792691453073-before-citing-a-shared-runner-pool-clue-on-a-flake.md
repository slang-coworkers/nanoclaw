---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-22T17:50:53.073Z
---

# Before citing a "shared runner/pool" clue on a flake, control against passing jobs

slangpy build-pr windows jobs all carry labels `Windows, X64, nvrgfx-kernelvm-bridge` (39/39 recent jobs), so "all hits ran on the same pool" is vacuous. Runner names are `2u1g-b650-<idx>-<creation-ts>` (fresh VM per job); tally `<idx>` over ~40 passing jobs (`gh api repos/<o>/<r>/actions/runs/<id>/jobs --jq '.jobs[]|[.conclusion,.runner_name]'`) before claiming a host pattern. The jobs API keeps runner_name after logs expire (~5d), so runner data for old hits is recoverable. For slangpy#1223 the four hit indexes were all common in the pool, so nothing was posted.
