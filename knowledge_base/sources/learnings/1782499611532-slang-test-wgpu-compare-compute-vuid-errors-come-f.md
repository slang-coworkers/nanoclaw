# slang-test wgpu COMPARE_COMPUTE VUID errors come from Dawn's internal tint, not Slang's SPIR-V emitter

# Vulkan VUID errors during slang-test `wgpu` variants come from Dawn/tint, not Slang

**Context:** slang #11732 (and #11720). Running `slang-test -enable-debug-layers true` on groupshared tests prints `VUID-StandaloneSpirv-None-10684: vkCreateShaderModule(): ... Workgroup storage class has a explicit layout from the ArrayStride decoration` — but the test still reports "100% passed", and the error appears adjacent to the `syn (wgpu)` variant.

**Finding (verified at HEAD 8d5aa670c):** That VUID is NOT from Slang's SPIR-V emitter. The wgpu RHI hands Dawn **WGSL text** (`external/slang-rhi/src/wgpu/wgpu-shader-program.cpp:38`, via Slang's direct emitter `source/slang/slang-emit-wgsl.cpp`) and forces Dawn's **Vulkan** backend on Win/Linux (`external/slang-rhi/src/wgpu/wgpu-utils.cpp:53,55`). Dawn's **internal tint** regenerates SPIR-V from the WGSL, and *that* SPIR-V carries an ArrayStride on the Workgroup array without `WorkgroupMemoryExplicitLayoutKHR` → the newer Vulkan layer rejects it. Slang's own SPIR-V (the `vk` variant) is clean — no ArrayStride on Workgroup arrays (gated to StorageBuffer/PhysicalStorageBuffer at `slang-emit-spirv.cpp:2445-2446`; sized arrays return stride 0 at `getArrayStrideValue` `:2017-2037`).

**Three discriminators that pin it to the wgpu/Dawn path (reusable triage technique):**
1. Compile the shader yourself to `-target spirv-asm` and grep for `ArrayStride` on the `Workgroup` array — if absent, Slang's SPIR-V is clean and the error is downstream.
2. Check the test's synthesized variants: if a file has NO `vk` variant (e.g. only `dx11/llvm/wgpu/dx12`) yet `vkCreateShaderModule` still fires, only the wgpu (Dawn-on-Vulkan) variant can be the source.
3. Producer fingerprint: Slang names array types `%_arr_..._int_N` (signed length constant); tint emits `%_arr_..._uint_N` (unsigned). A `uint` length in the error module means tint produced it. Also: the *same* validator passing the `vk` variant but failing the `wgpu` variant of the same shader is a near-controlled experiment.

**Why the test passes:** VUID is a validation-layer diagnostic (debug-messenger callback) — it does NOT change `vkCreateShaderModule`'s `VK_SUCCESS`, Dawn doesn't abort by default, and the ArrayStride is inert for real Workgroup memory. slang-test's `COMPARE_COMPUTE` grades on output-buffer comparison (stdout), never stderr.

**Takeaway for triage:** Don't reflexively attribute a `vkCreateShaderModule` VUID seen during a wgpu test to Slang's emitter. Verify Slang's `-target spirv-asm` output first; the wgpu execution path round-trips through Dawn/tint and validates *tint's* SPIR-V, not Slang's. A "fix" emitting explicit layout in Slang would be the wrong layer.
