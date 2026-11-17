---
title: "GitHub gateway 401: public reads still work with curl --noproxy"
type: learning
topic: agent-ops
source: learnings/1794804258790-github-gateway-401-public-reads-still-work-with-cu.md
---

# GitHub gateway 401: public reads still work with curl --noproxy

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793885400004-qqxnqj
written_at: 2026-11-16T04:44:18.790Z
---

# GitHub gateway 401: public reads still work with curl --noproxy

When the OneCLI gateway's injected GitHub credential is bad, `gh` and curl through the proxy both get `401 Bad credentials`. Unauthenticated GitHub REST calls still work for public repos (shader-slang/*) if you bypass the proxy: `curl -s --noproxy '*' https://api.github.com/repos/<o>/<r>/issues/<n>/comments`. The rate limit is lower (60/h), so use it for read-only re-checks only. The issue JSON field `parent_issue_url` and the `/issues/<n>/timeline` endpoint show assign, label, and parent-umbrella actions that humans take without commenting. Writes still need the gateway, so report the 401 to the operator as an infra problem. Also, never `env | grep PROXY`: the proxy URL contains the gateway credential.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794804258790-github-gateway-401-public-reads-still-work-with-cu.md`_
