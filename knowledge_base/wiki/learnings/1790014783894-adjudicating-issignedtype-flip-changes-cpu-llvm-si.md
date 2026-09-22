---
title: "Adjudicating 'isSignedType flip changes CPU/LLVM sign-extension' claims in Slang PR review"
type: learning
topic: slang-compiler
source: learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md
---

# Adjudicating "isSignedType flip changes CPU/LLVM sign-extension" claims in Slang PR review

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790009689697-mg8s8g
written_at: 2026-09-21T18:19:43.894Z
---

# Adjudicating "isSignedType flip changes CPU/LLVM sign-extension" claims in Slang PR review

When a Slang PR flips `isSignedType(<type>)` (e.g. adding `kIROp_IntPtrType` → signed) and a reviewer flags a "silent cross-backend behavior change" in the LLVM/CPU `IntCast` (zero-extend → sign-extend), verify the premise before accepting the finding — it's often wrong. Trace from shader-slang/slang#13202 (verified against source):

1. **int→int widening extension is SOURCE-driven, not dest-driven.** `LLVMBuilder::emitCast(src, dstType, srcIsSigned, dstIsSigned)` in `source/slang-llvm/slang-llvm-builder.cpp` (~:1451) picks `CreateSExtOrTrunc` vs `CreateZExtOrTrunc` from **`srcIsSigned`**. `dstIsSigned` is consulted **only** for float→int (`FPToSI` vs `FPToUI`, ~:1444). `slang-emit-llvm.cpp` kIROp_IntCast (~:1935) passes `isSigned(operand)` as srcIsSigned and `isSignedType(dst)` as dstIsSigned. So `int x=-1; intptr_t y=x;` sign-extends regardless of `isSignedType(IntPtr)` (source `int` is always signed) — flipping the dst classifier does NOT change it. A `-cpu` COMPARE_COMPUTE test on that is **false coverage** (passes with the fix reverted).

2. **The default `-cpu` target never reaches `slang-emit-llvm.cpp` at all.** `isCPUTargetViaLLVM` is true only under `SLANG_EMIT_CPU_VIA_LLVM`; default `SLANG_EMIT_CPU_DEFAULT=0` emits **C++ source** (`render-test-main.cpp` → `SLANG_PASS_THROUGH_GENERIC_C_CPP`), where IntCast is a C-style cast and the host C++ compiler decides extension (`intptr_t` is signed in C++ → sign-extends anyway). Reaching the LLVM IntCast needs explicit `-emit-cpu-via-llvm` / `-target llvm`.

3. **The only genuine GPU-free witness of a `isSignedType(dst)` flip is float→intptr_t on `-target llvm`** (FPToUI→FPToSI, negative float), and only if the `slang-llvm` downstream is buildable in that env.

4. **Where the flip IS first-class-guarded:** the SPIR-V comparison-op selection — `slang-emit-spirv.cpp` `_arithmeticOpCodeConvert` uses `isSignedType(basicType)` (~:841) to pick `OpSLessThan` vs `OpULessThan` (~:868-872). A test asserting `OpSLessThan` on a signed-intptr `<` genuinely fails without the classifier fix. That's the load-bearing coverage; the cross-backend concern is better closed by a one-line invariant comment (sync with canonical `getIntTypeSigned`) than by a non-load-bearing `-cpu` test.

Lesson: reviewers (including the correctness bot) can flag a plausible-sounding "silent cross-backend change" that a source-vs-dest-signedness trace refutes. Adjudicate the exact source/dest types and whether the cited target path even reaches the cited emitter before requiring a regression test.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790014783894-adjudicating-issignedtype-flip-changes-cpu-llvm-si.md`_
