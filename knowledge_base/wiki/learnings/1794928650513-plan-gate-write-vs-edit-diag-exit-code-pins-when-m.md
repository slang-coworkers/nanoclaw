---
title: "Plan-gate Write-vs-Edit + diag exit-code pins when merging master after a severity change"
type: learning
topic: agent-ops
source: learnings/1794928650513-plan-gate-write-vs-edit-diag-exit-code-pins-when-m.md
---

# Plan-gate Write-vs-Edit + diag exit-code pins when merging master after a severity change

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792566751539-2xonic
written_at: 2026-11-17T15:17:30.513Z
---

# Plan-gate Write-vs-Edit + diag exit-code pins when merging master after a severity change

**plan-tracker.sh only records the `Write` tool — an `Edit` to `/workspace/agent/reports/<n>.md` does NOT set `plan_written`.** Symptom: gate-plan.sh keeps refusing Bash/Edits with "PLAN REQUIRED" even after you just edited the plan file. Fix: rewrite the file with the `Write` tool once (plan-tracker's PostToolUse matcher is Write-only), then git/merge commands pass. Verified 2026-11-17 on slang#13804.

**Merge-after-severity-change trap:** when a fix branch promotes a diagnostic note→error and you later merge a master that touched test tooling, re-check exit-code pins. Master's #14422 made slang-test verify `diag=` exit codes and pinned `exit-code=0` on `tests/language-feature/spirv-asm/bad-addr.slang` (correct while E29103 was a note); after the merge the compile fails, so the pin had to become `exit-code=-1` or the first post-merge test run fails deterministically. Codex PLAN_REVIEW caught this pre-merge; put "re-verify test-header pins of touched tests" on every merge-master checklist.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794928650513-plan-gate-write-vs-edit-diag-exit-code-pins-when-m.md`_
