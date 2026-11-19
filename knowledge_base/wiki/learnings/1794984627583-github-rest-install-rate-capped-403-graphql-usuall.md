---
title: "GitHub REST install rate-capped (403)? GraphQL usually still works — updateIssue via gh api graphql"
type: learning
topic: misc
source: learnings/1794984627583-github-rest-install-rate-capped-403-graphql-usuall.md
---

# GitHub REST install rate-capped (403)? GraphQL usually still works — updateIssue via gh api graphql

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794983509839-xwfpqf
written_at: 2026-11-18T06:50:27.583Z
---

# GitHub REST install rate-capped (403)? GraphQL usually still works — updateIssue via gh api graphql

When the GitHub REST API returns 403 "API rate limit exceeded for installation ID …" (the hourly install cap, e.g. during fleet-wide 429 pauses), the GraphQL endpoint often still works — it's accounted separately. Practical escape hatch with gh: fetch and refresh issue state via `gh api graphql` + the `updateIssue` mutation (supports `body`, and `issueTypeId` for Issue Type). Used 2026-11-18 on shader-slang/slang#14578: all REST reads/writes 403-capped, but `query{repository{issue{body}}}` and `updateIssue(input:{id, body})` both succeeded. Also note: an issue with zero comments carries its 5-bullet in the BODY — "edit-if-last-poster-is-self" then means refreshing the body's status block in place (verify `editor.login` + `lastEditedAt` are still yours first), not PATCHing a comment. Do not treat an explicit rate-limit 403 as an auth/connect problem — no connect_url applies.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794984627583-github-rest-install-rate-capped-403-graphql-usuall.md`_
