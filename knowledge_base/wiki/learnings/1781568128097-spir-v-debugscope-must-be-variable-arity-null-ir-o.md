---
title: "SPIR-V DebugScope must be variable-arity (null IR operand crashes buildEntryPointReferenceGraph)"
type: learning
topic: slang-compiler
source: learnings/1781568128097-spir-v-debugscope-must-be-variable-arity-null-ir-o.md
---

# SPIR-V DebugScope must be variable-arity (null IR operand crashes buildEntryPointReferenceGraph)

When fixing Slang's NonSemantic.Shader.DebugInfo IR (e.g. shader-slang/slang#11616, inliner restoring caller scope after `[ForceInline]` under `-target spirv -O0 -g3`):

**Optional IR operands must be modeled as FEWER operands, never a present-but-null operand.**
- A function's ENTRY `DebugScope` is synthesized only at SPIR-V emit time (`slang-emit-spirv.cpp` `emitGlobalInst`, one-operand `emitOpDebugScope(... funcDebugScope)`) — it is never an IR inst. So a top-level caller has no in-IR `DebugScope` for the inliner's backward scan to find; the `emitCalleeDebugInlinedAt` (`slang-ir-inline.cpp`) `!callDebugScope` branch fell to `emitDebugNoScope()`. Fix = restore the caller's own scope via `emitDebugScope(callerDebugFunc, callDebugInlinedAt)`; for a non-inlined caller `callDebugInlinedAt` is null → a ONE-operand `DebugScope`.
- **Gotcha:** building that as a 2-operand inst with a null operand-1 SIGSEGVs in `buildEntryPointReferenceGraph` (`slang-ir-call-graph.cpp` ~:85), which iterates `inst->getOperand(i)` and derefs `operand->getOp()` UNGUARDED. It runs in `processLateRequireCapabilityInsts`, BEFORE SPIR-V emit. Many IR consumers iterate operands unguarded, so a null operand is a latent crash anywhere.
- Correct shape: make the inst variable-arity — 1 operand when the optional is absent, exactly as `IRDebugInlinedAt` already does (`min_operands=5` but built with 4; `getOuterInlinedAt()` checks `operandCount==5`). For `IRDebugScope`: `IRBuilder::emitDebugScope` builds 1 operand when `inlinedAt` is null; `getInlinedAt()` returns `operandCount==2 ? getOperand(1) : nullptr`; add `isInlinedAtPresent()`. The emitter renders the one-operand form when InlinedAt is absent (previously `if(!inlinedAt) return nullptr` = emitted NOTHING).
- `min_operands` (slang-ir.h.lua) is generator metadata, NOT validator-enforced — leave it at the canonical full count (2) to match the `IRDebugInlinedAt` `min_operands=5` convention; lowering only one would create a different inconsistency.

**Deferred-resolution placeholder gotcha:** the restore `DebugNoScope` doubled as a placeholder. When the enclosing function is itself later inlined, the clone loops (`inlineSingleBlockFuncBody`, `inlineMultipleBlockFuncBody`) replaced the cloned `DebugNoScope` with `DebugScope(enclosingFunc, enclosing@outer)`, giving intermediate restores their inline depth. Emitting a one-operand DebugScope instead bypasses that → lost depth. Fix: both clone loops must UPGRADE a cloned one-operand restore `DebugScope` to `DebugScope(scope, newDebugInlinedAt)`.

**Sibling mis-nesting gotcha:** a backward scan that only stopped at `DebugNoScope` will, once the restore is a `DebugScope`, walk past one sibling [ForceInline] call's restore and pick up a stale `DebugInlinedAt`. Make the scan stop at the first `DebugScope` and take its `getInlinedAt()` (null for a one-op restore).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781568128097-spir-v-debugscope-must-be-variable-arity-null-ir-o.md`_
