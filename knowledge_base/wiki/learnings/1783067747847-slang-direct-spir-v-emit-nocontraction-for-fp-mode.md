---
title: "Slang direct SPIR-V: emit NoContraction for -fp-mode precise at the emitArithmetic choke point (issue #11933)"
type: learning
topic: slang-compiler
source: learnings/1783067747847-slang-direct-spir-v-emit-nocontraction-for-fp-mode.md
---

# Slang direct SPIR-V: emit NoContraction for -fp-mode precise at the emitArithmetic choke point (issue #11933)

**Fix (slang #11933, PR #11935, verified HEAD f4975a7f82):** The direct SPIR-V backend never emitted `NoContraction`, so `-fp-mode precise` was a no-op on `-target spirv`. Fix: in `slang-emit-spirv.cpp`, decorate emitted FP arithmetic with `NoContraction` when the effective fp-mode is `Precise`.

**The single choke point** for scalar/vector/matrix FP arithmetic is `emitLocalInst` → `emitArithmetic` (~:10182) → `emitVectorOrScalarArithmetic` (~:10112). Scalar/vector returns the concrete `OpF*`/`OpVectorTimesScalar`; **matrix decomposes into per-row `emitVectorOrScalarArithmetic` and reassembles via `emitCompositeConstruct`** — so decorate the scalar/vector result and each matrix ROW, NEVER the reassembling `OpCompositeConstruct` (that would be an invalid `NoContraction` target → spirv-val fails).

**Gate on the EMITTED `SpvInst::opcode`, not the IR op** — spirv-val-safe by construction. The eligible set this path can emit is exactly {`SpvOpFAdd,FSub,FMul,FDiv,FRem,FNegate,VectorTimesScalar`}; comparisons emit `OpFOrd*`, integer/bitwise emit other opcodes → naturally skipped. `SpvDecorationNoContraction = 42`; emit via `emitOpDecorate(getSection(SpvLogicalSectionID::Annotations), nullptr, getID(result), SpvDecorationNoContraction)` (mirrors interpolation-mode decorations ~:3360).

**Effective fp-mode resolution:** global `m_targetProgram->getOptionSet().getFloatingPointMode()`, overridden by the enclosing function's `IRFloatingPointModeOverrideDecoration` (found via `getParentFunc(inst)`). NOTE: the global `-fp-mode` option is NOT materialized as a per-function decoration — only auto-diff adds the override (Fast, `slang-ir-autodiff-fwd.cpp:2240`). Guard strictly `== FloatingPointMode::Precise` so fast/default stay unchanged.

**TRAP — do NOT add `case kIROp_PreciseDecoration:` to the SPIR-V `emitDecoration` dispatcher (~:6003)** even though it looks obvious. `IRPreciseDecoration` (the per-decl `precise` modifier, lowered at `slang-lower-to-ir.cpp:3113-3116` by a generic modifier loop) sits on the DECLARATION (var/param/function), not on arith ops → decorating that <id> with NoContraction is invalid SPIR-V. Honoring per-decl `precise` needs glslang-style backward propagation (`propagateNoContraction.cpp`) — a separate follow-up.

**Verification (this build had FileCheck + spirv-dis backend, so `filecheck=` tests DO run locally):** `slangc <t>.slang -target spirv-asm -fp-mode precise` → 4 `OpDecorate %<id> NoContraction` on exact `OpFAdd`/`OpFMul`; fast/default → 0; `SLANG_RUN_SPIRV_VALIDATION=1 -target spirv` exit 0; full `tests/spirv/` 493/493. Test uses `//TEST:SIMPLE(filecheck=TAG): -target spirv-asm ...` with `//TAG: OpDecorate %{{.*}} NoContraction` + `//TAG-NOT: NoContraction` (pattern from tests/spirv/coherent-texture.slang).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783067747847-slang-direct-spir-v-emit-nocontraction-for-fp-mode.md`_
