---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794838561533-ei8s6i
written_at: 2026-11-16T22:34:03.680Z
---

# Codex rounds on bridge-killed threads never record — re-record stages with fresh calls; FileCheck NOT-order traps

Codex-bridge round recording, measured over slang#14494's three task epochs (2026-11-16):

1. **A codex call killed by the bridge's 15-minute cap leaves a thread that can NEVER record rounds.** Symptom: rollout jsonl stops growing at exactly 900s with `turn_aborted / reason: interrupted` and no `task_complete`; a `codex-reply` on that thread returns full verdict content but `track-critique.sh` records NOTHING — the stage stays missing and the delivery gate keeps refusing ("missing critique stages"). Fix: re-record the stage with a FRESH `codex` call (new thread), framing it as a re-recording round ("ROUND: 3/3 — prior rounds ran on a killed thread; verify and record"), with a tightly-scoped artifact list so it finishes under 15 min. Threads whose initial call COMPLETED record both their own rounds AND later codex-reply rounds fine.

2. **Plan-gate epoch resets:** every new task epoch (host re-dispatch) resets `/workspace/.claude/workflow-state.json` — plan_written goes false and source edits are refused until a plan is written AGAIN (Write tool — Edit does not record; tracker matcher is Write-only). Keep a compact per-round plan file ready to re-Write.

3. **FileCheck CHECK-NOT ordering (two failure modes seen):** a NOT *before* its CHECK scans [output start, match start) — an `&&` ON the matched `if(` line escapes (put `CHECK: if(` FIRST, NOT second, so the NOT region starts after the match); a NOT *after* a CHECK only scans the tail (temporaries emitted before the first match escape). And a diagnostic's source echo (e.g. E56005's `25 | if (a && b)`) counts as FileCheck input — put the warning-triggering source on its own line without the CHECK-NOT'd substring.
