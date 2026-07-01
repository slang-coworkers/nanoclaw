---
title: "CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)"
type: learning
topic: agent-ops
source: learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md
---

# CONSOLIDATED: GitHub auth & ops in agent containers (gh probes lie; use org-scoped REST / raw token)

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

---

## Update 2026-06-17 (folds ~10 later per-incident notes into this consolidation)

### Installed App permission catalog (authoritative)
`nv-slang-bot` App carries: `actions:write, contents:write, issues:write, pull_requests:write, metadata:read, organization_projects:read`. It does **NOT** carry `workflows` — so it can never push `.github/workflows/*` files (see the workflows-CONSOLIDATED companion). `gh auth status` reports the actor as `nv-slang-bot[bot]` (App id 3311378).

### Canonical write-capability probe
To gate a write during a suspected read-only incident: `gh api repos/<owner>/<repo> --jq '.permissions.push'`. This is the authoritative check — NOT `gh auth status` / `gh api user` (false 401s in containers). Caveat already noted above: a successful *read* proves nothing about write, and `.permissions.push=false` is itself misleading for issue/PR-comment writes (governed by `issues:write`/`pull_requests:write`, not repo push). Net: trust `.permissions.push` for code-push gating; for comment/label writes just attempt the op and trust the exit/URL.

### Workflow DISPATCH / `gh run rerun --failed` 403 — RESOLVED 2026-06-17 (was a gateway routing bug, NOT missing actions:write)
Symptom: `POST .../actions/workflows/{id}/dispatches` or `.../runs/{id}/rerun-failed-jobs` → `403 "Must have admin rights to Repository."` **Do NOT diagnose as "bot missing actions:write" and do NOT escalate to the org or restart the container.** Real root cause (operator-verified): a OneCLI gateway secret-routing collision — a read-only nv-slang-bot **USER PAT** on `/repos/*` was outranking the App token on the REST actions path (no specificity sort; newest tuple wins). Discriminator that proves routing vs permission: the same probe gives **422 "No ref found"** from the host (fresh App token, bypassing the gateway) but **403** through the container/gateway; meanwhile comment/PR writes keep returning 201. Fix applied 2026-06-17 ~07:48Z: dedicated App-token gateway secret (`8d85bfeb`, literal path prefix `/repos/shader-slang/slang/actions/*`, written last in the 30-min refresh cron so it stays newest). Verified live: dispatch on master → 204; `gh run rerun <id> --failed` → exit 0 (run flipped failed→queued). **Resume reruns/dispatches freely.** If the 403 recurs, check that `8d85bfeb` still exists and is the newest tuple on the actions path — don't re-escalate "grant actions:write."

### Merge-queue requeue (`enqueuePullRequest`) — STILL BLOCKED (structural, distinct from the above)
The bot **cannot** requeue PRs to the `shader-slang/slang` merge queue, even for non-fork, APPROVED, green-head PRs. GraphQL `enqueuePullRequest` → `UNPROCESSABLE: "You're not authorized to push to this branch."` This rides branch-protection push-authorization (the bot is not an authorized merger to protected `master`), NOT the REST-actions gateway path — so the 2026-06-17 fix does **not** touch it, and it is likely permanent. The container's `gh` also lacks `gh pr merge --merge-queue`. **CI-babysitter rule:** treat merge-queue evictions as always-escalate-for-human-requeue; log `action:"left"`. Don't conflate the two blocks: rerun = (now-fixed) gateway 403; requeue = (structural) merge-queue push auth.

### Editing the bot's OWN comments
- REST `PATCH /repos/<o>/<r>/issues/comments/{id}` can 403 `"Must have admin rights to Repository"` even on the bot's own comment (permissions vary across container resets). **Workaround:** GraphQL `updateIssueComment` — resolve node id (`gh api .../issues/comments/<id> --jq .node_id` → `IC_...`), then `gh api graphql -f query='mutation($id:ID!,$b:String!){updateIssueComment(input:{id:$id,body:$b}){issueComment{updatedAt}}}' -f id=<node_id> -f b="$(cat body.md)"`. General rule: if a REST mutation 403s with an admin-rights message, try the GraphQL equivalent before concluding write is blocked.
- A session can edit/delete **only the comments it itself created** — editing another session's comment 403s even though both render as the same bot. Consequence: two tiers posting on one issue produce comments neither can later consolidate (needs a human). Rule: exactly ONE tier owns the issue-level 5-bullet (edited in place); the other tier puts status in artifacts it controls (e.g. the fixer uses the PR description).

---

## Update 2026-06-28 (folds 5 later per-incident gh-auth notes into this consolidation)

Re-verified live 2026-06-28: `gh auth status` → "token in GH_TOKEN is invalid"; `gh api user` → 403; `gh api repos/shader-slang/slang --jq .full_name` → `shader-slang/slang`. The false-negative pattern is unchanged. Three additional nuances from 2026-06-26 incidents:

### Degraded-session matrix — REST labels can 403 independently while everything else works
In a *partially* degraded gateway session (`gh auth status` invalid + `gh issue view` returns **empty** + `gh api rate_limit` → `app_not_connected` 401), the working REST/GraphQL paths still succeed: `gh api repos/.../issues/<n>` (read), `PATCH .../issues/comments/{id}` (edit own comment), and GraphQL `updateIssue(... issueTypeId ...)` (set Issue **Type**). But `POST .../issues/<n>/labels` can return **403 "Must have admin rights to Repository"** — this is the proxy's REST-labels path degrading, **NOT** a permission loss (the bot labels fine in healthy sessions; the label exists). Don't thrash: set Issue **Type** via GraphQL (works), then defer the label to a healthy session / the normal triage flow. A label is rarely load-bearing once Type is set. (Observed #11782/#11784, 2026-06-26.)

### Read-only fallback: WebFetch the public HTML when `gh` is dark
When the token is invalid every `gh` call can silently return **empty** (not an error) — easy to mistake for "no result"; confirm with `gh auth status` first. For READ-ONLY needs on public repos, `WebFetch("https://github.com/<owner>/<repo>/issues/<N>")` retrieves title, body, author, state, labels, assignee with no token (unblocked triage of #11719 fully offline). WebFetch cannot post/label/set-type, and may miss long/collapsed comment threads — for a definitive comment-history/dup sweep you still need `gh` once the path is back.

### Don't abort the `/slang-pr-review` pipeline on an auth-status warning
Reviewer preflight (`install.sh` "gh auth not configured" / `gh auth status` non-zero) is **not** a reason to abort — Reviewer A's `gh pr diff` / `gh api repos/.../pulls/N` work for public `shader-slang/slang`. Verify the real read endpoint before deciding gh is broken. Posting back is separately gated by the `<github-post-authorized />` marker.

### Comment-author login is `nv-slang-bot` (User), not `nv-slang-bot[bot]`
The bot's comment `.user.login` is `nv-slang-bot` with `.user.type == "User"` — **no `[bot]` suffix** (the `[bot]` form only appears as the `gh auth status` actor). Edit-in-place guards that compare `$LOGIN` against the literal `"nv-slang-bot[bot]"` never match → they always POST a fresh duplicate instead of PATCHing. Fix: match `nv-slang-bot` (or accept both: `case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) PATCH ;; *) POST ;; esac`). More robust: persist the comment id in the `.gh-comments/<repo>-<num>.id` cache and PATCH it directly; only post fresh when a non-bot author has commented since.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md`_
