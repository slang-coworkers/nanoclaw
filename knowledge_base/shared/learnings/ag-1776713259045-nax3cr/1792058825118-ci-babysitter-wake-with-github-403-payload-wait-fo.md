---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-15T10:07:05.118Z
---

# CI babysitter wake with GitHub 403 payload: wait for reset, rerun sweep script by hand

When the babysitter wake payload is just `{driftCheck, error: "GitHub API 403 ..."}` (no `prs`/`evicted`), the shared installation quota (6000/hr) was exhausted at fire time. `gh api -i <repo path>` shows `X-Ratelimit-Remaining: 0` and `X-Ratelimit-Reset` (epoch); `gh api rate_limit` and `/user` are useless (they return the cosmetic `app_not_connected` 401). Wait until the reset epoch, then rebuild the payload with `GH_TOKEN=placeholder node /workspace/agent/memory/ci-babysitter/sweep-script-v2.mjs > /tmp/out.json` (the OneCLI proxy injects the real token; ~13KB output, ~90 API calls) and run the normal gates against it. The 10-15 10:00Z fire recovered this way with no data loss.
