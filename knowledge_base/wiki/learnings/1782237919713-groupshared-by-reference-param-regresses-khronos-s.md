---
title: "groupshared by-reference param regresses Khronos SPIR-V; fix is Khronos-gated inlining keyed on param RATE"
type: learning
topic: slang-compiler
source: learnings/1782237919713-groupshared-by-reference-param-regresses-khronos-s.md
---

# groupshared by-reference param regresses Khronos SPIR-V; fix is Khronos-gated inlining keyed on param RATE

When a bare `groupshared T s[N]` function parameter is lowered **by-reference** (e.g. to fix D3D losing TGSM — slang#10641), it becomes a pointer into the `Workgroup` storage class. The **Khronos backends cannot carry that as a function parameter**: GLSL has no pointers, and a SPIR-V `Workgroup` pointer cannot cross a function boundary without the `VariablePointers` capability. Symptom on direct SPIR-V: the non-inlined callee gets the param declared `_ptr_Function` while its `OpAccessChain`s and the call argument (the `Workgroup` global) are `_ptr_Workgroup` → `getPtrTypeWithAddressSpace` debug assert at `slang-emit-spirv.cpp:8744` (`!ptrTypeWithNoAddressSpace->hasAddressSpace()`) → on a **debug** build the `-vk` lane *aborts at compile* (assert throws), and with `release-assert-only` it emits SPIR-V that fails validation (`OpFunctionCall Argument type does not match Function parameter type`).

**Fix (principled, +1 if-stmt):** extend the existing Khronos-gated fallback `GLSLResourceReturnFunctionInliningPass::shouldInline` (`source/slang/slang-ir-inline.cpp`, run at `slang-emit.cpp` under `if (isKhronosTarget(...))`) to also inline a callee that has a `groupshared`-rate parameter — the same remedy already used for resource params. Inlining makes the param vanish; accesses fall directly on the `Workgroup` global. HLSL is unaffected (pass is Khronos-only), so the native `groupshared` param form still emits there.

**KEY GOTCHAS:**
- Key on the param's **RATE** (`as<IRGroupSharedRate>(param->getRate())`), NOT its value type. The value type is `uint[N]` which is perfectly legal, so `isIllegalGLSLParameterType` (value-type-only) never flags it. The `groupshared`-ness lives on the rate (same idiom `processParam`/`processGlobalVar` use in spirv-legalize).
- Explicit `Ptr`-to-groupshared params (`ptr-to-groupshared-noinline-signature.slang`) carry the address space **on the pointer**, not as a rate → they do NOT match `getRate()` and are correctly untouched.
- Mesh **payload** params also lower to a groupshared rate, but they're entry-point inputs (never call-site-inlined), so no exclusion is needed — verified by compiling task/mesh entry points to validated SPIR-V. Don't add a speculative `IRHLSLMeshPayloadDecoration` exclusion (no test demands it).

**Rejected first attempt:** recovering `GroupShared` from the rate inside `SpirvAddressSpaceAssigner::getLeafInstAddressSpace` — insufficient (fixes only the global's leaf; the param stays `_ptr_Function`). Address-space recovery is the wrong layer for a cross-function `Workgroup` pointer SPIR-V can't legally pass anyway; inline it away instead.

**Lesson:** "non-D3D targets already worked" claims about a by-VALUE param do NOT carry over once you change lowering to by-REFERENCE — the new pointer param is a fresh Khronos-emit shape. Validate `-target spirv` with `SLANG_RUN_SPIRV_VALIDATION=1` locally even when the GPU `-vk` execution lane is unsupported (Vulkan backend "Not Supported"); a debug build hits the assert at compile time, exactly like CI's test-linux-debug-gcc lane.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782237919713-groupshared-by-reference-param-regresses-khronos-s.md`_
