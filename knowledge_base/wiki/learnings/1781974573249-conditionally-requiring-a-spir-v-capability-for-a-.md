---
title: "Conditionally requiring a SPIR-V capability for a stdlib spirv_asm intrinsic forces pass-level block manipulation — layer-choice tree"
type: learning
topic: slang-compiler
source: learnings/1781974573249-conditionally-requiring-a-spir-v-capability-for-a-.md
---

# Conditionally requiring a SPIR-V capability for a stdlib spirv_asm intrinsic forces pass-level block manipulation — layer-choice tree

From slang#9382 / PR #11655 (Gather ConstOffset vs Offset+ImageGatherExtended), HEAD 146e61da5. When a stdlib `spirv_asm` intrinsic in hlsl.meta.slang must CONDITIONALLY require a SPIR-V capability (here: cap needed only for a runtime offset, not a constant one), these are the real options and their constraint:

**The crux:** the `OpCapability` is either authored inline (then the no-cap case must STRIP it) or omitted (then the cap case must INJECT it). Either way a CONDITIONAL approach needs a pass to add/remove an instruction INSIDE the spirv_asm block. Maintainer jkwak-work's stated objection is exactly "Slang doesn't iterate spirv_asm-block instructions as a legalization step." So conditional behavior is fundamentally at odds with "no spirv_asm-pass manipulation."

**Precedent nuance (verify before claiming 'precedent exists'):** `processSPIRVAsm` (slang-ir-spirv-legalize.cpp ~2004) DOES iterate spirv_asm children, and `processConvertTexel` rewrites an operand in place — BUT only to resolve Slang-INTERNAL PLACEHOLDER operands (`__convertTexel`; `Truncate` at slang-emit-spirv.cpp:11105). NO pass at HEAD rewrites an already-valid AUTHORED opcode's operand mask or injects OpCapability. So "post-hoc rewrite an authored opcode + inject cap" is novel; don't tell a maintainer their premise is "factually off" — the nuance supports them.

**Option tree:**
- **A' (single `constexpr` param):** simplest, all in meta.slang, zero pass machinery — but DROPS runtime support (any runtime arg → hard error 40013). Only if the runtime path can be dropped.
- **B (post-hoc pass rewrite, the PR's approach):** works, conditional, but the most contested form.
- **C (new IR op + C++ emit):** capability via the normal `requireSPIRVCapability` path, NO spirv_asm manipulation — the only conditional option that fully satisfies a strict maintainer, but heavy (no gather IR op exists; sample/sampleGrad in slang-ir-insts.lua are unused; would invite migrating the whole spirv_asm Sample/Gather family to C++).
- **D (placeholder-operand idiom):** author a placeholder operand (like `__convertTexel`) resolved in pass/emitter — more precedent-consistent than B, but STILL injects the cap in a pass, so doesn't escape the objection.

**Decision pivot:** must the runtime path stay? NO → A'. YES + strict-on-no-pass-rewrite → C. YES + pragmatic → D over B.

**Also:** Slang does NOT support function overloading distinguished by `constexpr` — overload resolution is constexpr-blind (no ConstExpr refs in slang-check-overload.cpp/slang-check-conversion.cpp; doFunctionSignaturesMatch ignores ConstExprModifier); constexpr is a post-resolution IR rate. So "constexpr-overload" is never a viable frontend route; only a SINGLE constexpr param is.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781974573249-conditionally-requiring-a-spir-v-capability-for-a-.md`_
