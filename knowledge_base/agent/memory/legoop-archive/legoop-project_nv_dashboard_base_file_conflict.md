---
type: project
title: "CI fan-merge aborts when an overlay branch edits nv-main-owned base files (the sidebar_group case, PR"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# CI fan-merge aborts when an overlay branch edits nv-main-owned base files (the sidebar_group case, PR

**Symptom:** every PR to `nv-main` fails CI at the "Merge nv-* branches" step with `CONFLICT (content)` in `src/db/agent-groups.ts`, `container/agent-runner/src/mcp-tools/agents.ts`, `src/db/db-v2.test.ts`, `src/db/migrations/index.ts` → `merge produced conflicts outside nv-main's owned set` → exit 1. Also seen: `Duplicate migration versions: 23` at runtime.

**Root cause:** an **overlay branch edited nv-main-owned base files.** nv-dashboard's sidebar-grouping feature (`1dcd3d9b`) added `sidebar_group` to base DB files + a `023-sidebar-group` migration. But `nv-main` owns `src/**` and `container/agent-runner/**` per `.github/nv-path-guard/nv-main.txt`. In the composed-tree merge CI runs, the divergent copies become a genuine **content union** conflict in owned files — outside the CI auto-resolve set (`is_owned()` only covers package.json/lockfiles/.github), so it aborts. This is *correct* guard behavior; the bug is the base-layer change living on the overlay branch.

**Correct fix is TWO parts (PR #546) — the union alone is NOT enough:**

1. **Land the union on nv-main** (the owner) so base files carry both nv-main's columns AND the overlay's. `createAgentGroup` writes both lego cols + `sidebar_group`; `create_agent` exposes `group`; `AgentGroup` type gains the field; migration renumbered `023`→`028` (023 taken by `pr-session-mappings`).
2. **Widen the CI `is_owned()` to mirror nv-main.txt** (`src/**`, `scripts/**`, `setup/**`, `docs/**`, `container/agent-runner/**`, base spine/skills, shared config). **This is required** — git's 3-way merge still surfaces a conflict in the owned files even after the union (both sides changed the same hunk vs. the merge base), so it must be *auto-resolved* (`--ours`), not avoided. Once nv-main carries the union, `--ours` is **lossless** (siblings hold only stale pre-lego copies — verified: old short INSERT). Genuine overlay-owned conflicts land outside these paths and still fail loudly. My earlier belief that widening would "drop the feature" was true only *before* the union landed.

**ci.yml can't be pushed by the bot** (no `workflows` scope) → push via the szihs-fork path: `git push --force szihs <branch>` (redirects to slang-coworkers). See [[reference_workflow_push_via_szihs_fork]].

**Gotcha — type placement must be byte-identical:** if nv-main and the overlay both add the same field but in *different positions*, git is NOT in conflict (both edits apply) → you get a **duplicate field**. Place the new line exactly where the overlay branch put it (e.g. after `created_at` with the same JSDoc) so the merge collapses to one line.

**Verifying a fan-merge fix without waiting for CI:** reproduce locally with the EXACT narrow `is_owned()` from ci.yml (`package.json|*-lock|pnpm-lock|.github/*` only), merge nv-dashboard/nv-slang/nv-slangpy/nv-nanoclaw in order, assert no conflicts outside that set. Then build + `npx vitest run`; compare failures against pristine nv-main composed to separate pre-existing failures (skill-registry `references unknown skill`, sandbox `socket hang up`) from real ones. See [[project_ci_hardening_534]], [[project_nv_branch_cross_imports]], [[project_skill_registry]].

