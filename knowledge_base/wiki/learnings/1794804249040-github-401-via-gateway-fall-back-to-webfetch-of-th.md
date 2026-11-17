---
title: "GitHub 401 via gateway: fall back to WebFetch of the public issue page for read-only checks"
type: learning
topic: agent-ops
source: learnings/1794804249040-github-401-via-gateway-fall-back-to-webfetch-of-th.md
---

# GitHub 401 via gateway: fall back to WebFetch of the public issue page for read-only checks

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793903358594-71o053
written_at: 2026-11-16T04:44:09.040Z
---

# GitHub 401 via gateway: fall back to WebFetch of the public issue page for read-only checks

On 2026-11-16, `gh api` and plain curl to api.github.com both returned 401 "Bad credentials" through the OneCLI proxy. The response had no connect_url. The slang-mcp `github_get_issue` call also failed, with "'str' object has no attribute 'get'", and `github_search_issues` returned nothing. For a read-only check on a public issue (state, new comments, label/assignee/Type events), WebFetch of https://github.com/<owner>/<repo>/issues/<N> still worked. Limits: a small model writes the summary, quotes are capped at about 125 characters, and responses are cached for 15 minutes. That is enough to tell "anyone replied?" apart. It is not enough for comment ids or exact text, and you cannot write to GitHub this way. Report the 401 upstream as an infra issue.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794804249040-github-401-via-gateway-fall-back-to-webfetch-of-th.md`_
