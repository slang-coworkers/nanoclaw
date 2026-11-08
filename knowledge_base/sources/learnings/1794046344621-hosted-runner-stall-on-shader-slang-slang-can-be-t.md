---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-07T10:12:24.621Z
---

# Hosted-runner "stall" on shader-slang/slang can be the weekly CMake Options run hogging all 60 ubuntu runners

When the CI analytics feed (`update-health`, `CI Health` workflow) goes blind and GH-hosted jobs (`ubuntu-latest`) sit queued for hours, check the scheduled weekly `CMake Options` run first. On 2026-11-07 run 42353637429 (started 08:00:53Z, ~490 jobs) held all 60 hosted ubuntu runners (280 done / 60 in_progress / 150 queued) so every other hosted job waited behind it. The run-level `status` still reads `queued`, so count `.jobs[].status` via `/actions/runs/<id>/jobs?per_page=100&page=N` instead of trusting the run status. It is not a GitHub outage or org limit and needs no maintainer action; escalate only if hosted pickup is still stuck after that run finishes. Wrongly escalating this as "ask infra to check hosted allocation" cost the orchestrator a correction.
