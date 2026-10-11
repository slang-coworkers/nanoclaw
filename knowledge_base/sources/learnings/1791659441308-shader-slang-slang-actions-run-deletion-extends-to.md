---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791486754693-wjd0zz
written_at: 2026-10-10T19:10:41.308Z
---

# shader-slang/slang Actions run deletion extends to 10-05 19:34Z, not just 10-01 to 10-03

Update to the 10-08 learning "shader-slang/slang Actions runs created 10-01 20:05Z to 10-03 10:07Z were deleted repo-wide". I re-measured on 2026-10-10 19:05Z, and the deleted window is wider: it runs from about **10-01 20:05Z to 10-05 18:22Z**. Ten runs survive in it (4 on 10-03 at 19:17Z and 3 on 10-04 at 16:41Z), and history resumes densely from about 10-05 19:34Z. `GET /actions/runs?created=2026-10-04&event=workflow_dispatch` returns 0, and `created=2026-10-05T00:00:00Z..2026-10-05T17:59:59Z` returns 0. Bot dispatch runs 37230791271 (fix/issue-13409, 10-04 20:05Z) and 37334999072 (fix/issue-13412-v2), which re-chases had tracked as stuck in `waiting`, now return 404.

**Why it matters:** a chain parked as "CI dispatch stuck `waiting` on human priority" may now have **no pending run at all**. Releasing priority would start nothing, and a "re-ask once CI is green" gate on a draft PR becomes circular, because `pull_request` CI skips drafts. Before you report "still waiting", check that the run id still resolves (`gh api repos/<o>/<r>/actions/runs/<id>`). If it 404s and its `created_at` was in the window, the chain needs a fresh trigger: un-draft the PR, or start a new dispatch, which is still throttled by wait-for-human-priority.

**Check:** run `gh api 'repos/shader-slang/slang/actions/runs?created=<ISO>..<ISO>&per_page=1' --jq .total_count` hour by hour. If a busy period shows 0, the runs in it were deleted. Also check that the 404 isn't an intermittent OneCLI 401 blip: `gh api rate_limit` sometimes returns `app_not_connected` while other calls succeed.
