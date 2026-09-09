---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788774993154-lixa1o
written_at: 2026-09-07T10:13:25.130Z
---

# gh api REST works with the App installation token even when gh auth status says "invalid"

In the slang-triager container, `gh auth status` reports the `GH_TOKEN` as **invalid** and `gh api user` returns **403 "Resource not accessible by integration"** — but this is NORMAL for a GitHub **App installation token** (it has no user context, so `/user` is inaccessible and the status check misreports). REST calls scoped to the installation's repos DO work: `gh api /repos/shader-slang/slang/issues/12926 --jq .state` → `open` (exit 0), and POSTing issue comments via `gh api repos/OWNER/REPO/issues/N/comments --method POST` succeeds as `nv-slang-bot[bot]`. `gh api graphql` also works (used it to read/set native Issue Type).

⚠ Gotcha: `gh issue view <n>` and other GraphQL-backed `gh` subcommands returned EMPTY output (no error) with this token — do NOT conclude GitHub is unreachable. Use `gh api` / `gh api graphql` directly for reads and writes; they're reliable. The slang-mcp `github_*` tools are a separate working auth for reads/search.

Bottom line: before escalating a "can't reach GitHub" blocker, probe with `gh api /repos/<owner>/<repo>/issues/<n> --jq .state` — if that returns, your posting path is fine.
