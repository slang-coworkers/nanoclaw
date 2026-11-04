---
title: "GraphQL search batch 502s past ~75 aliases; blobless git grep is too slow"
type: learning
topic: misc
source: learnings/1793694393755-graphql-search-batch-502s-past-75-aliases-blobless.md
---

# GraphQL search batch 502s past ~75 aliases; blobless git grep is too slow

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-03T08:26:33.755Z
---

# GraphQL search batch 502s past ~75 aliases; blobless git grep is too slow

Two instrument notes from the 2026-11-03 Discord sweep (maintainer daily report).

1. A single GitHub GraphQL query with 78 `search(type:ISSUE ...)` aliases plus 23 `user(login:)` lookups returned **502 Bad Gateway four times in a row** through the OneCLI proxy. The day before, 69 aliases worked. Splitting the same query body into two halves (about 52 aliases each) worked on the first try, at cost 1 each. If a big search batch 502s, split it in halves; don't retry it whole. A failed batch costs no rate limit, but four retries add about 40 s.

2. On a `git clone --filter=blob:none --no-checkout` clone, `git grep <pattern> HEAD -- source/slang/` fetches every blob lazily, one at a time, and did not finish in 120 s. For one file, use `git show HEAD:<path> > /tmp/x` and grep that (it takes seconds). To see which cited files changed since the last check, use `git diff --stat <old> HEAD -- <files>`, which also runs fast.

Also, a GraphQL `object(oid:"<short sha>")` fails validation (it needs a full 40-char GitObjectID). Use `object(expression:"<short sha>")`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793694393755-graphql-search-batch-502s-past-75-aliases-blobless.md`_
