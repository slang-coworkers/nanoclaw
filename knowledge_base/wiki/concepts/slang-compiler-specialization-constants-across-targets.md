---
title: "Slang specialization constants across targets: spec-constant array sizes, glslang spellings, and dangling [numthreads] operands"
type: concept
group: slang-backends
tags: [slang, specialization-constant, SpecializationConstant, vk-constant-id, spec-const, array-size, glsl, glslang, wgsl, metal, hlsl, cuda, dxil, spirv, OpSpecConstantOp, collectGlobalUniformParameters, numthreads, E55205, E99999, E99997, isSpecConstRateType]
source_count: 3
---

# Slang specialization constants across targets

A `[SpecializationConstant]` / `[vk::constant_id]` global is native only on SPIR-V. Every other target has to emit it as something else: GLSL and SPIR-V-via-GLSL go through glslang's own spec-constant handling, WGSL uses `override`, and HLSL, CUDA and CPU fold it into the global-params struct in `collectGlobalUniformParameters`. This page collects what breaks when a spec constant is used as an array size or as a `[numthreads]` operand. WGSL `override` emission rules are on [[wiki/concepts/slang-backends-wgsl-f16-and-const-expressions.md]].

## TL;DR

- **An array sized by a spec constant works only on SPIR-V**, for groupshared, struct-field and function-local arrays alike. GLSL/WGSL/Metal fail with E99999 because `emitInstExpr` has no `kIROp_GlobalParam` case. HLSL/CUDA rewrite the size into a `globalParams` read: HLSL emits a VLA that DXC rejects (slangc exits 0), and CUDA aborts with E99997 or "circularity during codegen".
- **"HLSL works" claims about spec-constant array sizes are wrong.** Always compile to `-target dxil` for the downstream verdict.
- **glslang gives every spelling of a spec-constant size expression its own `OpSpecConstantOp`.** So `kN * 2` spelled at a caller and in a callee's `out` parameter are two array types, and the copy-out keeps only element 0: a silent wrong result through `-emit-spirv-via-glsl`. A bare `kN` size is fine. Emit each module-scope spec-constant value used by an `IRArrayType` once, as a named `const`.
- **Run an IR check for spec-constant array sizes on HLSL/CUDA after specialization, not before `collectGlobalUniformParameters`.** After the rewrite the size is still `isSpecConstRateType`, and running it earlier gives dead-code false positives and misses generic-argument arrays.
- **Arithmetic spec-constant sizes are hoistable constexpr ops that only the SPIR-V emitter handles.** For GLSL/WGSL, rewrite them to ordinary ops before target legalization, which reuses WGSL's shift/select legalization.
- **On HLSL/CPU/CUDA a spec-constant `[numthreads]` operand is a removed inst with a null type.** Never read its type between collect and emit. On SPIR-V, do not hoist a `makeVector` with a spec-constant constituent to an `OpConstantComposite`.
- **E55205 (numthreads spec constant) is the diagnostic precedent.** The collect pass already skips NumThreads users so they can be diagnosed later.
- **slangc returns 255 for every compile error**, so an acceptance criterion like "exit 1, not 255" cannot be met.

## Spec-constant array sizes fail on every non-SPIR-V target (#14030, #10214)

This was checked on master 9b3ac252d (2026-10-29, #14030 / #10214). An array sized by a `[SpecializationConstant]` works only on SPIR-V, and that holds for groupshared, struct-field and function-local arrays alike. The other targets fail through two different mechanisms [Slang: spec-constant array sizes fail on every non-SPIR-V target (two different mechanisms)](../learnings/1793292087744-slang-spec-constant-array-sizes-fail-on-every-non-.md):

- **GLSL, WGSL and Metal.** The final IR keeps `Array(T, %kTile)` with `%kTile = global_param`. `CLikeSourceEmitter::emitVal` (slang-emit-c-like.cpp:834) sends the size to `emitInstExpr`, which has no `kIROp_GlobalParam` case, so the compile fails with E99999 "unexpected IR opcode during code emit".
- **HLSL and CUDA.** These targets have no spec-constant layout rules, so `collectGlobalUniformParameters` (slang-emit.cpp:1363) rewrites the count into a `globalParams.kTile` read. HLSL then emits a VLA: slangc exits 0, but DXC rejects it. On the #10214 shape, CUDA aborts with E99997 "needed a known integer value" from `getIntVal` (slang-emit-cpp.cpp:1187), or with "circularity during codegen".

So a claim that "HLSL works" for this pattern is wrong until `-target dxil` has given the downstream verdict. E55205 (a spec constant in `[numthreads]`) is the diagnostic precedent: the collect pass already skips NumThreads users so they can be diagnosed later [Slang: spec-constant array sizes fail on every non-SPIR-V target (two different mechanisms)](../learnings/1793292087744-slang-spec-constant-array-sizes-fail-on-every-non-.md).

## glslang spellings, check placement, and arithmetic sizes (#14030, PR #14049)

glslang gives every *spelling* of a specialization-constant expression its own `OpSpecConstantOp`. Consider `float a[kN * 2]` at a caller and `out float b[kN * 2]` in the callee. They become two distinct `OpTypeArray` types, and the copy-out keeps only element 0, which is a silent wrong result through `-emit-spirv-via-glsl`. A bare `kN` size is fine. PR #14049 fixes this in Slang's GLSL emitter: it declares each module-scope spec-constant value used by an `IRArrayType` once, as a named `const` (`getFoldPolicy` → Never) [glslang miscompiles out-array copies when a spec-constant size expression is spelled twice; check spec-const arrays after specialization](../learnings/1793303171753-glslang-miscompiles-out-array-copies-when-a-spec-c.md).

An IR check that must see spec-constant array sizes on HLSL/CUDA does NOT need to run before `collectGlobalUniformParameters`. That pass runs before specialization and DCE, so a check there gives dead-code false positives and misses arrays sized by generic arguments. After the rewrite the size is `@SpecConst load(get_field_addr(globalParams, k))`, and `isSpecConstRateType` still holds, so run the check after specialization. Arithmetic spec-constant sizes are hoistable `constexpr*` IR ops that only the SPIR-V emitter handles; for GLSL/WGSL, rewriting them to ordinary ops before target legalization reuses WGSL's shift/select legalization. Finally, slangc returns 255 for every compile error, so an acceptance criterion like "exit 1, not 255" cannot be met [glslang miscompiles out-array copies when a spec-constant size expression is spelled twice; check spec-const arrays after specialization](../learnings/1793303171753-glslang-miscompiles-out-array-copies-when-a-spec-c.md).

## `[numthreads]` operands on targets without specialization constants

**`[numthreads]` operands are dangling on targets without specialization constants.** On HLSL/CPU/CUDA, `collectGlobalUniformParameters` (slang-ir-collect-global-uniforms.cpp:332-339) folds a `[vk::constant_id]` global into the global-params struct and `removeAndDeallocate`s it, but deliberately skips the `IRNumThreadsDecoration` use so E55205 can be diagnosed later. The decoration's operand is then a removed inst with a cleared type, and any pass between collect and emit that reads that type (e.g. `builder.emitCast(int, op)` in `materializeGetWorkGroupSize`) segfaults in `_getTypeStyleId(nullptr)`. Touch spec-const-rate operands only on targets that keep them (an `isSpecConstRateType(op->getFullType())` guard is itself a read of the dead type). The suite missed it because no test called `WorkgroupSize()` with a spec-const `[numthreads]` on HLSL/CPU; /code-review found it on #13767 (PR #13826). On SPIR-V, the cast of a `uint` spec const to `int` is an `OpSpecConstantOp`, and `maybeHoistConstructInstToGlobalScope` then hoists an all-module-scope `makeVector` to an `OpConstantComposite` with a spec-const constituent, which spirv-val rejects; skip the hoist when any operand is spec-const rate [[numthreads] operands on non-spec-const targets are dangling](../learnings/1792609336816-slang-numthreads-operands-on-non-spec-const-target.md). The missing casts in that splice are on [[wiki/concepts/slang-b-language-semantics.md]].

**Source learnings (3):**
- [spec-constant array sizes: E99999 on GLSL/WGSL/Metal (no GlobalParam case), VLA on HLSL (DXC rejects), E99997 on CUDA; run `-target dxil` (#14030, #10214)](../learnings/1793292087744-slang-spec-constant-array-sizes-fail-on-every-non-.md)
- [glslang mints one `OpSpecConstantOp` per spelling, so out-array copies keep element 0; emit named consts; run the HLSL/CUDA check after specialization; slangc returns 255 (#14030, PR #14049)](../learnings/1793303171753-glslang-miscompiles-out-array-copies-when-a-spec-c.md)
- [Slang: [numthreads] operands on non-spec-const targets are dangling (null type) — never read their type](../learnings/1792609336816-slang-numthreads-operands-on-non-spec-const-target.md) — `collectGlobalUniformParameters` removes the spec const but skips the decoration use; `materializeGetWorkGroupSize` cast segfaults (#13826); don't hoist spec-const makeVector on SPIR-V
