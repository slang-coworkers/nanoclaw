---
name: nv-coworkers auto-merge authority
description: Standing authority to push/PR/merge into nv-coworkers on the slang-coworkers/nanoclaw fork without per-instance confirmation
type: feedback
originSessionId: 5adec55f-8a2d-4dfa-b91c-c22a1dc18b0a
---
For the **`slang-coworkers/nanoclaw`** fork (fork of `nanocoai/nanoclaw`), I have standing authority to push, open PRs, and **merge automatically** into the **`nv-coworkers`** branch — no per-instance confirmation needed.

**Why:** dashboard-admin granted this on 2026-06-12 after the knowledge_base snapshot PR ([#640](https://github.com/slang-coworkers/nanoclaw/pull/640), merged). `nv-coworkers` is the fork's default/integration branch; this is internal coworker infra, not a public shader-slang repo.

**How to apply:**
- Scope is `slang-coworkers/nanoclaw` → `nv-coworkers` merges only. Does NOT override the slang-repo guardrails (drafts-only / ready-flip / merge gates govern `shader-slang/slang` fixer PRs on `fix/issue-*` — separate context).
- CI (`ci.yml`) only triggers on PRs into `main`, so `nv-coworkers` PRs have no CI gate.
- **Exact permission reality (verified 2026-06-12) — do not re-derive from `.permissions`:**
  - `gh api repos/.../permissions` shows `admin:true,push:true` for the App, but that is MISLEADING. GitHub App tokens are gated by the App's *declared permission set*, independent of repo role.
  - The `nv-slang-bot` App has `contents:write` → **pushing feature branches works**. It does **NOT** have `pull_requests:write` → `gh pr create`/`gh pr merge` return `Resource not accessible by integration`. A repo admin-*role* grant does NOT add this; the App's permissions must be edited + re-consented on the installation.
  - **Direct push to `nv-coworkers` is BLOCKED** by ruleset "Protect nv-* branches" (active) → "push declined due to repository rule violations". The ruleset requires a PR but **0 approvals, 0 checks** — so a bot-opened PR would merge instantly once the App has `pull_requests:write`. There is NO direct-push fallback.
  - Net: until the App gets `pull_requests:write`, the bot can only push a `kb-sync-<date>` branch; a human (or a `pull_requests:write` identity) must open+merge. #640 was opened+merged by the admin for this reason.
- **Nightly task** `task-1781254392903-zpezu2` (03:00 UTC daily, new_session, created 2026-06-12) does the sync; it attempts PR open+merge and gracefully degrades to "push branch + ping dashboard" if `pull_requests:write` is still missing.
- Knowledge-base content lives under `knowledge_base/` at repo root: `shared/learnings/`, `agent/memory/`, `agent/docs/`, `auto-memory/`. Baseline ~462 files. `rsync` is NOT installed in the container — mirror via `rm -rf <dest> + cp -rL`.
