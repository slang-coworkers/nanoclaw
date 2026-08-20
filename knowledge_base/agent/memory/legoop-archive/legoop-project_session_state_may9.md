---
type: project
title: "legoop-project_session_state_may9.md"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

## Completed (May 9-10)

### A/B/C/D Testing — DONE
- Discord A/B/C/D, Triage A/B/D, Fixer A/B/D — all compared
- Results: groups/orchestrator/memory/full-abcd-comparison-v2.md
- Key: C (critique) catches 45% errors, D (buddy) catches laziness, A fastest

### Infrastructure — ALL MERGED
- PR #237 (merged): A/B/C/D test infra + buddy overlay + proxy/codex fixes → nv-main
- PR #238 (merged): Discord types + REST fallback → nv-slang  
- PR #239 (merged): PR→session mapping (migration 023 + MCP tool + delivery action) → nv-main
- PR #240 (merged): Auto-detect PR creation hook (gh pr create + curl) → nv-main

### Origin branches (current HEAD)
- nv-main: fd4da16 — auto-detect PR creation (#240)
- nv-slang: a357729 — discord types + REST fallback
- nv-coworkers: e44f6a3 — squashed base

### Open items for next session
- Test report_pr_created end-to-end with real PR (agent creates PR → hook detects → agent calls tool → mapping recorded → webhook routes correctly)
- Run issues #808 and #806 through triage/fixer pipeline
- Codex provider A/B with real task (not just parity questions)
- Buddy JSONL tailing improvement (currently uses conversation context)
- 1 formatting-only diff on origin (src/modules/pr-mapping/index.ts) — cosmetic, merged via #239

