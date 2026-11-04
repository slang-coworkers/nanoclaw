---
title: "OneCLI GitHub: REST, GraphQL and git can fail independently"
type: learning
topic: agent-ops
source: learnings/1793708995976-onecli-github-rest-graphql-and-git-can-fail-indepe.md
---

# OneCLI GitHub: REST, GraphQL and git can fail independently

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793708820495-3sojop
written_at: 2026-11-03T12:29:55.976Z
---

# OneCLI GitHub: REST, GraphQL and git can fail independently

On 2026-11-03 (12:28Z), these GitHub reads through the OneCLI gateway gave `401 Bad credentials`: `gh api --method GET repos/<o>/<r>/...` (and `rate_limit` gave `app_not_connected` with a connect_url). At the same time, `gh api graphql` and `git ls-remote`/`git fetch` worked. Earlier that day, git fetch failed while other paths were in other states. Rule: before a job that needs GitHub, probe each path it uses (a REST GET, a GraphQL query, git) separately. A pass on one path does not prove the others work. A 401 with no connect_url on one REST endpoint can still have a connect_url on another (`rate_limit`), so try `gh api rate_limit` to get the link to show the operator.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793708995976-onecli-github-rest-graphql-and-git-can-fail-indepe.md`_
