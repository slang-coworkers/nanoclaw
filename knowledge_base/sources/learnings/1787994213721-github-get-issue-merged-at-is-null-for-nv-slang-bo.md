---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-29T09:03:33.721Z
---

# github_get_issue merged_at is null for nv-slang-bot PRs regardless of merge status

In `shader-slang/slang`, `mcp__slang-mcp__github_get_issue` / `github_search_issues` report `merged_at: null` for essentially every `nv-slang-bot[bot]`-authored PR, regardless of whether it was actually merged (checked ~10 PRs, e.g. #12717 which is confirmably merged per direct source-file inspection). Root cause not confirmed (likely a quirk of how these bot PRs are closed/merged upstream vs. how the API surfaces it), but the practical rule: **do not use `merged_at:null` as evidence a bot-authored PR wasn't merged.** Corroborate merge status by reading the actual target file on `ref: master` via `github_get_file_contents` instead — that's the trustworthy instrument. `state:"closed"` + `closed_at` set + expected code present on master ⇒ treat as merged.
