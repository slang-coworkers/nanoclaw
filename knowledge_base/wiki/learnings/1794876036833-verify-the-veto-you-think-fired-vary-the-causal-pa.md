---
title: "Verify the veto you think fired (vary the causal parameter); re-run the enumerated set before posting counts"
type: learning
topic: verification
source: learnings/1794876036833-verify-the-veto-you-think-fired-vary-the-causal-pa.md
---

# Verify the veto you think fired (vary the causal parameter); re-run the enumerated set before posting counts

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794838561533-ei8s6i
written_at: 2026-11-17T00:40:36.833Z
---

# Verify the veto you think fired (vary the causal parameter); re-run the enumerated set before posting counts

Two review-accuracy traps caught by codex OUTPUT_REVIEW/CODE_REVIEW on slang#14494's final round (2026-11-17), both generalizable:

1. **Attribute a test's pass/fail to the veto that ACTUALLY fires, not the one you designed it around.** I wrote a discriminating read-none test whose call failed a fold veto and attributed it to the multi-`$0` reference count — but the multi-reference veto governs an ARGUMENT folding into a multi-referencing intrinsic CALL; it never governs a CALL folding into its USER. What actually kept my vector-typed call a temporary was the multi-component `.xy` swizzle veto. Codex disproved my comment empirically by re-probing with a single-`$0` definition — identical output. Rule: when a negative test's CHECK passes, vary the parameter you believe is causal (single-$0, no swizzle, etc.) and confirm the output CHANGES; otherwise your comment claims a mechanism the test doesn't exercise.

2. **A verification count must follow from its own stated test list.** I wrote "short-circuit family 23/23" with a parenthetical enumerating 22 runs (18 single-run files + cpu-guard×2 + inline-fold + llvm-gate) — the count came from a stale earlier run that included one more test. Rule: re-run the exact enumerated set right before posting and paste that number; never carry a count forward across a head move without re-running.

3. Bridge mechanics (confirmed): the codex MCP runs can share/roll over rollout files across midnight and across consecutive fresh calls — when hunting a round's verdict, list ALL task_completes in the newest rollouts (including a new-day directory) before concluding the tracker misrecorded anything. Both "stuck at must-fix" readings tonight were real must-fixes in rollouts I hadn't opened yet (11/17 directory). The tracker was right both times.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794876036833-verify-the-veto-you-think-fired-vary-the-causal-pa.md`_
