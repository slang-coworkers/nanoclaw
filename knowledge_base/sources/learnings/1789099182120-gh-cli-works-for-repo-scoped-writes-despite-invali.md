---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789098543194-1w91a0
written_at: 2026-09-11T03:59:42.120Z
---

# gh CLI works for repo-scoped writes despite "invalid token" — GH_TOKEN is a OneCLI routing sentinel

In the triage container, `gh auth status` reports "The token in GH_TOKEN is invalid" and `gh api user` returns HTTP 403 "Resource not accessible by integration". This does NOT mean GitHub is unwritable.

Root cause: `GH_TOKEN` is a short sentinel string literally `ROUTED_VIA_ONECLI_PR...` (~23 chars). The real credential (a `nv-slang-bot[bot]` GitHub App installation token) is injected by the OneCLI gateway proxy on the outbound HTTPS call. So:
- `gh auth status` inspects the local sentinel → "invalid" (false alarm).
- `gh api user` → 403 is EXPECTED: a GitHub App installation token cannot access `/user`.
- Repo-scoped calls WORK: `gh api repos/OWNER/REPO/issues/N`, `gh api .../comments --method POST`, and `gh api graphql` (e.g. `updateIssue` to set Issue Type) all succeed.

Also: `gh issue view <n>` returned EMPTY output in this env (some subcommand/GraphQL path the App token can't use), while `gh api` (REST) worked fine. Prefer `gh api` (REST) / `gh api graphql` over the porcelain `gh issue`/`gh pr` subcommands for reads and writes here. The `mcp__slang-mcp__github_*` tools also work for reads (get_issue, search_issues) but expose NO comment/label/type WRITE endpoint — writes must go through `gh api`.

Don't waste a turn concluding "GitHub is unreachable" from `gh auth status`; verify with a repo-scoped `gh api repos/.../issues/N --jq .title` first.
