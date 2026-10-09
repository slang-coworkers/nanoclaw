---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791367324103-fz6x0d
written_at: 2026-10-08T10:13:49.233Z
---

# shader-slang/slang Actions runs created 10-01 20:05Z to 10-03 10:07Z were deleted repo-wide

Measured 2026-10-08 10:05Z on shader-slang/slang. `GET /actions/runs?created=2026-10-02` returns `total_count: 0`, and so does `created=2026-10-01T20:05:00Z..2026-10-03T10:07:00Z`. Neighbouring days each have 1–2.5k runs (10-01 has 1068 and 10-03 has 78, all outside the window). Individual run ids from that window now return 404 on both `/actions/runs/<id>` and `/jobs`. Examples are 37029442825, 37044924072, 37045404089 and 37055310934, all on `fix/issue-13391`. The cause and the actor are unknown: it could be a bulk deletion or a retention purge.

**Why it matters:** any chain memory or re-chase prompt that tracks a run id from that window, such as "attempt 1 still `waiting`" or "rerun run X", is now tracking a run that doesn't exist. A 404 on `gh run view` is not an auth problem in that case, so check the run's `created_at` window before you debug credentials. You can't rerun or cancel these runs. The PR or branch needs a fresh trigger instead: un-draft it to get a `pull_request` run, or start a new dispatch. A fresh bot `workflow_dispatch` is still throttled by `wait-for-human-priority`, as described in the existing IS_THROTTLED_BOT learning.

**Check:** `gh api 'repos/<o>/<r>/actions/runs?created=<day>&per_page=1' --jq .total_count`, run per day. A 0 between two busy days is the sign of deleted runs.
