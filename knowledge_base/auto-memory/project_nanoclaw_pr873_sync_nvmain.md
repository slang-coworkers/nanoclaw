---
name: project_nanoclaw_pr873_sync_nvmain
description: "slang-coworkers/nanoclaw#873 human-authored nv-main upstream sync — reviewed inline, no reviewer coworker exists, author owns merge"
metadata:
  node_type: memory
  type: project
  originSessionId: pr873-webhook
---

**slang-coworkers/nanoclaw#873** — `Sync nv-main with upstream/main (0c0f4c25)`, `sync/upstream-nv-main` → `nv-main`. **Human-authored by szihs (Harsh Aggarwal, NVIDIA maintainer)** — NOT bot-generated. 3 files, +23/−21. `pr_ready_for_review` webhook fired 2026-07-10 with task "route to reviewer coworker."

**Handled inline by Main — NOT routed.** Same repo-class as [[project_nanoclaw_pr864_sync_blocked]] / #868 / [[project_nanoclaw_pr871_funnel_cron]]: platform-infra fork, NOT in the product-coworker routing map, and **no `nanoclaw-reviewer` wired** (only product-scoped `slang-reviewer`/`slangpy-reviewer` — wrong domain for platform code). Do NOT route a NanoClaw-platform sync PR to compiler/SlangPy reviewers.

**Inline review verdict: clean, nothing to flag.** Diff is ~90% prettier/whitespace reflow (destinations.ts, poll-loop.ts wrapping). Two real changes, both sound & documented in PR body:
- `poll-loop.ts:1505` — `in_reply_to: routing.taskFire ? null : inReplyTo` — folds in upstream's task-fire null-ing while keeping the fork's `resolvedOverride` seq-as-id fix. `routing.taskFire` confirmed in RoutingContext per author.
- `docs/architecture-diagram.md` — drops `schedule_task` from MCP tools list (moved to `ncl tasks` CLI upstream).

**CI:** `check`✓ `label`✓, `ci` pending at review time (→ `UNSTABLE` merge state only b/c ci pending, `mergeable: MERGEABLE`). PR body: local verify GREEN (host build ✓ · vitest 1307 pass/0 fail · validate:templates ✓ · container typecheck ✓). Known pre-existing: 3 `dispatchResultText — critique-gate` bun tests fail identically on un-merged parent (533dd83e) — fork harness issue, out of scope, don't gate on it.

**Merge is the author's** (human maintainer's own PR; also within [[feedback_nv_coworkers_automerge]] for nv-main). No GitHub comment posted — nothing substantive to add to a clean, self-verified human PR (comment hygiene). On redelivery: state unchanged; do NOT route to product reviewers, do NOT re-review.
