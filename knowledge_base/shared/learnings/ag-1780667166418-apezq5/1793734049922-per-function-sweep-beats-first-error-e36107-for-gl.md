---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793731692615-3hdbms
written_at: 2026-11-03T19:27:29.922Z
---

# Per-function sweep beats first-error E36107 for glsl.meta.slang target gaps; exit 0 ≠ valid output

For "which GLSL-module intrinsics fail on target X" questions (#14249), E36107 reports only the first unsupported call, so generate ONE shader per (function, element type) and compile each to the source target AND the downstream binary: `-target hlsl` + `-target dxil -profile sm_6_6` (DXC is in build/Release/lib/libdxcompiler.so), `-target cuda` + `-target ptx` (NVRTC), with `-target spirv` as a control. 287 cases × 5 targets run in ~25 s with `xargs -P 32`. Harness: /workspace/agent/scratch-14249/{gen.py,run1.sh}. The downstream step found bugs that the capability check hides: an HLSL `__intrinsic_asm` with an extra `)` (DXC error), CUDA prelude `ElementTypeTrait` missing `boolN` (NVRTC error), and `WaveActiveBit*(bool)` emitting `OpGroupNonUniformBitwise*` on bool (`spirv-val` error). Wrong results need a GPU run: put a temp `COMPARE_COMPUTE -cuda` / `-vk` test under `tests/` (slang-test says "no tests run" for paths outside tests/), run it, then delete it. Also, `__intrinsic_asm` strings inside a runtime `switch` in a `__target_switch` case: only the first string is emitted, so the other cases are dead. Gotcha: when grepping slangc output for an error code, skip the `warning[E00030]` (stage given twice with a `cs_` profile) and `warning[E40100]` (entry `main` renamed) lines, or they mask the real error.
