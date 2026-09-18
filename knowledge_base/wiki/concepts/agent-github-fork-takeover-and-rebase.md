---
title: "Agent GitHub Fork-Takeover and Rebase Mechanics"
type: concept
group: agent-infra
tags: [github, nv-slang-bot, gh-cli, fork-takeover, rebase, app-token, auth, outage]
source_count: 3
---

# Agent GitHub Fork-Takeover and Rebase Mechanics

> Companion to the core [GitHub Auth and Operations in Agent Containers](agent-infra-github-auth-operations.md) and its sibling [Agent GitHub Token Boundaries and Write-Blocks](agent-github-token-boundaries-and-write-blocks.md) (Discussions/workflow write-blocks, invalid-token review, the empty-list trap, and the resolved auth-outage contradiction). This page holds PR takeover from a contributor's personal fork, App-installation-token rebase mechanics, and the unauthenticated-REST-read fallback / 07-17 diagnostic remainder.

## TL;DR

- **On a contributor's PERSONAL fork the `nv-slang-bot[bot]` App token CANNOT push, even with `maintainerCanModify: true`** — that flag grants push to maintainer *users*, not to the bot App token. Push to **origin** (e.g. shader-slang/slangpy) directly, where the bot has push rights.
- **Takeover mechanic:** cherry-pick the residual commits onto current `origin/main` in a fresh worktree (PRESERVES the original author, unlike a squash) → push the new branch to origin → `gh pr create --draft` a fresh bot-owned PR → call `report_pr_created` → comment "Supersedes #<old>" on the original (do NOT close it — recommend, let the maintainer decide).
- **Verify each dropped hunk is on main verbatim** (`git show origin/main:<file>`) before dropping it in a rebase-takeover — keeps the diff minimal.
- **A draft→ready flip is normally operator-gated**, but an explicit maintainer request on the PR + parent authorization lifts that gate for that specific PR (merge stays human/CI-gated); CI runs on draft PRs too.
- **On `slangpy-samples`/`slangpy` the `GH_TOKEN` is a GitHub App installation token:** `gh auth status` "token invalid" and `gh api user` 403 are EXPECTED (no user identity), and `--jq .permissions` returns all-false and is unreliable — but `gh issue comment`, comment PATCH, and git push work where the App has scope. Use `https://x-access-token:${GH_TOKEN}@github.com/...` for git; rebase with `git rebase origin/main`, verify equivalence with `git patch-id --stable`, push with `--force-with-lease=<branch>:<old-sha>`.
- **When `gh` suddenly 401s "Bad credentials," the discriminating probe is REST-core-read vs actions/GraphQL** — unauthenticated REST reads can stay up while actions/GraphQL are down, so unauth REST is the read fallback that survives a partial gateway failure. (The 07-16/07-17 outage this came from is RESOLVED — treat the split as diagnostic technique, not current state.)

## PR Takeover From a Contributor's Personal Fork: Bot Pushes to origin, Not the Fork

When taking over a slangpy PR whose head branch lives on a maintainer's PERSONAL fork (e.g. `jhelferty-nv/slangpy`), the `nv-slang-bot[bot]` App token CANNOT push to that fork even when `maintainerCanModify: true` — that flag grants push to maintainer *users*, not to the bot App token (push fails `Authentication failed for '.../jhelferty-nv/slangpy.git'`). Correct prod takeover mechanic (origin = shader-slang/slangpy directly, where the bot has push rights): (1) cherry-pick the residual commits onto current `origin/main` in a fresh worktree — this PRESERVES the original author, unlike a squash; (2) push the new branch to `origin`; (3) `gh pr create --draft` a fresh bot-owned PR, call `report_pr_created`, and comment "Supersedes #<old>" on the original (do NOT close it — recommend, let the maintainer decide). Dropping already-landed hunks during a rebase-takeover keeps the diff minimal — verify each dropped hunk is on main verbatim (`git show origin/main:<file>`) first. A draft→ready flip is normally operator-gated, but an explicit maintainer request on the PR + parent authorization lifts that gate for that specific PR (merge stays human/CI-gated), and CI runs on draft PRs too ([PR takeover from a contributor's personal fork: bot pushes to origin, not the fork](../learnings/1784692103088-pr-takeover-from-a-contributor-s-personal-fork-bot.md)).

## App-Installation-Token Rebase Mechanics

On `slangpy-samples`/`slangpy` from the fixer container the `GH_TOKEN` is a **GitHub App installation token**: `gh auth status` reports "token invalid" and `gh api user` 403s as EXPECTED (the App has no user identity), and `--jq .permissions` returns all-false and is unreliable — but `gh issue comment`, comment PATCH, and git push all work where the App has scope. Use `https://x-access-token:${GH_TOKEN}@github.com/...` for git, and clear a stale, red (out-of-date) branch with a clean `git rebase origin/main` verified by `git patch-id --stable` + `--force-with-lease=<branch>:<old-sha>` ([slangpy-samples auth + rebase mechanics (App installation token)](../learnings/1784768440116-slangpy-samples-auth-rebase-mechanics-app-installa.md)).

## The Unauth REST Fallback and the 07-17 Diagnostic Remainder

When `gh` calls suddenly 401 "Bad credentials," the discriminating probe is **REST-core-read vs actions/GraphQL**: core REST reads (issues, PRs, repo metadata) can keep working via the unauthenticated path even while the `actions` API and GraphQL calls 401 — so unauthenticated REST is the read fallback that survives a partial gateway/credential failure, and the pattern of which paths fail is what characterizes the problem ([GitHub gateway 401 split: actions+GraphQL down, REST reads OK (diagnostic)](../learnings/1784216892956-github-gateway-401-split-actions-graphql-down-rest.md)).

### This specific outage is RESOLVED

The 07-16/07-17 outage this diagnostic came from is **FIXED** — the App-token refresh cron had silently died on a missing `gh` on the newly-migrated host, so the github.com App token expired hourly and every `actions`/GraphQL call 401'd `Bad credentials`; `gh` 2.96 + a guarded refresh cron + git-push split into non-overlapping secrets restored it (verified recovered 07-17 ~11:47Z). Do NOT hold read-only or assume actions/GraphQL are down. Keep the REST-vs-actions-vs-GraphQL split above as a *diagnostic technique* for a future problem, not a current state, and re-diagnose any new 401 cluster from scratch (which paths fail? is the refresh cron alive / is `gh` present?). Full correction and receipts live on the sibling [Agent GitHub Token Boundaries and Write-Blocks](agent-github-token-boundaries-and-write-blocks.md) page.

**Source learnings (3):**
- [GitHub gateway 401 split: actions+GraphQL down, REST reads OK (diagnostic)](../learnings/1784216892956-github-gateway-401-split-actions-graphql-down-rest.md)
- [PR takeover from a contributor's personal fork: bot App token can't push to the fork (even maintainerCanModify) — cherry-pick onto origin, fresh bot PR](../learnings/1784692103088-pr-takeover-from-a-contributor-s-personal-fork-bot.md)
- [GH_TOKEN on samples is an App installation [REDACTED-BEARER_SECRET] 403 is expected, .permissions unreliable; push/comment work — rebase verified by patch-id + force-with-lease](../learnings/1784768440116-slangpy-samples-auth-rebase-mechanics-app-installa.md)

_Catalog: [[wiki/index.md]]_
