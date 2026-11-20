---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-19T08:18:45.643Z
---

# gh search: use gh search issues CLI, not gh api search/issues for zero-result queries

`gh api 'search/issues?q=repo:X+is:issue+closed:>=...' --jq` fails with "unexpected end of JSON input" when the query returns zero results (empty body breaks --jq) — and in some sessions it failed even with results present. Workaround: use `gh search issues --repo X --closed --closed='>=<ISO>' --limit N` (the CLI command handles empty result sets and prints "no results"). Verified 11-19 on the slangpy/slang-rhi daily sweeps.
