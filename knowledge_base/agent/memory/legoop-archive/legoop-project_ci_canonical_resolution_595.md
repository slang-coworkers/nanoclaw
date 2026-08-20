---
type: project
title: "ci.yml composed-merge step fleet-fix — old abort-on-conflict dropped nv-main (sidebar_group schema fail); --ours leaves pkg/lock mismatch "
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# ci.yml composed-merge step fleet-fix — old abort-on-conflict dropped nv-main (sidebar_group schema fail); --ours leaves pkg/lock mismatch on leaf bases; fix = resolve owned conflicts to origin/nv-main

**2026-06-05.** PR #589 (base nv-slangpy) CI failed `SqliteError: table agent_groups has no column named sidebar_group`. Two layered bugs in the composed-state merge step of `.github/workflows/ci.yml`:

1. **Old abort-on-conflict** (`git merge … 2>/dev/null || git merge --abort`) on nv-slangpy + nv-dashboard: any conflict on an nv-main-owned infra file silently dropped the ENTIRE nv-main merge → lost migration `028-sidebar-group` + the auto-discovery migration loader, while nv-dashboard's `createAgentGroup` (INSERTs sidebar_group) still landed → column never created. Same class as [[project_ci_hardening_534]].
2. **`--ours` is wrong for leaf bases**: nv-main's hardened step (already on nv-slang/nv-nanoclaw/nv-main) resolves owned conflicts with `git checkout --ours`. When BASE is a leaf, HEAD=leaf, so `--ours` keeps the leaf's STALE package.json while the lockfile auto-merges nv-main's added deps → `pnpm install --frozen-lockfile` mismatch. Copying nv-main's step verbatim does NOT fix a leaf base.

**Fix (uniform across all 5 branches):** resolve owned-file conflicts to `git checkout origin/nv-main -- "$f"` (canonical), NOT `--ours` — keeps package.json+lockfile a consistent pair regardless of merge direction. Plus `git fetch origin nv-main` up front so the ref exists when nv-main is itself the BASE. Conflicts OUTSIDE nv-main's owned set still `exit 1`. PRs #590(slangpy)/#591(slang)/#592(nanoclaw)/#593(main)/#594(dashboard), all merged.

**Mechanic gotcha:** for `pull_request` events the workflow runs from the PR's **merge ref** = head's ci.yml merged with base. Fixing the BASE branch's ci.yml is NOT enough to re-green an open PR whose HEAD still carries the old ci.yml — you must merge the updated base INTO the PR head branch (then push head via szihs fork path, since it's a `.github/**` change). That's what finally fixed #589.

Related: [[project_ci_hardening_534]], [[project_ci_yml_propagation]], [[project_nv_dashboard_base_file_conflict]], [[reference_workflow_push_via_szihs_fork]], [[project_fanmerge_is_local_only]].

