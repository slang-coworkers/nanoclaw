---
title: "GitHub Auth and Operations in Agent Containers"
type: concept
group: agent-infra
tags: [github, onecli, gh-cli, nv-slang-bot, workflows, pr-mapping, auth, proxy, credentials]
source_count: 15
---

# GitHub Auth and Operations in Agent Containers

This page covers everything about GitHub authentication, the OneCLI proxy, the `gh` CLI quirks, PR session mapping, workflow permission limits, and bot identity in NanoClaw agent containers.

## The Core Rule: `gh auth status` Is a False-Negative Probe

`gh auth status`, `gh api user`, and `gh api repos/szihs/*` return 401 / "token in GH_TOKEN is invalid" / "app_not_connected" **even when GitHub reads AND writes work**. Never treat them as proof that GitHub is unavailable, and never self-block based on them ([[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]]).

GitHub traffic routes through a OneCLI HTTPS proxy that injects credentials by URL-path match. The git remote contains `x-access-token:placeholder@github.com`; the proxy swaps `placeholder` for the real path-matched secret. The `/user` endpoint the probe hits is a user-scoped endpoint the GitHub App installation token has no entitlement for — that says nothing about repo/org capability.

**Correct verification:** `gh api repos/shader-slang/slang --jq .full_name` → returns ⇒ token works. For writes, attempt the real operation and trust its exit code.

## What Works and What Does Not

**Works:** org-scoped REST via `gh api repos/<o>/<r>/...` (GET issues/PRs/comments; POST/PATCH comments, labels, PR/issue body); `git push` of `fix/issue-*` branches to origin; `gh pr create --draft`; raw-token fallback via `git push "https://x-access-token:${GH_TOKEN}@github.com/<o>/<r>.git" <branch>` and `curl -H "Authorization: Bearer ${GH_TOKEN}"`.

**Does not work:** GraphQL (`gh issue view`, `gh search issues`, `gh api search/issues`) → empty / `app_not_connected`. Use REST `gh api repos/<o>/<r>/issues/<n>` for reads; list recent issues and filter client-side for dup-search.

**Pagination 401:** keep `gh api` / `gh run list` / `gh pr list` to `--limit 100` (one page) — page-2 fetches go unauthenticated through the proxy and 401. Narrow by filter rather than deep-paging.

**Posting via `--field` with `@`-prefixed body:** `gh api --field body="@username..."` fails — gh interprets leading `@` as "read this from a file." Use `jq -Rs '{body: .}' < file.md | gh api ... --method POST --input -` or `--raw-field` / `-f` ([[wiki/learnings/1778859843367-gh-cli-field-expands-as-file-path.md]]).

## nv-slang-bot App Identity and Permission Catalog

`nv-slang-bot` carries: `actions:write, contents:write, issues:write, pull_requests:write, metadata:read, organization_projects:read`. It does NOT carry `workflows` — it can never push `.github/workflows/*` files. Comment `.user.login` is `nv-slang-bot` (no `[bot]` suffix) — edit-in-place guards comparing against `"nv-slang-bot[bot]"` never match, causing spurious duplicate POSTs instead of PATCHes ([[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]]).

Two bot write operations that hit 403 despite having `issues:write`: (1) setting an issue assignee — create the issue then ask the human requester to self-assign; (2) editing (PATCH) a comment created by a different bot session — post a fresh delta comment instead ([[wiki/learnings/1782388835952-nv-slang-bot-403-on-issue-assign-and-cross-session.md]]).

A session can edit/delete only the comments it itself created — editing another session's comment 403s even though both render as the same bot. Two tiers posting on one issue produce comments neither can later consolidate (needs a human). Exactly ONE tier owns the issue-level 5-bullet (edited in place) ([[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]]).

## GitHub Workflow File Permissions (Structural Block)

The bot App lacks the `workflows` permission. Any commit that creates/edits a file under `.github/workflows/` is rejected on push — the rejection is atomic: the entire push fails including non-workflow files ([[wiki/learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md]]).

Only the orchestrator holds a personal PAT with `workflow` scope. For a workflow change: (1) push the non-workflow part as the bot; (2) produce a git patch set of just the `.github/workflows/*` change; (3) send it up to the orchestrator via `send_file` with the target branch + base sha; (4) the orchestrator applies and pushes the workflow patch with its PAT.

`git push --dry-run` does NOT catch this rejection — it only happens at real push time. The stale-`origin/master` false rejection can trigger the same error text: fix by rebasing onto the real tip (`git ls-remote origin refs/heads/master` → `git fetch origin master` → `git rebase`).

**Workflow DISPATCH vs PUSH are different surfaces:** dispatching/rerunning workflows via `gh workflow run` / `gh run rerun --failed` was transiently 403-blocked by an OneCLI gateway routing bug (now RESOLVED as of 2026-06-17). Merge-queue requeue (`enqueuePullRequest`) remains structurally blocked — the bot is not an authorized merger for protected `master`. Treat merge-queue evictions as always-escalate-for-human-requeue ([[wiki/learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md]]).

## PR-Session Mapping and `report_pr_created`

`report_pr_created({repo, pr_number})` writes the `pr_session_mappings` row pointing at the **session that calls it**. Whichever session fires it last owns that PR's inbound webhook routing ([[wiki/learnings/1782606474451-report-pr-created-remaps-the-pr-to-the-calling-ses.md]]).

When verifying that a PR's mapping exists, do NOT ask a non-owning session to "re-confirm" by re-firing `report_pr_created` — that silently remaps the PR to that session, stealing the PR's review/CI webhooks.

The PR must be opened from inside the fix chain's session (the one on `gh-issue-<owner>/<repo>-<n>`) ([[wiki/learnings/1780723000000-report-pr-created-binds-the-calling-session-not-the-fix-thread.md]]). If a PR is already mis-mapped: `UPDATE pr_session_mappings SET session_id=<fix-session>, thread_id='gh-issue-<owner>/<repo>-<n>' WHERE repo=? AND pr_number=?`. The webhook server reads the mapping live per-event, so no restart is needed.

## Degraded Session Behavior and Fallbacks

In a partially degraded gateway session, working REST/GraphQL paths may still succeed while `POST .../issues/<n>/labels` returns 403. Set Issue Type via GraphQL (works), then defer the label to a healthy session ([[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]]).

When the token is invalid every `gh` call can silently return empty (not an error) — easy to mistake for "no result." For READ-ONLY needs on public repos, `WebFetch("https://github.com/<owner>/<repo>/issues/<N>")` retrieves title, body, author, state, labels with no token. WebFetch cannot post/label/set-type, and may miss long comment threads.

If a REST mutation 403s with an admin-rights message, try the GraphQL equivalent before concluding write is blocked. For editing bot's own comment: resolve node id then use GraphQL `updateIssueComment` mutation ([[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]]).

## The /slang-pr-review Preflight Warning

Reviewer preflight "gh auth not configured" / `gh auth status` non-zero is NOT a reason to abort the `/slang-pr-review` pipeline. Reviewer A's `gh pr diff` / `gh api repos/.../pulls/N` work for public repos. Verify the real read endpoint before deciding gh is broken. Posting back is separately gated by the `<github-post-authorized />` marker ([[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]]).

Reviewer A can review the WRONG PR via stale `tmp/pr-diff.patch` from a prior run. Before any A run on a shared checkout: `rm -f /workspace/agent/slang/tmp/pr-diff.patch`. Independently verify the PR's real diff with `gh pr view <N> -R <repo> --json files,additions,deletions` + `gh pr diff <N> -R <repo> | head` ([[wiki/learnings/1780497941518-slang-pr-review-reviewer-a-can-review-the-wrong-pr.md]]).

## Emsdk and CI Run Logs

Authenticated read of CI logs works even when `gh auth status` shows invalid: `gh run view <run-id> -R shader-slang/slang` and `gh run view --job <job-id> -R shader-slang/slang --log` both work via the read-only proxy path. Use this to find the last-good emsdk version: grep the last green run's wasm-job log for `Resolving SDK version 'X.Y.Z' to 'sdk-releases-<hash>-64bit'` ([[wiki/learnings/1780624123110-find-last-good-emsdk-version-for-an-emsdk-install-.md]]).

---
**Source learnings (17):**
- [[wiki/learnings/1780558152381-CONSOLIDATED-github-auth-and-ops-in-agent-containers.md]] — CONSOLIDATED: GitHub auth & ops in agent containers
- [[wiki/learnings/1778859843367-gh-cli-field-expands-as-file-path.md]] — gh CLI --field expands @ as file path
- [[wiki/learnings/1782388835952-nv-slang-bot-403-on-issue-assign-and-cross-session.md]] — nv-slang-bot 403 on issue-assign and cross-session comment-edit
- [[wiki/learnings/1780558703303-CONSOLIDATED-github-workflows-and-elevated-permissions.md]] — CONSOLIDATED: GitHub .github/workflows/* pushes and elevated permissions
- [[wiki/learnings/1782606474451-report-pr-created-remaps-the-pr-to-the-calling-ses.md]] — report_pr_created remaps the PR to the CALLING session
- [[wiki/learnings/1780723000000-report-pr-created-binds-the-calling-session-not-the-fix-thread.md]] — report_pr_created binds the CALLING session — open the PR from the fix thread, not a chat
- [[wiki/learnings/1780497941518-slang-pr-review-reviewer-a-can-review-the-wrong-pr.md]] — slang-pr-review Reviewer A can review the WRONG PR via stale tmp/pr-diff.patch
- [[wiki/learnings/1780624123110-find-last-good-emsdk-version-for-an-emsdk-install-.md]] — Find last-good emsdk version for an emsdk-install-latest regression from the green run log
- [[wiki/learnings/1780356530581-slang-maintainer-container-cannot-post-to-github.md]] — slang-maintainer container cannot post to GitHub
- [[wiki/learnings/1780769325863-slang-ci-splitting-a-build-test-job-git-bash-path-.md]] — Slang CI: splitting a build/test job — Git-Bash-PATH gotcha + bot cannot push workflow files
- [[wiki/learnings/1779985772055-marked-block-sha256-pattern-for-cross-file-drift-d.md]] — Marked-block sha256 pattern for cross-file drift detection
- [[wiki/learnings/1781245034372-holding-a-fixer-pr-as-draft-enables-clean-maintain.md]] — Holding a fixer PR as draft enables clean maintainer supersession
- [[wiki/learnings/1782162119070-broad-blast-radius-lowering-changes-need-a-full-lo.md]] — Broad-blast-radius lowering changes need a FULL local slang-test sweep
- [[wiki/learnings/1782215118821-nvapi-render-tests-silently-ignored-submodule-fetc.md]] — NVAPI render-tests silently ignored — submodule→FetchContent migration left render-test path stale
- [[wiki/learnings/1782579642375-slang-11568-maintainer-base-pr-on-11723-is-a-layer.md]] — slang #11568: maintainer "base PR on #11723" is a layer-mismatch

_Catalog: [[wiki/index.md]]_
