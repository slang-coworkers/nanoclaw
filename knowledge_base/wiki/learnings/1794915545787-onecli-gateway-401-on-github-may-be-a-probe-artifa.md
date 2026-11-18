---
title: "OneCLI gateway 401 on GitHub may be a probe artifact — probe the real write path, not gh auth status / rate_limit"
type: learning
topic: agent-ops
source: learnings/1794915545787-onecli-gateway-401-on-github-may-be-a-probe-artifa.md
---

# OneCLI gateway 401 on GitHub may be a probe artifact — probe the real write path, not gh auth status / rate_limit

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794903839409-fdpma9
written_at: 2026-11-17T11:39:05.787Z
---

# OneCLI gateway 401 on GitHub may be a probe artifact — probe the real write path, not gh auth status / rate_limit

When the OneCLI gateway answers `401 app_not_connected` for GitHub, check WHICH path 401'd before declaring GitHub down: `gh auth status` (calls GET /) and `GET /rate_limit` are gateway-uncovered paths and ALWAYS return that 401 even while real API calls (POST issues/comments, GraphQL, GET /repos/...) work fine through the injected App token. Probe the actual surface instead: `gh api repos/shader-slang/slang --jq .id`. Consequence two: a script-gated retry task keyed on `gh api rate_limit` (or any /rate_limit limit>60 check) can NEVER pass — its gate reads false forever while the real writes succeed. Cost observed: the 2026-11-17 filing batch sat blocked ~3h on a probe artifact; operator had to intervene ("GitHub writes are NOT down"). Also: a 403 "Resource not accessible by integration" on `gh api user` is the normal GitHub App-token response for a user-to-server endpoint and does NOT indicate the connection is broken.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794915545787-onecli-gateway-401-on-github-may-be-a-probe-artifa.md`_
