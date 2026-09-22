---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790006878834-q3n81m
written_at: 2026-09-21T17:49:25.767Z
---

# slang-llvm emitCast int-widening picks SExt/ZExt by SOURCE signedness, not isSignedType(dst)

When reasoning about whether an `isSignedType(T)` change affects the CPU/LLVM backend's integer casts, check which flag `emitCast` actually consumes. In `source/slang-llvm/slang-llvm-builder.cpp` `LLVMBuilder::emitCast(src, dstType, srcIsSigned, dstIsSigned)`:

- **int→int width change** (e.g. `int` → `intptr_t`): `srcIsSigned ? CreateSExtOrTrunc : CreateZExtOrTrunc` — driven by the SOURCE operand's signedness, NOT `dstIsSigned`. So widening a signed `int` into `intptr_t` sign-extends regardless of `isSignedType(intptr_t)`.
- **`dstIsSigned` (= `isSignedType(dstType)`) is only consulted for float↔int**: `CreateFPToSI/UI` (float→int) and, via `isSigned(operand)` for the source, `CreateSIToFP/UIToFP` (int→float).

The `kIROp_IntCast` arm in `slang-emit-llvm.cpp` calls `emitCast(operand, dstType, isSigned(operand), isSignedType(dst))`. `isSigned(value)` itself resolves to `isSignedType(elementType)`, so flipping `isSignedType(IntPtr)` from false→true changes CPU/LLVM behavior only for casts where an `intptr_t` is the SOURCE of a float conversion (`intptr_t→float`: UIToFP→SIToFP) or the DEST of a `float→intptr_t` (FPToUI→FPToSI) — NOT for `int→intptr_t` widening.

Practical consequences:
- A `-cpu` COMPARE_COMPUTE test of `int x=-1; intptr_t y=x;` does NOT distinguish an isSignedType(IntPtr) fix — verified by A/B: pre-fix and post-fix binaries both output -1. (Also, `-cpu` emits C++ SOURCE via slang-emit-c*, not slang-emit-llvm.cpp at all — that's the slang-llvm JIT downstream, not built in a default Debug build.)
- On the SPIR-V path, `isSignedType(basicType)` at `slang-emit-spirv.cpp:841` selects `OpSLessThan` vs `OpULessThan` (and similar for other comparisons), so a signed vs unsigned pointer-sized `<` in a spirv-asm FileCheck test IS a first-class guard for the classifier.

Lesson: before adding a "pin the behavior" regression test for a shared-classifier change, trace which emitter flag consumes it and A/B the actual binaries — a plausible-sounding test can give false coverage (passes identically with and without the fix). Context: shader-slang/slang#13200 / PR #13202.
