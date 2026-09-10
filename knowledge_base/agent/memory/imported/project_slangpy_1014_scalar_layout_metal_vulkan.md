---
name: project-slangpy-1014-scalar-layout-metal-vulkan
description: "slangpy#1014 Metal/Vulkan ScalarDataLayout stride discrepancy — CLOSED/fixed by slang#11578, shipped slangpy v0.43.0"
metadata: 
  node_type: memory
  type: project
  originSessionId: c08abcdf-91bb-4cf7-a3bf-9d353f56a46e
---

**slangpy#1014** — "Execution discrepancy between Vulkan and Metal backends." `RWStructuredBuffer<Tup, ScalarDataLayout>` (`Tup = { int2 _0; float4 _1; }`) produced black regions on Metal but not Vulkan: original Metal ignored `ScalarDataLayout` → stride 32 vs host `struct_size=24` → OOB corruption for elements ≥49152.

**TERMINAL — closed 2026-07-22 by jhelferty-nv** (assignee, human MEMBER): "fixed as of v0.43.0, confirmed locally in v0.43.1." No bot mention; self-close with fix confirmation. Not a re-open trigger.

**Fix attribution:** shader-slang/slang#11578 "Implement scalar layout for Metal device buffers" (merged 2026-06-13, first ships slang v2026.11). Metal now honors scalar layout via `MetalBufferElementTypeLoweringPolicy` → lowers vectors to MSL packed types (`packed_float4`), reflection updated to match → stride 24, matches Vulkan. slangpy v0.43.0 bumped Slang to v2026.11+ → closes it.

**Two deprioritized slang-side follow-ups (NO slang tracking issue filed):**
1. **Warning diagnostic** — jhelferty explicitly requested twice (warn when requested element stride not honored by target). Motivation weakened once #11578 landed: Metal+HLSL now honor it; genuinely-unhonored cases reduce to CUDA (clean self-consistent drop) + future targets. Maintainer closed parent without green-lighting the draft PR from coworker's checklist → treat as superseded/deprioritized, NOT actively owed. Design Q if ever revived: which stride is authoritative for compare — reflection vs emitted shader-data (they disagreed on SPIR-V).
2. **SPIR-V reflection-vs-emitted inconsistency** — latent ABI gap: emitted binary honors marker (`ArrayStride 24`, `_1` Offset 8) but reflection API reports 32 (`_1` Offset 16). Harmless in this repro (host over-allocates from reflection → no OOB). Coworker offered to file own issue; jhelferty never answered → NOT filed. Related theme: [[project_12092_reflection_anyvaluesize_stride_mismatch]].

Do not re-open or dispatch unless a maintainer explicitly revives the warning or asks to file the SPIR-V item.
