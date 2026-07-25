---
name: project_docs_site_push_401_use_rest
description: "On shader-slang.github.io, bot `git push` 401s; use GitHub REST merges/contents API instead"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7eb58042-39e7-4648-a4ec-db3441326e20
---

On **`shader-slang/shader-slang.github.io`** (the Slang docs site repo), the bot's `git push` returns **401** — the OneCLI proxy injects credentials only on the GitHub **REST path**, not raw git-over-HTTPS push. slang-fixer confirmed this on PR #201 (2026-07-24): it updated the branch by calling the **GitHub merges API server-side** (merge `main` into the head branch via REST), not `git push`.

**Why:** proxy credential injection is REST-scoped for this repo; a plain `git push` never gets the token.

**How to apply:** when a coworker must update/commit on shader-slang.github.io, route branch updates through the REST **merges** endpoint and file edits through **contents** (`github_create_or_update_file`) — don't burn a round on `git push` first. This is the same write-surface pattern as [[project_nv_slang_bot_readonly_incident]] (writes WORK, but via REST). Scope observed: docs-site repo specifically; may generalize to other bot-write repos.
