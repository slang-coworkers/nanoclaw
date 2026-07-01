---
title: "Triage discriminator: Slang embedded spirv-tools vs system Vulkan validation layer (version-skew)"
type: learning
topic: slang-compiler
source: learnings/1782267495019-triage-discriminator-slang-embedded-spirv-tools-vs.md
---

# Triage discriminator: Slang embedded spirv-tools vs system Vulkan validation layer (version-skew)

When a Slang issue reports a `spirv-val` VUID rejection that surfaced via `-enable-debug-layers true` (i.e. `vkCreateShaderModule` runtime validation), that uses the **system Vulkan validation layer**, which can be far newer than Slang's **embedded** spirv-tools. At HEAD f1142612a the embedded copy is `external/spirv-tools` **v2026.2 (2026-04-24)**; a maintainer on Vulkan SDK 1.4.328 runs a much newer layer with newly-added VUIDs (e.g. the 10000+ range: VUID-StandaloneSpirv-None-10684, -MemorySemantics-10870).

**Cheap discriminator (no GPU needed):** compile the offending shader with `SLANG_RUN_SPIRV_VALIDATION=1 ./build/Debug/bin/slangc shader.slang -target spirv -o out.spv ...` (or `-target spirv-asm` to inspect). If the **embedded** validator passes (rc=0) but the user's system layer rejects, it's **validator version-skew / an emerging conformance gap**, not a master regression with current tooling — classify and route accordingly (often a maintainer/Khronos call: emit the new decoration vs pin the validator version). If the embedded validator ALSO rejects, it's a genuine current bug. Verified on #11720: a plain `groupshared uint a[6]` reproduces the exact reported `%v = OpVariable %_ptr_Workgroup__arr_uint_int_6 Workgroup` with no ArrayStride, embedded-val rc=0 — VUID-10684 fired only on the maintainer's newer layer.

**Two concrete latent SPIR-V emit gaps found in the same issue, worth knowing:**
1. Non-relaxed atomics can emit memory semantics with **no storage-class bit** (violates VUID-10870). `emitMemorySemanticMask()` at `source/slang/slang-emit-spirv.cpp:4337-4392` leaves `memoryClass=0` when the pointer isn't an `IRPtrTypeBase`, has no address space, or has an address space outside {StorageBuffer, UserPointer, Image, Output, GroupShared}. Handled spaces are correct (tests/spirv/atomic-memory-class.slang → 258/68/260).
2. Workgroup arrays never get `ArrayStride` (`getPointerArrayStrideValue()` returns 0 for Workgroup, slang-emit-spirv.cpp:1998-2000) and Slang declares no `WorkgroupMemoryExplicitLayoutKHR`.

**Bonus — "fails only WITHOUT -use-test-server" almost always = cross-test global-state contamination.** In-process mode reuses ONE global SlangSession (`tools/slang-test/test-context.cpp:120`); the server gives each test a fresh process. Confirm by running the failing test standalone (it passes) — then the leak is in session-scoped state: preprocessor include-once sets (`includedFiles`/`pragmaOnceUniqueIdentities`), the IRModule linking cache, or RHI device caches. (Related: #11215, #10893.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782267495019-triage-discriminator-slang-embedded-spirv-tools-vs.md`_
