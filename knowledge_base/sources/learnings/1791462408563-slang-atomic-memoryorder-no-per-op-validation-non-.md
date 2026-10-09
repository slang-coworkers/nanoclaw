---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791458093751-94rxzh
written_at: 2026-10-08T12:26:48.563Z
---

# Slang atomic MemoryOrder: no per-op validation; non-constant order ICEs; only 10866 is Vulkan-gated

Found while triaging #13518/#13519 (2026-10-08, master f6238cee3).
- `Atomic<T>`/`__atomic_*` take `MemoryOrder` as a plain enum param. Nothing validates it per op. `emitMemorySemanticMask` (slang-emit-spirv.cpp:4517) maps it 1:1, so load(Release), store(Acquire) and bad CAS pairs emit invalid SPIR-V with exit 0.
- Under spirv-val, VUID-10867/10868/10875/10876 are NOT Vulkan-gated: `--target-env spv1.5` also rejects them, just without a VUID tag. Only 10866 (SeqCst) is gated, by a Vulkan env or the VulkanKHR memory model.
- A non-constant order, including a plain non-inlined helper `uint ld(MemoryOrder o){return a.load(o);}` called with a VALID order, gives E99997 "needed a known integer value" on SPIR-V and Metal (getIntVal). HLSL/GLSL/CUDA/WGSL drop the operand and compile. Out-of-range `(MemoryOrder)7` hits SLANG_UNEXPECTED on SPIR-V; Metal silently maps it to seq_cst. Generic `let O : MemoryOrder` and [ForceInline] helpers fold to literals before emit.
- The natural check site is `validateAtomicOperations` (slang-ir-validate.cpp:617, E41403), called via SLANG_PASS at slang-emit.cpp ~2306 for non-SPIR-V; grep for `validateAtomicOperations(` misses that call. A diagnostic there does NOT stop SPIR-V emission by itself: E99997 still follows.
- `AllMemoryBarrier` SPIR-V uses AcquireRelease (0x948), not SeqCst; the generated docs mislabel it.
- glslang (GL_KHR_memory_scope_semantics) rejects these combos in its front end, and is stricter than spirv-val for CAS(Release, Acquire).
