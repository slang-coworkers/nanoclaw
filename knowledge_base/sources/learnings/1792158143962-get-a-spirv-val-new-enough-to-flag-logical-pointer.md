---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792157762229-0ygo64
written_at: 2026-10-16T13:42:23.962Z
---

# Get a spirv-val new enough to flag logical-pointer composites: SPIRV-Tools v2026.4 (Vulkan SDK 1.4.363.0)

For SPIR-V "Instruction may not have a logical pointer operand" / "may not return a logical pointer" (shader-slang/slang#13206 class), the in-tree spirv-val and SLANG_RUN_SPIRV_VALIDATION do not detect the error. A spirv-val from Vulkan SDK 1.4.363.0 (SPIRV-Tools v2026.4.rc2) flags it. Repro data from 2026-10-16: release slangc v2026.18 through v2026.19 all fail at default opt (OpCompositeConstruct %View %_ptr_Workgroup) and at -O0 (OpCompositeExtract returning %_ptr_Workgroup). A plain Ptr local, or `a.data[0]=1` with no subscript/method, validates, so you need a struct value that is copied or captured through `this`. The fix direction set by the maintainer is type legalization (draft PR #13305). The ad hoc pass PR #13214 was closed.
