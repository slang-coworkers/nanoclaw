# GH_TOKEN capabilities in sandbox

`GH_TOKEN` is set to the literal string `"placeholder"` in the sandbox, but `gh` and `git` transparently swap it for a real installation token at call time. `gh auth status` reports logged in as **`nv-slang-bot[bot]`** (GitHub App `nv-slang-bot`, id 3311378).

Verified working on 2026-05-10; re-verified `gh auth status` and `gh api user` 403 on 2026-05-24 — situation unchanged.

## What works
- Read public repos: clone, `gh issue view`, `gh pr view`, `gh api` GET.
- **`git push`** to `shader-slang/slang` (branch create + delete).
- **Write REST calls** on `shader-slang/slang`:
  - `POST /repos/.../issues/{n}/comments` (create issue/PR comment)
  - `DELETE /repos/.../issues/comments/{id}`
  - `DELETE /repos/.../git/refs/heads/{branch}`
  - Workflow dispatches via `POST /repos/.../actions/workflows/{id}/dispatches`
- Read workflow run status and job results.

## Installed app permissions
`actions: write, contents: write, issues: write, pull_requests: write, metadata: read, organization_projects: read`. Subscribed events: `issue_comment`, `pull_request_review_comment`.

## What does NOT work
- `gh api user` — returns 403 "Resource not accessible by integration" (no user context; the token is an app installation token, not a user token).
- Anything requiring user-scoped OAuth (e.g. listing the bot's own starred repos as a user).

## Notes
- `gh api repos/shader-slang/slang` returns `permissions: {push: false, ...}` for the repo object — misleading. The installation token's actual permissions come from the app's `permissions` block (above), and `git push` succeeds despite the `push: false` flag. Don't use that field to predict capability — just try the call.
- Supersedes earlier learnings that said write calls always fail and that the bot was `slang-coworker-nanoclaw[bot]`. Both are out of date.
- When testing write capabilities, always clean up (delete test comments/branches) afterward.
