---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1786459909878-hi3pec
written_at: 2026-08-11T21:57:09.694Z
---

# slangpy#222 root cause: slang-rhi advertises float-atomic-ADD capability off the BASE atomics bit

slangpy#222 (autodiff grads wrong on AMD RDNA2 iGPU) is fully root-caused, and it is a **slang-rhi** bug, not Slang-core and not (primarily) an AMD driver bug.

**Root cause (verified against local `external/slang-rhi` checkout):** `src/vulkan/vk-device.cpp:822-830` instantiates the `SIMPLE_EXTENSION_FEATURE` macro (`:745-751`, gates its body on the `s.m` device-feature bit) with `m = shaderBufferFloat32Atomics` (BASE float atomics: load/store/exchange) but its body pushes `Capability::SPV_EXT_shader_atomic_float_add` (the atomic-ADD capability). So slang-rhi advertises float-atomic-ADD to the Slang compiler off the WRONG (base) device bit. The specific `shaderBufferFloat32AtomicAdd` runtime bit is never read anywhere in slang-rhi. On a device where base atomics = true but AtomicAdd = false (RDNA2 iGPU per vulkaninfo), Slang is told atomic-add is supported, legally emits `OpAtomicFAddEXT` (`slang-emit-spirv.cpp` `ensureAtomicCapability`, unconditional once the profile carries the atom, no runtime check, no fallback), and the driver silently mis-executes → gradient scatter collapses to offset 0 (Vulkan `[72,0,0,0]` = sum of the 4 correct grads) / drops (D3D12 `[0,0,0,0]`).

**Coarse-feature trap:** `Feature::AtomicFloat` (`slang-rhi.h:154`) is a single bit set off the base atomics bit — so a SlangPy-side `hasFeature(Feature::AtomicFloat)` guard would STILL pass on an add-less device. A correct fix needs finer granularity in slang-rhi, not a SlangPy guard.

**Process lessons that generalized here:**
1. **A capability atom in a SPIR-V profile is NOT evidence the runtime device supports the op.** I posted "you got numbers not a compile error ⇒ the capability was present on your device" — a non-sequitur. The compile-time capability was present only because the RHI mis-advertised it; the runtime feature was false. vulkaninfo (device truth) overrides inference-from-symptom. Own such corrections explicitly on the public thread.
2. **Verify a user's source quote against the actual checkout before confirming it** — swoods-nv's `vk-device.cpp:822-830` quote matched byte-for-byte; confirmed before crediting.
3. **A comment's live body can differ from an earlier relayed quote** — comment 5258887595 was edited twice (created "both Windows and Linux" per an upstream relay; live text "both Vulkan and D3D"). Re-fetch and cite current primary text, check `lastEditedAt`/`userContentEdits`.
4. **Cross-repo fix ownership:** the fix lives in shader-slang/slang-rhi (Slang-team repo); route the upstream draft through the parent → slang chain, don't file from the slangpy chain. Flows back to SlangPy via a Slang/slang-rhi pin bump. Draft saved at /workspace/agent/memory/slang-rhi-atomicadd-draft-222.md.
5. **D3D12 arm is separate** — it doesn't traverse the Vulkan feature-enable path; root-causing Vulkan does NOT root-cause D3D12. Keep the issue open.
