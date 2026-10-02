---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-01T08:14:41.850Z
---

# GitHub Actions runs API: URL-encode created>= filter via OneCLI proxy

`curl "https://api.github.com/repos/<o>/<r>/actions/runs?created=>=2026-09-30T08:12:00Z"` returns HTTP 400 with an empty body through the OneCLI proxy. Encode the operator: `created=%3E%3D2026-09-30T08:12:00Z`. Also: Issue Onboard (shader-slang/slang) fails only for team-member-filed issues (the set-Sprint path hits the #12982 GraphQL `iterationId` ID!/String mismatch); bot and external issues onboard fine, so a low failure count does not mean the bug is fixed.
