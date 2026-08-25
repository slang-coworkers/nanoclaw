---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787600718585-1053r5
written_at: 2026-08-24T19:55:23.178Z
---

# Slang default Vulkan/SPIR-V buffer layout is std430/std140, not natural/scalar; scalar≠C

Resolved from source while triaging #12714 (the recurring "does Slang default to C/scalar layout on Vulkan?" question — answer is NO).

**Default layout, no option given, Vulkan/SPIR-V:** StructuredBuffer/RWStructuredBuffer element = **std430**; ConstantBuffer = **std140**; push constants = std430. There is **no code path that auto-enables scalar layout at Vulkan 1.4** (grep for 1.4/scalar_block_layout/VulkanVersion in the layout selectors = zero hits; the 1.4 code in slang-ir-spirv-legalize.cpp is SPIRVBlockDecoration/storage-class, unrelated to element layout). Scalar/C/DX are reached ONLY via explicit `-fvk-use-scalar-layout`/`-fvk-use-c-layout`/`-fvk-use-dx-layout` (plain boolean reads, `slang-compiler-options.h:348-355`) or per-buffer generic `StructuredBuffer<T, ScalarDataLayout|CDataLayout|Std430DataLayout>` (overrides the global option).

**Tightness ordering (important, non-obvious):** scalar/natural (no tail pad) ⊂ C (tail-padded) ⊂ std430 (vec3→16 align) ⊂ std140. So Slang's "natural"/scalar layout is *tighter than C* — it packs a trailing field into a prior struct field's tail padding (`struct U { S z; float w; }` = 16 in Slang vs 24 in C). This is `DefaultLayoutRulesImpl::EndStructLayout` deliberately skipping the size round-up (`slang-type-layout.cpp:359`, comment 363-390). Only explicit **C layout** (`CPULayoutRulesImpl::EndStructLayout:653`) rounds up to match C `sizeof`; even C still diverges from Slang on zero-size-type stride (Slang=0, C=alignment). ⇒ **scalar ≠ C** for nested structs — don't assume `-fvk-use-scalar-layout` gives you C-compatible layout.

Selection code: `getTypeLayoutRuleNameForBuffer` (slang-ir-lower-buffer-element-type.cpp:2470-2483) and `GLSLLayoutRulesFamilyImpl::getStructuredBufferRules` (slang-type-layout.cpp:2145 → std430 base at :1910).

Consequence: the Vulkan tutorial's "Slang automatic packing" claims (auto-scalar at 1.4, default==natural/C++-like, RWStructuredBuffer==layout(scalar)) are all inaccurate. DXC's PR microsoft/DirectXShaderCompiler#7996 separately made `-fvk-use-scalar-layout` == C layout (breaking) — whether Slang follows is an open maintainer decision, not settled.
