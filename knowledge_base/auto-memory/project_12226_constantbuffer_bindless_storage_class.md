---
name: project_12226_constantbuffer_bindless_storage_class
description: "#12226 ConstantBuffer<T> bindless fetched as StorageBuffer not Uniform SPIR-V — P1 regr #11647, design-gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: 45648c88-d49d-44c6-9068-0765f0598dd7
---

#12226 — `ConstantBuffer<T>` fetched bindlessly (`ResourceDescriptorHeap[]` / `DescriptorHandle`, `spvDescriptorHeapEXT`) emits `OpTypeBufferEXT StorageBuffer` + StorageBuffer buffer-pointer instead of Uniform. Driver reads a 16B storage-buffer descriptor from a heap slot the app filled with an 8B uniform-buffer descriptor → garbage read (real ABI break). Reporter aechelon-joshuamaros (external), Slang 2026.14, Vulkan/SPIR-V.

**Triaged 07-25 (top-of-tree 5281ccc66):** confirmed bug, **high/P1, SPIR-V target-emit**, REPRODUCED. **Element-shape-dependent** — scalar `ConstantBuffer<float>` correctly stays Uniform; only struct/array forms wrong.

**Regression from PR #11647.** The StorageBuffer flip is *deliberate*: `processConstantBufferDescriptorHeapLoad` (slang-ir-spirv-legalize.cpp:1300) was added by #11647 to fix #11483's nested-array-addressing garbage (a Uniform buffer pointer carries no pointer-type `ArrayStride`). **Naive revert regresses #11483.** Real defect = conflation of *descriptor kind* (ABI) with *pointer addressing class*.

**DESIGN-GATED — maintainer call (cc szihs / jkwak-work).** Triage memo `/workspace/agent/memory/triage-12226.md` (triager's fs) has 2 approaches (A vs B) on the device-ABI axis.

**Spec gate RESOLVED 07-25 (triager re-verified against published SPV_EXT_descriptor_heap rev1 asciidoc, §3.56.6/§3.56.8):** `OpTypeBufferEXT` storage class and `OpBufferPointerEXT` result class are **independent operands, no matching VUID** → DeepWiki's "must match" REFUTED; earlier "Approach B likely infeasible" was WRONG. Uniform descriptor kind is **ABI-forced**. Verdict comment 5075822113 **PATCHed in place** to correct this and reframe the maintainer question as A-vs-B on device-ABI. Open hypothesis (NOT fact): Uniform-descriptor slot → StorageBuffer data pointer legal on real drivers + bundled spirv-val?

**State:** GitHub verdict PATCHed (comment 5075822113, `reproduced`+`regression`+Type=Bug). **Fixer HOLDING — NO code** (design gate reopens the deliberate #11647/#11483 fix). **RESUME** = maintainer picks A or B on GitHub → triager forwards on canonical thread → re-dispatch `/slang-fix-issue`. No reopen otherwise except fresh substantive human comment.

Related bindless SPIR-V codegen area: [[project_12185_bindless_texture_nv_desc_handle_nonimage]], [[project_12161_nonuniform_descriptorhandle_nonspirv_verify]] — distinct symptom, not a dup.
