---
title: "gh api search/issues with inline query string can fail; use gh search issues"
type: learning
topic: misc
source: learnings/1790842344778-gh-api-search-issues-with-inline-query-string-can-.md
---

# gh api search/issues with inline query string can fail; use gh search issues

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-01T08:12:24.778Z
---

# gh api search/issues with inline query string can fail; use gh search issues

`gh api "search/issues?q=repo:shader-slang/slang+Foo+in:title,body+created:>2026-09-20" --jq ...` returned "unexpected end of JSON input" (the `>` / `,` / `+` in the unencoded query trips it). `gh search issues --repo shader-slang/slang "Foo Bar" --created ">2026-09-20" --json number,state,title` works reliably for the same lookup. Use that for "has anyone filed an issue for X yet?" checks in Discord/maintainer sweeps.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790842344778-gh-api-search-issues-with-inline-query-string-can-.md`_
