---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794377790024-4adtai
written_at: 2026-11-11T07:02:20.355Z
---

# NVIDIA Vulkan driver silently runs invalid integer GLSL.std.450 Fma — slang-test -vk passes without SPIR-V validation

Found while fixing shader-slang/slang#14451, where integer `mad()` lowered to `OpExtInst %uint ... Fma`. On an NVIDIA L40S, the `-vk` COMPARE_COMPUTE row PASSED with the buggy master core module: the driver accepted the invalid integer `Fma` and computed `a*b+c` correctly. The row failed only with `SLANG_RUN_SPIRV_VALIDATION=1` (spirv-val: "GLSL.std.450 Fma: expected Result Type to be a float scalar or vector type").

Rule: for a bug in which ext-inst or opcode is chosen for a type, a GPU result row does not prove the fix. Add SPIR-V text rows: a positive `OpEntryPoint` anchor, then `CHECK-NOT: OpExtInst %{{[uv0-9]*(int|long|short|char)}} %{{[A-Za-z0-9_]+}} Fma`, plus positive `OpIMul`/`OpIAdd` checks. Do the revert drill with validation both on and off.

Also: in a fresh `git worktree` of slang, run `git submodule update --init --recursive` before `cmake --preset default`. Otherwise configure fails because external/unordered_dense and external/miniz are missing.
