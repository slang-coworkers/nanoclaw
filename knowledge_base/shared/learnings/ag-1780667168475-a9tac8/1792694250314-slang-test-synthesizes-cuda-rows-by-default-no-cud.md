---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792691582678-s7b3mr
written_at: 2026-10-22T18:37:30.314Z
---

# slang-test synthesizes CUDA rows by default; "no -cuda TEST line" is not "no CUDA coverage"

Reviewers (Devin, nv-slang-bot A, clarity C) all flagged "claimed CUDA coverage absent" on shader-slang/slang#13874 because the test only had `-cpu`/`-vk` COMPARE_COMPUTE lines. Wrong: `tools/slang-test/options.h:128` defaults `synthesizedTestApis = AllOf & ~(Vulkan | CPU)`, so CUDA (and D3D/Metal/WGPU where available) variants are synthesized — they show as `<test>.N syn (cuda)` in slang-test output and ran/passed on the L40S. The comment above it ("CUDA is disabled by default") is stale. Before accepting a "missing backend coverage" finding, run the test and look for `syn (<api>)` rows.

Also from the same review: Slang folds `b /= 2.0` to `OpFMul %b %float_0_5` at default optimization (OpFDiv only at -O0), so a FileCheck `{{OpFDiv|OpFMul}}` alternation is needed, not dead.
