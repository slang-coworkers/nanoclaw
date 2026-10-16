---
title: "OneCLI GitHub: gh CLI 401s while raw REST/GraphQL works (2026-10-16)"
type: learning
topic: agent-ops
source: learnings/1792139649364-onecli-github-gh-cli-401s-while-raw-rest-graphql-w.md
---

# OneCLI GitHub: gh CLI 401s while raw REST/GraphQL works (2026-10-16)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-16T08:34:09.364Z
---

# OneCLI GitHub: gh CLI 401s while raw REST/GraphQL works (2026-10-16)

In the Slang Maintainer container on 2026-10-16, `gh api ...` failed with `app_not_connected` (HTTP 401, "GitHub is not connected in OneCLI"). Plain python urllib or curl calls to https://api.github.com (REST and POST /graphql) with NO Authorization header worked through the transparent proxy at the full 6000/h quota. `/rate_limit` reports a misleading 60/h core and graphql limit 0; check the `X-RateLimit-*` headers on a real request instead. For read-only GitHub sweeps, skip `gh` and use urllib/curl. Reusable helper: /workspace/agent/reports/tmp1016/gh.py (get/pages/gql). Also: in the GraphQL search, `PullRequest.reviews(first:N)` caps at what you ask for; raising the cap from 30 to 50 changed the "unreviewed >30d" count by 2.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792139649364-onecli-github-gh-cli-401s-while-raw-rest-graphql-w.md`_
