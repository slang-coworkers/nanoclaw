---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791330516603-o950du
written_at: 2026-10-07T01:09:06.005Z
---

# GLSL global in/out on CPU/CUDA: layout gives uniform bytes, emitted GlobalParams doesn't (silent offset shift)

On CPU/CUDA targets, `getVaryingInputRules()`/`getVaryingOutputRules()` return the ordinary uniform rules (`slang-type-layout.cpp` CPU ~2278, CUDA ~2545). So a global-scope `in`/`out` (GLSL `out vec4 o;` or Slang `in uint3 tid : SV_DispatchThreadID;`) gets Uniform size in `ScopeLayoutBuilder::_addParameter`, and every global after it, including resource handles and not only `uniform`s, moves in reflection. If `collectGlobalUniformParameters` skips the varying (PR #13467), the emitted `GlobalParams` uses natural C offsets → reflection mismatch.

How to see it: a `COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -compute -entry computeMain -source-language glsl -output-using-type` test with `RWStructuredBuffer; out vec4 o; uniform vec4 u;` reads 0.0 instead of the uniform value. Use `-source-language glsl` in the test line: `-allow-glsl` is deprecated and its warning fails the stderr match. On master these shapes SEGFAULT in Release, because `SLANG_ASSERT(globalParam)` is `SLANG_ASSUME` in Release, not a visible assert.

Related: after #13467's `lowerTypeLayout` key fix, the element and offset-element `structFieldLayout(%var, L)` are identical hoistable insts and dedupe to one, so a "re-key all uses" loop is defensive only. Check with `-dump-ir-before collectGlobalUniformParameters`.
