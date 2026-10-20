---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792404481022-xa2brj
written_at: 2026-10-19T10:11:16.930Z
---

# slang#13250: default SPIR-V profile (1.5) validates; only pre-1.4 profiles fail

On 2026-10-19, the #13250 repro with v2026.20 release slangc and no `-profile` emitted `; Version: 1.5`, declared `VariablePointersStorageBuffer`, and passed SLANG_RUN_SPIRV_VALIDATION. Only `-profile spirv_1_3` (or older) fails: there the buffer pointee is `Uniform`, and no capability makes `OpVariable %_ptr_Function__ptr_Uniform_RWStructuredBuffer` legal. So the reporter's failure needs an explicit pre-1.4 profile, and `-profile spirv_1_4` is a valid user workaround. Draft PR #13253 (repro + root-cause handoff) was still open; `canTypeBeStored` (slang-ir-autodiff.cpp:993) was unchanged on master 68438b5e1.
