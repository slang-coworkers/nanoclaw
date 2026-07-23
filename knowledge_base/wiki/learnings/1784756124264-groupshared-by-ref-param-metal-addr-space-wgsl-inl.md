---
title: "groupshared by-ref param: Metal addr-space + WGSL inline-ordering gotchas (#10641)"
type: learning
topic: slang-compiler
source: learnings/1784756124264-groupshared-by-ref-param-metal-addr-space-wgsl-inl.md
---

# groupshared by-ref param: Metal addr-space + WGSL inline-ordering gotchas (#10641)

Follow-up to the CUDA `->m_data` fix (#10641 / PR #11709). Passing a bare `groupshared` array param *by reference* breaks THREE C-like backends, each differently — a green vk/HLSL/SPIR-V run clears NONE of them:

**Metal — silent abort, root cause is the address-space pass, not the emitter.** A by-ref groupshared param has IR type `RateQualified(GroupShared, BorrowInOutParam(Array(...)))`. In `slang-ir-specialize-address-space.cpp` the param-specialization loop did `as<IRPtrTypeBase>(param->getFullType())` — which is **null** through the `RateQualified` wrapper — so the pointer's address space was never specialized, reached the Metal emitter as default, and aborted with `unexpected: Unknown addressspace encountered`. FIX: use `param->getDataType()` (unwraps the rate to the pointer type) + the local `setDataType()` helper (rewraps the rate) instead of `getFullType()`/`setFullType()`. General lesson: **`as<IRPtrTypeBase>` on a parameter's *full* type misses rate-qualified (groupshared/specconst) params — unwrap the rate first.** This pass runs for Metal, WGSL, GLSL, and direct-SPIRV, so the fix is target-wide but low-risk (non-rate params behave identically).

**WGSL — inlining MUST run before `legalizeIRForWGSL`.** Baseline WGSL can't take a `ptr<workgroup>` function param, so the groupshared-by-ref callee must be inlined away. But `legalizeIRForWGSL`'s `legalizeCall` treats a `BorrowInOutParam` as copy-in/out and bridges a module-scope (workgroup) global argument through a `function`-space temp — which for a groupshared param silently reintroduces the per-invocation *whole-array copy* that #10641 exists to remove (emits `var _S2 = groupSharedData; _S2[i]=..; groupSharedData = _S2;` — races, no true sharing). Running the inline pass AFTER legalize only inlines the already-broken copy sequence. Placing it in the WGSL case of the target switch, BEFORE `legalizeIRForWGSL`, makes the callee+param vanish so accesses land directly on the `var<workgroup>` global. A syntactic `WGSL-NOT: ptr<workgroup` check does NOT catch the copy-in/out regression — also assert no `var ... : array<...> = <sharedglobal>` whole-array copy, and add a behavioral compute lane.

**Test the actual downstream compiler.** A `-target cuda` SIMPLE lane only checks emitted *source*; to catch invalid CUDA C++ (member access on a pointer) you need a `-target ptx` lane, which invokes NVRTC on the emitted source (works headless — no GPU device needed, NVRTC is a downstream compiler). Same idea for verifying real compilation on any C-like target.

Also: the CI job `test-linux-release-gcc-x86_64-sm80` runs `tests/neural/` + `tests/cooperative-matrix/` on CUDA+Vulkan — it's the canary for groupshared/coopmat emit regressions. If a groupshared-param change has no Metal/WGSL/CUDA test lane, CI won't catch these; the original #10641 gh-10641.slang had only HLSL/vk/dx12 lanes, which is why Metal's abort shipped.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784756124264-groupshared-by-ref-param-metal-addr-space-wgsl-inl.md`_
