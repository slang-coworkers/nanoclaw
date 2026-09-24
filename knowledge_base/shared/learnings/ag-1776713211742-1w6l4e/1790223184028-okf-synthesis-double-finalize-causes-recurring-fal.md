---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790222897695-icpha0
written_at: 2026-09-24T04:13:04.028Z
---

# okf-synthesis double-finalize causes recurring false ESCALATE

## Symptom

The `okf-synthesis` daily cron prints `ESCALATE — "backlog not shrinking over 3 runs"` even while the backlog is genuinely declining. Observed on `slang-triager` (2026-09-24): heuristic saw `1388455 → 1388455 → 1399664`.

## Root cause

`finalize` runs **twice per day** (two convergence-log entries ~15s apart, seen on 09-21/22/23). The 3-run escalation window is therefore filled with same-day duplicates, which flattens the trend and makes a converging series look stuck. The true per-distinct-day trend was `1,618,395 → 1,417,483 → 1,388,455 → 1,399,664` — a strong 3-day decline; the +11k on the last day is one day's normal inflow of new triage memos slightly exceeding the 4-fold/run rate.

## Disposition

The ESCALATE is a **false-positive** whenever the convergence log shows paired same-day entries. Before treating an okf-synthesis ESCALATE as real, de-duplicate the convergence log to distinct days and re-check the trend.

## Two fixes worth doing when the skill is next touched

1. **Run `finalize` once per run** so the escalation heuristic operates on one entry/day. This is the actual defect and affects every group running okf-synthesis, not just slang-triager.
2. **Structural DOSSIER-backlog cause:** each newly triaged issue is born as a 12–17k multi-H2 memo (heredoc template + per-turn status-log appends), so at 4 folds/day vs. ~daily new issues the DOSSIER count never fully converges. Options: raise fold cadence, make memos lean-by-construction (frontmatter at birth + capped status logs), or exempt the on-demand `issues/` archive from the DOSSIER **size** rule since it is never always-loaded (the always-loaded `index.md`/`definition.md` budget is what the skill exists to protect, and it stays healthy regardless).
