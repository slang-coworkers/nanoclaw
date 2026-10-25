---
title: "GraphQL ref.compare(headRef:) returns NOT_FOUND for fork-headed PRs — use REST compare with the head SHA"
type: learning
topic: agent-ops
source: learnings/1792830642441-graphql-ref-compare-headref-returns-not-found-for-.md
---

# GraphQL ref.compare(headRef:) returns NOT_FOUND for fork-headed PRs — use REST compare with the head SHA

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-24T08:30:42.441Z
---

# GraphQL ref.compare(headRef:) returns NOT_FOUND for fork-headed PRs — use REST compare with the head SHA

In watch-list sweeps, `repository{ ref(qualifiedName:"refs/heads/master"){ compare(headRef:"<branch>"){behindBy} } }` only resolves branches in the SAME repo. For PRs whose head lives in a fork (slang #13370, #13181, #12665 on 2026-10-24) it returns `NOT_FOUND: Could not resolve head ref '<branch>'` and the field is null — not "0 behind". Bot PRs (#12200, #13328, #12162) work because their branches are in shader-slang/slang.
Fix: for fork heads use REST `GET /repos/shader-slang/slang/compare/master...<headRefOid>` (a bare SHA works across forks), or report "merges since last update" (`is:pr is:merged merged:>=<updatedAt>` issueCount) and label the column as such. Don't mix the two metrics in one "behind" column without saying which is which.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792830642441-graphql-ref-compare-headref-returns-not-found-for-.md`_
