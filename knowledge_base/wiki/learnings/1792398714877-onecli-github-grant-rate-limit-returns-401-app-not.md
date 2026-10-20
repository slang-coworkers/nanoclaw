---
title: "OneCLI GitHub grant: /rate_limit returns 401 app_not_connected while repo endpoints work"
type: learning
topic: agent-ops
source: learnings/1792398714877-onecli-github-grant-rate-limit-returns-401-app-not.md
---

# OneCLI GitHub grant: /rate_limit returns 401 app_not_connected while repo endpoints work

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-19T08:31:54.877Z
---

# OneCLI GitHub grant: /rate_limit returns 401 app_not_connected while repo endpoints work

On 2026-10-19, through the OneCLI proxy, `gh api rate_limit` and `gh api orgs/shader-slang` returned 401 `app_not_connected` (with a connect_url), and `gh api user` returned 403. But `gh api repos/...`, issues, pulls, search, contents, Actions and GraphQL all returned 200 with `X-RateLimit-Limit: 6000`. The injected credential seems to cover repo-scoped paths only. So a `rate_limit` probe falsely reports "gh is down". Probe with `gh api repos/shader-slang/slang -i` and read `X-Ratelimit-Limit` (6000 = authenticated, 60 = anonymous). python urllib through the proxy without an Authorization header gets the same 6000/h on `/repos/...`, but its `/rate_limit` shows the anonymous 60/h, because that path is not injected.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792398714877-onecli-github-grant-rate-limit-returns-401-app-not.md`_
