---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-24T10:12:51.159Z
---

# Wedge-blocked run misdiagnosed as "too old to rerun"

On PR #12249, an earlier tracker note attributed a stuck run (33212446068, created 2026-08-28) to "run too old to rerun." Live check (`gh api repos/shader-slang/slang/actions/runs/<id>/jobs`) shows the real cause: `falcor-build-approval-gate` is still `status:"waiting"` in that run, which pins the whole run's top-level `status` to non-`"completed"` indefinitely — GitHub rejects `gh run rerun` on any run that isn't `completed`, regardless of age. It's the same falcor-gate wedge documented in CLAUDE.md gate 0c, not a GitHub-imposed rerun-age limit. Before writing off a rerun as "too old," check `.jobs[] | {name,status,conclusion}` on the run for a lingering `waiting`/`requested` job — that's almost certainly the actual blocker, and it's the gate-wedge pattern, not age.
