---
type: chain
title: slang#14173 — SPIR-V: `Atomic<float>.sub` aborts with "Unhandled global inst in spirv-emit: neg"
description: BOT-filed by slang-fixer 2026-11-02 11:49Z as a side finding of the #14153 fix (filing policy, no go-ahead needed). FILED-ONLY, fan-out held. The issue_opened webhook needs NO dispatch; the filing fixer is on the #14153 chain.
tags: [spirv, emit, atomics, float, ice, bot-filed, filed-only]
---

# slang#14173 — SPIR-V: `Atomic<float>.sub` aborts with "Unhandled global inst in spirv-emit: neg"

**Origin.** slang-fixer `sess-1793614762821-zcmuu7` (thread `gh-issue-shader-slang/slang-14153`) found this while fixing
[#14153](14153-metal-float-texture-atomic-add.md). Its report is msg 56, 11:50Z. It filed the issue under
[the filing policy](../orchestrator/filing-verified-issues-policy.md), reproduced on master 6815ed82d (Debug), deduped,
with the body passed by codex OUTPUT_REVIEW. I checked live at 11:51Z: author `app/nv-slang-bot`, no labels, no #14153
reference, no @-mentions, no Fixes link. That is R6-clean for #14153.

**Finding (the fixer's).** ICE. It fails with a constant or a runtime operand. `Atomic<int>.sub` and `-emit-spirv-via-glsl` compile. Cause (the fixer's finding): the emitter builds the negation as a new IR `neg` (`slang-emit-spirv.cpp:5813-5817`) after its block was emitted, so `ensureInst` (`:968`) treats it as a global. It also reproduces on a 2026.13.1 build.

**State: filed-only, fan-out held (my call 11:51Z).** No fixer chain. The `issue_opened` webhook needs no dispatch;
a sibling Main session was handling it at 11:49Z. Starting a fixer chain is a fan-out to report to the operator first.

**11:52Z webhook handling (Main `dqhzzj`, thread `gh-issue-shader-slang/slang-14173`).** No triager or fixer dispatched.
I verified it myself at master 6815ed82d: the repro aborts with E99997 (exit 255) on the local Release slangc, and
`-emit-spirv-via-glsl` exits 0. Source: `getSpvAtomicOp` (slang-emit-spirv.cpp:4583-4605) sets `outNegateOperand` for a float
`AtomicSub`. The `kIROp_AtomicSub` case (~5810-5817) then calls `builder.emitNeg` before `inst`, and `emitOpAtomicOp` reaches the new
`neg` via `ensureInst` (:968-985) → `emitGlobalInst`. GitHub dup search found nothing. The issue is open, with no labels and no comments.
Unlike #14162/#14174/#14175 (Metal or validation gaps), this is an ICE on the main SPIR-V path with a one-line user repro.
**Parked on an operator decision:** whether to open a fixer chain. I asked on orchestrator-dashboard at 11:52Z.
Timer: one-shot `recheck-14173-operator-d2f3` (11-04 12:00Z). The issue is bot-filed, so no R6 hold applies, but a fixer must not name #14153.
Sibling Main sessions `hqrskg` (#14174) and `gidghv` (#14175) handle their own webhooks.
