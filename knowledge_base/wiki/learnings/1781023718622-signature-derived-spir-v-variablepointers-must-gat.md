---
title: "Signature-derived SPIR-V VariablePointers must gate on [noinline], not hasUses() (driver bug #9061)"
type: learning
topic: slang-compiler
source: learnings/1781023718622-signature-derived-spir-v-variablepointers-must-gat.md
---

# Signature-derived SPIR-V VariablePointers must gate on [noinline], not hasUses() (driver bug #9061)

When declaring a SPIR-V capability from a function's *signature type* (vs. a value/operation site), gate it on the function actually surviving inlining — use `irFunc->findDecoration<IRNoInlineDecoration>()`, NOT `hasUses()`.

**Context (shader-slang/slang #11518 / PR #11521):** The fix declared `VariablePointers` for any function whose signature carried a Workgroup/StorageBuffer pointer, via a walk at the top of `emitFunc` in slang-emit-spirv.cpp. That over-fires: a helper like `foo(Ptr<Data,GroupShared>)` that gets **inlined** leaves a dead `IRFunc` whose orphan function-type `%N = OpTypeFunction %void %_ptr_Workgroup_Data` still exists, but the real code only has direct `OpAccessChain` on the groupshared global — no actual variable pointer. Declaring the cap for that dead signature is spurious.

**Why it bit:** For Workgroup pointers, emitting `VariablePointers` re-triggers a **graphics-driver miscompile (#9061)** that produces WRONG compute results. The existing test `tests/language-feature/pointer/ptr-to-groupshared.slang` deliberately compiles with `-g0` specifically to avoid the cap (its `-g` variant is `//DISABLE_TEST` for the same #9061 reason). The over-broad declaration defeated that, so the GPU `(vk)` run returned wrong values and FileCheck failed.

**Two traps:**
1. `hasUses()` does NOT discriminate inlined-away functions — an inlined `foo` still reports uses (e.g. via its surviving orphan function-type). Verified empirically: the `hasUses()` guard left the cap at count 1. `IRNoInlineDecoration` is the right discriminator (mirrors the `SpvFunctionControlDontInlineMask` logic already in `emitFuncDeclaration`). SPIR-V forbids recursion + Slang inlines aggressively, so "survives as a real callable function" ≈ "has [noinline]".
2. **GPU-execution regressions are invisible locally and to codex** (no GPU; `slang-test` marks `(vk)` execution tests "ignored"). A local build + spirv-val + codex review all PASSED while the GPU test failed in CI. Use the **SPIR-V capability presence as a local proxy**: `slangc <test> -target spirv-asm -emit-spirv-directly -g0 -entry <e> -stage <s> -o x.spvasm; grep -c VariablePointers x.spvasm` — compare against master's behavior. Then let CI's GPU jobs give the authoritative confirmation.

**Outcome:** Gating on `IRNoInlineDecoration` → inlined test emits 0 `VariablePointers` (matches master, #9061 not triggered), `[noinline]` regression test still emits it (original fix preserved). CI re-run: all 3 `test-slang` GPU jobs green.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781023718622-signature-derived-spir-v-variablepointers-must-gat.md`_
