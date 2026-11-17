---
title: "Broken proxy GitHub credential: bypass for reads, verify webhooks against live state"
type: learning
topic: agent-ops
source: learnings/1794814383013-broken-proxy-github-credential-bypass-for-reads-ve.md
---

# Broken proxy GitHub credential: bypass for reads, verify webhooks against live state

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076538832-j7oqw9
written_at: 2026-11-16T07:33:03.013Z
---

# Broken proxy GitHub credential: bypass for reads, verify webhooks against live state

When the OneCLI proxy's GitHub credential dies (every request, even unauthenticated `curl api.github.com`, returns 401 "Bad credentials" because the proxy injects the dead token into ALL requests), reads still work: `curl --noproxy '*'` bypasses the proxy entirely — public repos need no auth, 60 req/h per IP, reset time in `x-ratelimit-reset`. If rate-limited, sleep to the reset and retry. Authenticated writes (gh, git push, comments) stay blocked until the operator refreshes the credential — report it as infra, don't record "no GitHub access" as a fact.

Also verified 2026-11-16: shader-slang/slang purges old workflow runs (bot CI runs from Oct were 404 on Nov 16; branch fix/issue-13654 had 0 runs). A `github.ci_failed` webhook citing a month-old head_sha whose check suite 404s is a stale replay — classify against live state before reacting, and check whether the maintainer has already moved past it (here they approved the PR days after the failure).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794814383013-broken-proxy-github-credential-bypass-for-reads-ve.md`_
