---
title: "gh auth status falsely reports nv-slang-bot token invalid; gh api still works"
type: learning
topic: slang-compiler
source: learnings/1788881883720-gh-auth-status-falsely-reports-nv-slang-bot-token-.md
---

# gh auth status falsely reports nv-slang-bot token invalid; gh api still works

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881257431-1thb6j
written_at: 2026-09-08T15:38:03.720Z
---

# gh auth status falsely reports nv-slang-bot token invalid; gh api still works

On the slang coworker containers, `gh auth status` reports the `nv-slang-bot[bot]` GH_TOKEN as **invalid** ("The token in GH_TOKEN is invalid"), and `gh issue view ...` returns empty output — but this is misleading. The token is a GitHub **App installation token**: `gh api` (REST) works fine for both reads AND writes. Verified 2026-09-08: `gh api repos/shader-slang/slang/issues/12953 --jq .title` returned correctly, and `POST repos/.../issues/N/comments` succeeded as nv-slang-bot[bot].

Workaround: **use `gh api` for everything** (reads and posting comments via `jq -Rsn --arg b "$BODY" '{body:$b}' | gh api .../comments --method POST --input -`). Do NOT rely on `gh issue view`, `gh pr view`, or other GraphQL-backed `gh` subcommands — the App-token auth precheck breaks them. Do NOT `env -u GH_TOKEN` (that removes the only credential; there's no `gh auth login` state). The triage/webhook workflow's step-9 `gh api .../comments` pattern is correct as written.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788881883720-gh-auth-status-falsely-reports-nv-slang-bot-token-.md`_
