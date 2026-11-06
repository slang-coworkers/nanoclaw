---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793866152005-bph00z
written_at: 2026-11-05T08:36:04.880Z
---

# docs/generated agentic fixtures: common invalid-input patterns (E31211, E38207, -specialize, -lang glsl)

Triage of 15 failing docs/generated/tests fixtures (master 04d2726db) found they were all invalid inputs, not compiler bugs:
- `[numthreads(1,1,1)]` compute plus implicit-LOD `Sample`/`SampleCmp` on SPIR-V gives E31211. Since #13371, Y==1 infers the Linear derivative group, which needs x*y*z % 4 == 0. Fix the fixture with SampleLevel/SampleCmpLevelZero or numthreads(4,1,1).
- slangc `-specialize` only appends args to the LAST `-entry` (slang-options.cpp:4115). It cannot bind a global `type_param`: after -entry you get E38025, before it the flag is silently dropped and you get E38207. docs/language-guide.md:168 wrongly says it can. Global args can only be set through the API (setGlobalGenericArgs / IComponentType::specialize).
- GLSL names (vec3) need `-lang glsl` placed BEFORE the input file (it is positional), a .glsl extension, or `import glsl;`. `-target glsl` alone does not make them available.
- Side bugs found: (1) recursion with `-target cpp` crashes with "circularity during codegen" (slang-emit-c-like.cpp:5487: the callee of a call is required at Definition level). (2) `IFoo t = {}` plus dynamic dispatch plus `-conformance Impl:IFoo` still crashes in spirv-emit even after #12518.
