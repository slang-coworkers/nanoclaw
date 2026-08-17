---
title: "Conditional SPIR-V capability by operand constness → new backend IR op, NOT spirv_asm-block iteration (jkwak, #9382)"
type: learning
topic: slang-compiler
source: learnings/1784164953340-conditional-spir-v-capability-by-operand-constness.md
---

# Conditional SPIR-V capability by operand constness → new backend IR op, NOT spirv_asm-block iteration (jkwak, #9382)

**Context:** shader-slang/slang#9382 — `Gather(s, uv, int2(2,1))` (compile-time-constant offset) wrongly
emitted `OpImageGather ... Offset` + `OpCapability ImageGatherExtended`. A constant offset should use
`ConstOffset` (no capability); only a *runtime* offset needs `Offset`/`ImageGatherExtended` (kept reachable
via GLSL `textureGatherOffset`, #5426/#5339). The capability must therefore be **conditional on offset constness**.

**Maintainer principle (jkwak-work, issue #9382 cmt 4986908901) — now stated as a general rule:**
> "Slang doesn't iterate over instructions inside a `spirv_asm` block. Previous attempts iterated them to
> figure out if the offset was compile-time-constant. The **principled approach is to remove the function body
> from the frontend (`*.meta.slang`) and re-implement the behavior on the backend by adding a new IR** op. The
> backend figures out constness, then decides which capability to request."

**Rule:** When a stdlib intrinsic authored as a `spirv_asm` block needs a *conditional* emit decision
(operand mask / capability) that depends on a property of an IR operand (constness, type, shape):
- ❌ Do NOT add an IR/legalize pass that walks the children of the `spirv_asm` block and rewrites/injects
  instructions in place (the rejected #11655 `processImageGatherOffset`). Slang has no idiom for iterating
  authored asm-block instructions, and rewriting an already-valid authored opcode's operand mask / injecting
  an `OpCapability` post-hoc is a novel, contested pattern.
- ❌ Do NOT use a meta.slang marker helper (e.g. `__requireImageGatherExtended(offset)`) that only *gates the
  capability* — it cannot change the `Offset`→`ConstOffset` **operand**, so at **-O0** you get
  `Offset`-without-capability = invalid SPIR-V (spirv-opt only folds the operand at -O1+; `-target spirv-asm`
  masks this). The constant case needs the actual `ConstOffset` operand, not just a gated capability.
- ✅ DO: add a first-class IR op (`slang-ir-insts.lua` + stable name + `IRBuilder`), route the meta.slang
  `spirv:` case to it via `__intrinsic_op`, delete the `spirv_asm` body + its unconditional `OpCapability`,
  and emit conditionally in `slang-emit-spirv.cpp` (mirror `emitImageLoad`/`emitImageStore` mask assembly):
  const operand → `ConstOffset`/no-cap; runtime → `Offset` + `requireSPIRVCapability(...)`. Classify constness
  on the **IR operand** (`as<IRConstant>`, or `IRMakeVector`/`IRMakeVectorFromScalar` of all-constants), never
  by walking asm children. This is valid at every opt level and keeps the runtime path.

**Validation gate for any such fix:** run variants at `-target spirv SLANG_RUN_SPIRV_VALIDATION=1` **at -O0
specifically** — `-target spirv-asm` can run spirv-opt and hide the pre-fold invalid state.

**Codebase note (gather family, HEAD 623227f86e, hlsl.meta.slang):** the bug is ONLY the two singular
`__texture_gather_offset` blocks (4008-4014 `$sampledImage`, 4063-4067 `$sampler`) — they use `Offset`. The
plural `__texture_gather_offsets` (all-`constexpr`, uses `ConstOffsets`, needs the cap) is correct.
`__texture_gatherCmp_offset` singular (4233/4269) unconditionally emits `ConstOffset` with NO capability — a
**latent mirror-bug** for a *runtime* Cmp offset, but a separate defect (not #9382).

**Meta-note:** deep option-tree analysis done at triage time (`triage-9382-architecture.md`, 2026-06-29)
independently collapsed to exactly this "new IR op" answer weeks before the maintainer confirmed it — the
principled-path analysis converged with the maintainer's call. See wiki concept `slang-backends-spirv.md`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784164953340-conditional-spir-v-capability-by-operand-constness.md`_
