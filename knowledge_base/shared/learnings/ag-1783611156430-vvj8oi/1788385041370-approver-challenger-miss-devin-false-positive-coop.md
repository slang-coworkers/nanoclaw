---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788374058966-5e1dnn
written_at: 2026-09-02T21:37:21.370Z
---

# [approver/challenger-miss] Devin false-positive: coopmat2 tensor-addressing does NOT need a separate VK device extension

**Repo/PR:** shader-slang/slang-rhi#851 @ 339f23472d2b (Vulkan coopmat2 subfeatures). Devin (head-current, exit 0) reported ONE 🔴: "Tensor-addressing shaders miss required extension" at the `appendCooperativeMatrix2Subfeatures` tensor-addressing branch (which pushes `Capability::spvCooperativeMatrixTensorAddressingNV` + `Capability::spvTensorAddressingNV`).

**Assessment: LIKELY FALSE POSITIVE.** Refuted from authoritative source (per the standing rule "verify coopmat capabilities from source, never DeepWiki/LLM"):
- **Vulkan headers** (slang/external/vulkan/include/vulkan/vulkan_core.h): the ONLY NV cooperative-matrix DEVICE extensions are `VK_NV_cooperative_matrix` and `VK_NV_cooperative_matrix2`. There is **no** `VK_NV_tensor_addressing` device extension — every "tensor" VK extension in the header is ARM data-graph (`*_ARM`), unrelated to NV cooperative matrix.
- **Slang capdef** (source/slang/slang-capabilities.capdef): `spvTensorAddressingNV : SPV_NV_tensor_addressing`; `spvCooperativeMatrixTensorAddressingNV : SPV_NV_cooperative_matrix2`; and `SPV_NV_cooperative_matrix2 : SPV_NV_tensor_addressing + SPV_KHR_cooperative_matrix`. These are **SPIR-V** extensions, not Vulkan device extensions.
- **Slang emit** (source/slang/slang-emit-spirv.cpp:2693, 2709): Slang emits `OpExtension "SPV_NV_tensor_addressing"` into the shader module. A SPIR-V module extension is enabled at the Vulkan level by whatever device extension provides it — and since no standalone NV tensor VK extension exists, `VK_NV_cooperative_matrix2` provides it. The PR enables `VK_NV_cooperative_matrix2` (with its VK_KHR_cooperative_matrix dependency), which is sufficient.

**Transferable lesson.** When a reviewer (esp. Devin) flags "capability X exposed but its extension is missing," distinguish **SPIR-V extensions** (`SPV_*`, declared in the shader via `OpExtension`, emitted by slang-emit-spirv.cpp) from **Vulkan device extensions** (`VK_*`, enabled at `vkCreateDevice`). A distinct `spv*` capability atom does NOT imply a distinct `VK_*` device extension — several SPIR-V extensions are provided by one umbrella VK extension (here VK_NV_cooperative_matrix2 provides both SPV_NV_cooperative_matrix2 and SPV_NV_tensor_addressing). Grep the vendored `vulkan_core.h` for a matching `VK_*_EXTENSION_NAME`; if none exists, the SPIR-V ext is provided by the umbrella VK extension and no extra enable is needed.

**Decision note.** Still recorded ABSTAIN_POLICY/CHALLENGER_CONCERN (not approve): policy forbids rounding a fallback-tier 🔴 up to approval, and I inferred the spirvextension→VK mapping from header absence-of-alternative rather than reading vk.xml directly. The merged-vs-abstain human-outcome join will calibrate whether this was over-conservative (watch for this PR merging unchanged → confirms false positive).
