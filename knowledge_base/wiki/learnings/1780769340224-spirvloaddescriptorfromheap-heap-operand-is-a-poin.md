---
title: "SPIRVLoadDescriptorFromHeap heap operand is a pointer global at emit — never parameterize it in call-spec"
type: learning
topic: slang-compiler
source: learnings/1780769340224-spirvloaddescriptorfromheap-heap-operand-is-a-poin.md
---

# SPIRVLoadDescriptorFromHeap heap operand is a pointer global at emit — never parameterize it in call-spec

# SPIRVLoadDescriptorFromHeap heap operand is a pointer global at emit — never parameterize it in function-call specialization

Follow-up to "spvDescriptorHeapEXT path — fix function-call specialization allowlists". When you route `kIROp_SPIRVLoadDescriptorFromHeap` through function-call specialization (the #11498 fix, PR #11502), the **naive mirror of the `IRCastDescriptorHandleToResource` branch is WRONG** and produces invalid SPIR-V. This bug was caught by Reviewer A on round 1 and is non-obvious.

## The trap

`kIROp_SPIRVLoadDescriptorFromHeap` has operands `{ heap, index }`. Both are `uint`-typed **at the IR level**. So the obvious mirror of the cast branch is: create two new `uint` params (`newHeap`, `newIndex`), pass both as new call args, re-emit the load inside the cloned callee from the two params. This **builds, passes a text-only FileCheck test, and passes the full `tests/bugs/` suite** — but it is broken.

The `heap` operand is not an ordinary value. It is the `kIROp_SPIRVResourceHeap` / `kIROp_SPIRVSamplerHeap` builtin global (`hoistable = true` in `slang-ir-insts.lua`, created by `IRBuilder::emitSPIRVResourceDescriptorHeap` / `emitSPIRVSamplerDescriptorHeap` at `slang-ir.cpp:~3185` with `getUIntType()`). At emit, `emitDescriptorHeapBuiltinVar` (`slang-emit-spirv.cpp:6975`) materializes it as an `OpUntypedVariableKHR` **pointer** in `UniformConstant` storage, decorated `BuiltIn ResourceHeapEXT`/`SamplerHeapEXT`. `emitDescriptorHeapLoad` uses that global **directly as the base pointer** of `OpUntypedAccessChainKHR`.

So parameterizing `heap` as a `uint` `OpFunctionParameter` makes the cloned callee's `OpUntypedAccessChainKHR` base a `uint` scalar, not a pointer. The validator error (only visible under `SLANG_RUN_SPIRV_VALIDATION=1`, NOT in `//TEST:SIMPLE` text FileCheck):

```
error: OpFunctionCall Argument <id> '65[%slang_resourceHeap]'s type does not match Function <id> '6[%uint]'s parameter type.
```

## The correct shape

Reuse the heap global directly inside the cloned callee; parameterize ONLY the index:
- `getCallInfoForArg`: `ioInfo.key.vals.add(oldArg->getFullType()); ioInfo.key.vals.add(loadFromHeap->getHeap()); ioInfo.newArgs.add(loadFromHeap->getIndex());` — heap goes in the KEY (for cache-uniqueness: resource-heap vs sampler-heap globals must not share a clone), NOT in newArgs.
- `getSpecializedValueForArg`: create one `newIndex` param; `builder->emitLoadDescriptorFromHeap(oldArg->getFullType(), loadFromHeap->getHeap(), newIndex)`. The heap global is hoistable/module-level, so it's dominance-safe to reference from the cloned callee.

Key on the **result type T** (not operand types like the cast branch does) because `(heap, index)` operand types are uniform `uint` across all heap loads — keying on operand type wouldn't distinguish per-resource specializations.

## Use the named accessors + helper

`IRSPIRVLoadDescriptorFromHeap` generates `getHeap()` / `getIndex()` accessors (used at `slang-ir-byte-address-legalize.cpp:1068` and `slang-ir-spirv-legalize.cpp:1361`); `IRBuilder::emitLoadDescriptorFromHeap(type, heap, index)` exists (`slang-ir.cpp:3167`). Use them, not positional `getOperand(0/1)` + raw `emitIntrinsicInst`.

## Meta-lesson: text FileCheck can't catch malformed access-chain bases

⛔ **CORRECTED 2026-08-09 (Main) — see `1786308477834-correction-spir-v-validation-is-gated-by-an-env-va.md`. The unqualified "does NOT run" in the next paragraph is the ONE claim in this family that broke; the two neighbouring leaves that scope it ("not *by default*", "not *locally*") are correct as filed.** Measured at slang `716ec597f`: the gate is `slang-emit.cpp:3268-3290` (the `:3005` cited below is stale), and *"which test directives can't set"* is true but irrelevant — slang-test's spawned `slangc` **inherits** the variable from the ambient environment, and `ci-slang-test.yml:130` exports it on `pull_request` (gated only on non-draft and non-docs-only). So a `//TEST:SIMPLE` spirv/spirv-asm test **does** validate under PR CI unless `-skip-spirv-validation` or incomplete-library mode short-circuits first. Read the claim below as *"does not validate **locally, with the env var unset**"*. ✅ The **remedy** it recommends — pin the access-chain base in the FileCheck instead of trusting validation to fire — is unaffected and is still the right advice, for the reason given in the correction: an assertion on the concrete artifact survives someone flipping the env var.

`//TEST:SIMPLE(filecheck=...):-target spirv-asm` does NOT run SPIR-V validation — `shouldRunSPIRVValidation` (`slang-emit.cpp:3005`) gates on the `SLANG_RUN_SPIRV_VALIDATION=1` env var, which test directives can't set, and CI on draft PRs may be skipped. So a malformed `OpUntypedAccessChainKHR` whose base is the wrong type still emits the `Op…` strings a text FileCheck looks for and PASSES. For descriptor-heap / access-chain fixes, EITHER run `SLANG_RUN_SPIRV_VALIDATION=1` out-of-band before trusting "tests pass", OR write a FileCheck that pins the access-chain base to the heap builtin global (e.g. `CHECK: OpUntypedAccessChainKHR {{.*}} %slang_resourceHeap`) rather than just asserting the op exists.

To exercise the buffer-load-arg site (`FuncBufferLoadSpecializationCondition`) you need a deferable struct param (>128 B, the `kBufferLoadElementSizeSpecializationThreshold`) loaded from `DescriptorHandle<StructuredBuffer<BigStruct>>` — e.g. a `BigStruct` of three `float4[8]` arrays (384 B). A non-array `SamplerState`/`Texture2D` won't reach it (rejected by `isTypePreferrableToDeferLoad`).

Verified at HEAD `ffe92ec` of fix/issue-11498 (PR #11502); reviewer 4-round APPROVE-no-findings.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780769340224-spirvloaddescriptorfromheap-heap-operand-is-a-poin.md`_
