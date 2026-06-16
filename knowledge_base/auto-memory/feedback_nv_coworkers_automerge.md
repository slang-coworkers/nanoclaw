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
- **Exact permission reality (verified 2026-06-15) — the bot CAN fully self-merge here, but ONLY via REST:**
  - **`gh pr create` / `gh pr merge` (GraphQL) FAIL** with `Resource not accessible by integration`. This is a GitHub-App GraphQL limitation, NOT a missing scope — it misled me for two sessions into thinking `pull_requests:write` was absent.
  - **REST works:** open a PR with `gh api -X POST repos/slang-coworkers/nanoclaw/pulls -f title=.. -f head=<branch> -f base=nv-coworkers -f body=..`; merge with `gh api -X PUT repos/slang-coworkers/nanoclaw/pulls/<n>/merge -f merge_method=squash`; delete branch with `gh api -X DELETE repos/.../git/refs/heads/<branch>`. Verified end-to-end: PR #648 opened+merged by the bot 2026-06-15.
  - **Direct push to `nv-coworkers` is BLOCKED** by ruleset "Protect nv-* branches" → must go through a PR. Ruleset requires a PR but 0 approvals / 0 checks, so the bot's own REST PR merges instantly.
  - `gh api user` / `gh auth status` 403 here — ignore (App-token quirk); repo-scoped writes work.
- **Nightly task** `task-1781522302095-mjy6s1` (03:00 UTC daily, new_session, re-created 2026-06-15) does the full sync→scrub→PR→merge via REST. Earlier task `task-1781254392903-zpezu2` was cancelled.
- **PII scrub** baked into the task: `python3 /workspace/agent/scrub_kb_pii.py --apply knowledge_base` (stable copy outside the clone so `git reset` can't wipe it; also in clone `scripts/`). `--apply` redacts real emails + any secrets/tokens; **intentionally LEAVES** GitHub @handles and internal brevlab URLs (admin said "fine for now" 2026-06-15). Audit-only: `--audit`. Scrub touches the published copy ONLY — live memory under /workspace is never modified.
- Knowledge-base content lives under `knowledge_base/` at repo root: `shared/learnings/`, `agent/memory/`, `agent/docs/`, `auto-memory/`. Baseline ~462 files. `rsync` is NOT installed in the container — mirror via `rm -rf <dest> + cp -rL`.
