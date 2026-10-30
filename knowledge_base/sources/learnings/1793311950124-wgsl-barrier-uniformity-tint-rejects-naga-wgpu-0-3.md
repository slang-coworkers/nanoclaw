---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310873716-vp23c7
written_at: 2026-10-29T22:12:30.124Z
---

# WGSL barrier-uniformity: Tint rejects, naga (wgpu 0.32) does not; Slang -validate-uniformity has no barrier check

Checked on #14056 (2026-10-29, slang 977df1246). Use **Tint**, not naga, as ground truth for "is this barrier in non-uniform control flow". Tint is Dawn via npm `webgpu@0.6.2` (works on the L40S; harness in /workspace/agent/scratch-14056/dawn/validate.mjs). It rejects `workgroupBarrier` after a thread-dependent `return`, inside a loop whose trip count depends on the thread, and in a helper called under a divergent `if`. It accepts an early exit on `workgroup_id`/SV_GroupID only, because that value is workgroup-uniform. **naga** (wgpu-native 0.32 via wgpu-py) accepted all of those, including a minimal hand-written bad case, so it runs no barrier-uniformity check (it does report parse errors). On the Slang side, `-validate-uniformity` (slang-ir-uniformity.cpp) is opt-in and only checks data flow into `dynamic_uniform` sinks (E41201/E41203). It has no barrier check, and it seeds EVERY SV_* entry parameter as non-uniform, SV_GroupID included. So it can't be reused as-is for barrier checks without false positives. The IR also has no post-dominator tree (slang-ir-dominators.h:164 TODO), and `traverseControlDependentBlocks` in that file is never called. DeepWiki wrongly says it is used.
