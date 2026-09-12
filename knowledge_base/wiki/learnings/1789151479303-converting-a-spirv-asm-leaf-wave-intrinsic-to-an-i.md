---
title: "Converting a spirv_asm-leaf wave intrinsic to an IR op silently disables its pre-legalization inlining"
type: learning
topic: slang-compiler
source: learnings/1789151479303-converting-a-spirv-asm-leaf-wave-intrinsic-to-an-i.md
---

# Converting a spirv_asm-leaf wave intrinsic to an IR op silently disables its pre-legalization inlining

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788170353236-yikxzf
written_at: 2026-09-11T18:31:19.303Z
---

# Converting a spirv_asm-leaf wave intrinsic to an IR op silently disables its pre-legalization inlining

Context: slang#12848 rework — moved WaveActiveBallot / wave-count-bits from inline `spirv_asm` bodies
to first-class backend-emitted IR ops (SPIRVGroupNonUniformBallot etc.). All the obvious pieces
(lua op, __intrinsic_op wrapper, slang-emit-spirv.cpp emit, dedup pass) were in place and compiled,
but the same-block ballot dedup produced NOTHING — two ballots still emitted.

Root cause (non-obvious cascade): `IntrinsicFunctionInliningPass::shouldInline` in
`source/slang/slang-ir-inline.cpp` inlines a function whose body is only "target-primitive" insts
(`kIROp_SPIRVAsm` / `kIROp_SPIRVAsmOperandInst`) plus trivial insts (load/store/swizzle) into its
caller — and this runs in `linkAndOptimizeIR` BEFORE `legalizeIRForSPIRV`. That pre-legalization
inlining is what places both `WaveActiveBallot(p)` results in ONE basic block, which is the
precondition for any same-block dedup in `slang-ir-spirv-legalize.cpp`.

When the ballot body was `spirv_asm`, the wave helpers qualified as pure intrinsic leaves and were
inlined early. After converting them to a first-class IR op, the bodies contained
`kIROp_SPIRVGroupNonUniform*` instead of `spirv_asm`, so they NO LONGER matched the whitelist →
stayed un-inlined until final emit (after the dedup pass) → the two ballots were never in one block
when the dedup ran.

Fix: add the new ops to that inliner's whitelist (the `hasSpvAsm`/`hasIntrinsic` switch). Principled,
not a workaround — they're backend-emitted SPIR-V primitives filling exactly the role `spirv_asm`
played for that "pure intrinsic leaf" classification.

Takeaways:
1. Any SPIR-V/wave pass that assumes two intrinsic results land in one block depends on
   `IntrinsicFunctionInliningPass` having inlined the leaf FIRST. If you change what a leaf's body is
   made of, re-check that whitelist.
2. A separate but related must-fix: a new IR op defaults to side-effecting in
   `IRInst::mightHaveSideEffects()` (there is no per-op `hasSideEffect` flag — `IROpInfo` only has
   `hoistable`/`global`). A ballot/bit-count that must NOT fence a same-block dedup has to be added to
   the side-effect-free cases in `mightHaveSideEffects()`, while being kept OUT of `isMovableInst`
   (side-effect-free ≠ movable; movable would enable cross-block dedup + loop hoisting, wrong for a
   participation-sensitive op).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789151479303-converting-a-spirv-asm-leaf-wave-intrinsic-to-an-i.md`_
