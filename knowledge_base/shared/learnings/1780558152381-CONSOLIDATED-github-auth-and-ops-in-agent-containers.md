> **[prod-adaptation]** This learning was ported from the dev instance. PROD has **no szihs PAT and no szihs fork**. Prod pushes `fix/issue-<n>` **direct to `origin = shader-slang/slang`** as `nv-slang-bot[bot]` (see `slang-fixer-can-push-fix-branches-direct-to-origin`). Ignore any szihs-fork / personal-token push path below; treat it as historical dev context.

# CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)

*Authoritative consolidation (2026-06-04) of ~16 prior gh-auth/ops learnings. Supersedes the per-incident notes; they remain for history. Companion entries: `…-CONSOLIDATED-github-workflows-and-elevated-permissions.md` and `…-CONSOLIDATED-github-commit-authorship.md`.*

## The one rule
`gh auth status`, `gh api user`, and `gh api repos/szihs/*` are **FALSE-NEGATIVE probes** in our containers. They return 401 / "token in GH_TOKEN is invalid" / "app_not_connected" **even when GitHub reads AND writes work**. NEVER treat them as proof you can't use GitHub, and never self-block / escalate a "token invalid" blocker based on them.

## Why (path-based OneCLI proxy)
GitHub traffic routes through a OneCLI HTTPS proxy that injects credentials by **URL-path match**. The git remote literally contains `x-access-token:placeholder@github.com`; the proxy swaps `placeholder` for the real path-matched secret. `/user` and `auth status` hit a user-scoped endpoint the GitHub-**App installation** token (`nv-slang-bot[bot]`) has no entitlement for → 401. That says nothing about repo/org capability. (`.permissions.push=false` from `gh api repos/...` is likewise misleading — push still works; issue/PR-comment writes are governed by the App's `issues:write`/`pull_requests:write`, not repo `push`.)

## How to verify access (do this, not `gh api user`)
- **Read probe:** `gh api repos/shader-slang/slang --jq .full_name` → returns ⇒ token works.
- **Write:** just attempt the real op; trust its exit code / returned URL. Only escalate if the *actual* write 403s.

## What works on `shader-slang/*` and `slang-coworkers/*`
- **Org-scoped REST** via `gh api repos/<o>/<r>/...` (GET issues/PRs/comments; **POST/PATCH** comments, labels, PR/issue body).
- **`git push`** of `fix/issue-*` branches to origin (same-repo PRs, no fork) and **`gh pr create --draft`**. Dry-run to test: `git push --dry-run origin <branch>`.
- **Raw-token fallback (most reliable when `gh` broker is flaky):** `git push "https://x-access-token:${GH_TOKEN}@github.com/<o>/<r>.git" <branch>` and `curl -H "Authorization: Bearer ${GH_TOKEN}" https://api.github.com/...` for REST writes. Redact token in logs: `sed -E 's#x-access-token:[^@]*@#***@#g'`.

## What does NOT work (use fallbacks)
- **GraphQL** (`gh issue view`, `gh search issues`, `gh api search/issues`) → empty / `app_not_connected`. For reads use REST `gh api repos/<o>/<r>/issues/<n>`; for dup-search, list recent issues via REST and filter client-side.
- **`.github/workflows/*` edits** are rejected — the bot App lacks `workflow` scope. **Do not** patch-fallback or defer to an external maintainer: push the non-workflow part as the bot, then send the workflow **git patch set** up to the **orchestrator**, who pushes it with its personal PAT (only workflow patches). See `…-CONSOLIDATED-github-workflows-and-elevated-permissions.md`.
- Posting to **`slang-coworkers/*`** can genuinely 403 (only `shader-slang/*` has full write) — that's a real limit, distinct from the false probe.
- Auth can also differ **between sessions/days** as proxy creds rotate — re-test on resume, don't trust a stale "blocked" note. **Genuine outages do happen** (e.g. #11356, 2026-06-01: chain-wide token failure blocked PR-open + the observability comment) and are distinct from the false probe: if an *actual* write 403s/fails (not `auth status`), escalate to the orchestrator — do **not** route "act manually on GitHub" to the read-only triage tier, which refuses by role regardless of token.

## Gotchas
- `gh api ... -F body=@/path/file.md` (capital `-F`, `@`) to post a comment body from file; `-f body@file` errors.
- **GraphQL writes are blocked** for the App token: `gh issue comment` fails `GraphQL: Resource not accessible by integration (addComment)` → post via REST `gh api repos/<o>/<r>/issues/<n>/comments -X POST -F body=@file.md` (the App *has* `issues:write`; it's a GraphQL-vs-REST surface gap).
- **Pagination 401:** keep `gh api` / `gh run list` / `gh pr list` to `--limit 100` (one page) — page-2 fetches go unauthenticated through the proxy and 401. Narrow by filter rather than deep-paging.
- **`git push` "Invalid username or token"** with the remote showing `x-access-token:placeholder@…`? A global `insteadOf` rule injects the placeholder; bypass per-push: `GIT_CONFIG_GLOBAL=/dev/null git push https://github.com/<o>/<r>.git HEAD:<branch>` — or use the raw-token URL above.
- shader-slang/slang default branch is **`master`**, not `main` → `gh pr create --base master`.
- clang-format for `./extras/formatting.sh` needs `[17,18)`: `pip install --break-system-packages clang-format==17.0.6`.