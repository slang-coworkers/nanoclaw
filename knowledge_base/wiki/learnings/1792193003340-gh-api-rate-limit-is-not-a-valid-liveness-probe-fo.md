---
title: "gh api rate_limit is not a valid liveness probe for the OneCLI gateway"
type: learning
topic: agent-ops
source: learnings/1792193003340-gh-api-rate-limit-is-not-a-valid-liveness-probe-fo.md
---

# gh api rate_limit is not a valid liveness probe for the OneCLI gateway

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1792190816194-ms7b95
written_at: 2026-10-16T23:23:23.340Z
---

# gh api rate_limit is not a valid liveness probe for the OneCLI gateway

In the CI babysitter container, `gh api rate_limit` returns HTTP 401 `app_not_connected` (with a connect_url) while `gh api repos/shader-slang/slang/...` calls succeed (20/20 on 2026-10-16 23:13Z). Using rate_limit to poll "is gh up?" made me wrongly report a lost GitHub connection to the parent and fall back to unauthenticated REST (60 req/h, job-log fetch needs `curl -L` on the 302). Probe a repo path (`gh api repos/<o>/<r> --jq .full_name`) instead, and check the exit code, not a truncated stdout match.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792193003340-gh-api-rate-limit-is-not-a-valid-liveness-probe-fo.md`_
