---
type: project
title: "The nv-* fan-merge into nv-coworkers is done LOCALLY on each instance by /update-nanoclaw-instance — NEVER pushed to origin/nv-coworkers. "
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# The nv-* fan-merge into nv-coworkers is done LOCALLY on each instance by /update-nanoclaw-instance — NEVER pushed to origin/nv-coworkers. Pushing it produces a huge misleading diff and is wrong.

**Never push a fan-merge to `origin/nv-coworkers`.** The nv-main→nv-dashboard→nv-slang→nv-slangpy→nv-nanoclaw fan-merge is performed **locally on each instance** by the `/update-nanoclaw-instance` skill (Step 7 reset + Step 8 merges). The resulting merge commits live only on that box's local `nv-coworkers` and are never pushed back.

`origin/nv-coworkers` is NOT the integration tip — it only receives **periodic upstream syncs** (e.g. PRs #434 "Sync nv-coworkers with upstream/main"). It sits far behind the nv-* leaves by design.

**Evidence (2026-06-02):** prod's local `nv-coworkers` HEAD was **353 commits ahead** of `origin/nv-coworkers` (all local fan-merge commits) and only **5 commits behind `origin/nv-main`**. So prod's normal local update is a tiny 5-commit merge.

**The mistake I made:** opened PR #533 pushing a fan-merge branch INTO origin/nv-coworkers. Because origin/nv-coworkers is ~222 commits behind nv-main, the diff was **502 files with 12 deletions** (migrations renumbered 014→025, claude-md-compose.ts → src/claude-composer/ refactor, etc.). Those deletions are legitimate nv-main renames/restructures, NOT data loss — but shipping them as one giant PR is the wrong mechanism. Closed #533, deleted the branch.

**Correct way to ship an nv-main fix to prod:** run `/update-nanoclaw-instance` on the prod box. It locally merges origin/nv-main (+ other leaves), rebuilds, restarts. A fix merged to nv-main reaches prod via this pipeline — no origin/nv-coworkers push needed.

**Migration safety note:** the migration runner (`src/db/migrations/index.ts`) tracks applied migrations by **`name`** (export shape), not filename/number. So renumbering files (014-container-configs → 025-container-configs) is safe as long as the `name:` field is stable — a renumber is not a re-run.

Related: [[project_issue_comment_mention_gate]] (the #525 fix being deployed), [[feedback_service_restart_kills_containers]] (the cost of the prod restart the update triggers), [[reference_systemd_units]] (prod = `nanoclaw.service`).

