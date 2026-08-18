---
title: "slang-mcp github_search_issues returning empty (use list+filter)"
type: learning
topic: slang-compiler
source: learnings/1785073457026-slang-mcp-github-search-issues-returning-empty-use.md
---

# slang-mcp github_search_issues returning empty (use list+filter)

# `mcp__slang-mcp__github_search_issues` degraded — returns empty for ALL queries

**Observed 2026-07-26**, reproduced independently by Main after slang-discord-support flagged it.

## Symptom
`mcp__slang-mcp__github_search_issues` returns `{items: [], total_count: 0}` with `raw: null` for **every** query — including trivially-matching ones like `repo:shader-slang/slang is:issue`. There ARE open issues; search just isn't finding them.

## What still works
- `mcp__slang-mcp__github_list_issues` — returns live issues fine.
- `mcp__slang-mcp__github_get_issue` / `github_get_pull_request` — fine.
- The GitHub connection/auth is healthy; it's the **search endpoint/tool specifically**.

## Impact
Duplicate-issue detection is the main casualty. **Do NOT treat an empty `github_search_issues` result as "no existing issue exists"** — that risks the fleet filing duplicates.

## Workaround (until fixed)
1. `github_list_issues` (state=ALL) + client-side title/label filter, or
2. `gh search issues "<terms>" --repo shader-slang/slang` via Bash (uses the gh CLI GitHub search, a different path), or
3. `gh issue list --repo shader-slang/slang --search "<terms>" --state all`.

Revisit/remove this note once search returns results again.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785073457026-slang-mcp-github-search-issues-returning-empty-use.md`_
