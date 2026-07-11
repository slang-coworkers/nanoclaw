---
name: project_12040_ir_legalization_quadratic_parked
description: "#12040 IR type-legalization O(N²) on straight-line fns — self-filed+self-assigned contributor, PARKED (no auto-fixer)"
metadata: 
  node_type: memory
  type: project
  originSessionId: a1dc4b0c-28d6-45b2-80d3-9ab352f189e3
---

shader-slang/slang#12040 — `IRTypeLegalizationPass::processModule` is ~O(N²) in a function's instruction count even with nothing to legalize; pass runs 3-4×/compile so it dominates compile time for large straight-line functions (loop-unroll/inline shape). Measured ~2.9× per doubling; #12023 sweep fits ∝N^1.8-2.0.

**Two mechanisms (triager CONFIRMED structurally against HEAD 258a984c1):**
1. ~55-60% — bit1 ("added this round") wiped module-wide each round (@3819); re-add gated only on that bit → each round re-legalizes finalized insts. Straight-line chain advances O(1)/round → O(N) rounds × O(N).
2. ~40-45% — per-round `resetScratchDataBit` walk (util.cpp:1972) is O(module) × O(N) rounds; hottest leaf.

Code: source/slang/slang-ir-legalize-types.cpp @3695-3960, @4099-4119; slang-ir-util.cpp @1958-1984.

**Approach A (author's own, recommended):** change-driven re-queue (re-queue a user only when an operand's legalized value actually changed) + scoped bit clearing (clear only bits the round set, or round-stamp). Load-bearing correctness point: the "operand changed" test MUST treat inst-replacement (simple flavor @3899-3901) and struct→tuple splitting as a change, else a dependent inst gets skipped. Approach B = Mechanism-2-only (scope the reset) as a low-risk first slice. C rejected.

**Status: PARKED (07-10).** Author jvepsalainen-nv (external contributor) self-filed + SELF-ASSIGNED, gave full fix recipe, AND authored the MERGED analogous fix #11954 (simplifyIR quadratic). Same posture as [[project_12035_overload_diag_reasons]] / #12038 — do NOT auto-dispatch slang-fixer against an engaged owner. Deliverable = triage + verified verdict posted to GitHub. Re-engage only on maintainer/author comment, PR, or webhook. Correctness gate for any eventual PR: tests/legalization/ + type-legalize compute tests must stay green (CPU/spirv-asm, no GPU).
