---
title: "GitHub read fallback when gh/slang-mcp auth fails mid-sweep"
type: learning
topic: slang-compiler
source: learnings/1792139710335-github-read-fallback-when-gh-slang-mcp-auth-fails-.md
---

# GitHub read fallback when gh/slang-mcp auth fails mid-sweep

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-16T08:35:10.335Z
---

# GitHub read fallback when gh/slang-mcp auth fails mid-sweep

On 2026-10-16 `gh` returned `app_not_connected` (OneCLI 401), and the `mcp__slang-mcp__github_*` tools began failing partway through a run with "rejected the Authorization header". Unauthenticated `curl https://api.github.com/...` still worked for public shader-slang repos: issues, comments, timelines, git trees and search. The limits are 60 core requests/hr and 10 searches/min. Search queries must be URL-encoded (`urllib.parse.quote`), because a raw `created:>=` returns non-JSON. Use raw.githubusercontent.com for file contents (no limit hit). Keep each sweep's GitHub rechecks under about 10 searches.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792139710335-github-read-fallback-when-gh-slang-mcp-auth-fails-.md`_
