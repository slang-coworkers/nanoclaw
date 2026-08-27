---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787174918286-92mz3i
written_at: 2026-08-27T01:00:39.688Z
---

# OptiX ReportHit write path: no attribute setter, non-bit-preserving CUDA BitCast, pass ordering

Fixing slang#12637 (portable HLSL `ReportHit(tHit,hitKind,A attributes)` → CUDA/OptiX, draft PR #12783). Reusable findings:

1. **OptiX has no per-attribute-register setter.** Hit attributes are written ONLY via the single `optixReportIntersection(hitT, hitKind, a0..a7)` call (0–8 `unsigned int` overloads in `external/optix-dev/include/optix_device.h`). Contrast ray *payloads*, which DO have `optixSetPayload_N` (IR op `kIROp_SetOptiXPayloadRegister`). DeepWiki conflates the two — trust the header. So a write path that mirrors the field-wise reader (`emitOptiXAttributeFetch`, one register per scalar leaf) must gather all leaves into ONE call, not emit per-register stores.

2. **CUDA lowers `kIROp_BitCast` as a plain numeric C cast, NOT bit-preserving** (`slang-emit-c-like.cpp` `case kIROp_BitCast`, no CUDA override). To move a float into a 32-bit attribute/payload register bit-for-bit you must emit `__float_as_uint(x)` explicitly (inverse of the reader's `__int_as_float`). An IR BitCast would emit `(unsigned int)(0.5f)` → 0. Verify via PTX: `0.5f` → register constant `1056964608` = `0x3F000000`.

3. **New target-specific IR marker op that carries an aggregate operand must be flattened BEFORE generic legalization.** If the flatten pass runs after `legalizeEmptyTypes` (slang-emit.cpp), an empty-struct operand aborts with E99997 "non-simple operand(s)!" (slang-ir-legalize-types.cpp). And it must run AFTER post-inline DCE, else the dead specialized core-module `[ForceInline]` body is processed too → duplicate diagnostics attributed to the .meta.slang file. Correct slot: right after `performForceInlining` + the post-inline DCE/simplify, before empty-type/resource legalization.

4. **Diagnostic IDs (slang-diagnostics.lua) collide across rebases.** Master advanced 19 commits mid-review and claimed the ID I'd chosen. Before assigning, `git show origin/master:source/slang/slang-diagnostics.lua | grep -oE '552[0-9][0-9]' | sort -u` to find a free ID; re-check after every rebase and update the test CHECK lines.

5. **FileCheck-based slang-tests are silently IGNORED when slang-llvm is absent** (the fixer container lacks it): `0% of tests passed (0/0), N tests ignored` + rc=0 is a VACUOUS pass, not a real one. Even the committed baseline tests get ignored. Verify CUDA/OptiX emit by direct `slangc -target cuda` + per-leaf grep, and compile-check with `-target ptx -Xnvrtc -I"./external/optix-dev/include/"` (the L40S + CUDA 12.6 is present). The FileCheck harness runs in CI.
