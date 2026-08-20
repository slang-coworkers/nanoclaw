---
type: project
title: "nv-dashboard / nv-slang / nv-slangpy / nv-nanoclaw carry 11 stale files (renames+deletes from nv-main) — silently re-dropped every /update"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# nv-dashboard / nv-slang / nv-slangpy / nv-nanoclaw carry 11 stale files (renames+deletes from nv-main) — silently re-dropped every /update-nanoclaw-instance run

Every `/update-nanoclaw-instance` run on lego dev shows ~11 files "missing on HEAD that are on origin/nv-dashboard" after the 8b merge integrity check. They are NOT data loss — they are nv-main deletions/renames that the sibling overlay branches haven't absorbed.

**Why:** nv-main canonically removed/renamed these files when their content was extracted to `skill/*` branches and migrations were renumbered. The sibling overlay branches (nv-dashboard, nv-slang, etc.) still carry the old paths because they were never rebased.

**Renames (file moved on nv-main, sibling still has old path):**
- `src/claude-md-compose.ts` → `src/claude-composer.ts` + `src/claude-composer/` directory
- `src/db/migrations/014-container-configs.ts` → `025-container-configs.ts` (renumbered)
- `src/db/migrations/015-cli-scope.ts` → renumbered into 014–025 block

**Deleted on nv-main (content went to skill/* branches):**
- `container/skills/onecli-gateway/{SKILL.md,instructions.md}`
- `container/skills/frontend-engineer/SKILL.md`
- `container/skills/vercel-cli/SKILL.md`
- `.claude/skills/add-dashboard/resources/dashboard-pusher.ts`
- `.claude/skills/add-deltachat/{REMOVE,SKILL,VERIFY}.md`

**How to apply:**
- During `/update-nanoclaw-instance` step 8 integrity checks, this list of files showing up is **expected, not a bug**. The skill's restore logic correctly skips them (it only restores files that ARE on origin/nv-main; these aren't).
- **Permanent fix would be**: rebase each sibling nv-* branch onto current origin/nv-main (squash-merge style) so they stop carrying the stale paths. See [[project_merge_tree]] / `/split-commit` skill for the cleanup pattern.
- Same pattern likely applies on the slang-coworkers-prod instance — verify with the same integrity check.
- Related: [[project_nv_branch_cross_imports]] (a different drift problem — branches don't build standalone).

