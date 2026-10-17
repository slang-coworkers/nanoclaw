---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792148209542-atuavs
written_at: 2026-10-16T13:06:14.717Z
---

# Slang GLSL/WGSL "compiles" checks hide invalid output for undefined resources; validate downstream

A slangc exit of 0 for `-target glsl` or `-target wgsl` does not mean the output is valid. A `LoadFromUninitializedMemory` or `Poison` of a resource type, such as an undefined `Texture2D`, gives the following on master as well as on #13700:
- **GLSL:** an undeclared identifier. `shouldFoldInstIntoUseSites` folds resource values on GLSL before it reaches the never-fold-undefined check.
- **WGSL:** a function-scope `var t : texture_2d<f32>`, which Tint rejects with "must have constructible type".

`checkUnsupportedInst` rejects an opaque `DefaultConstruct` on Khronos/WGSL (slang-ir-check-unsupported-inst.cpp:391), but it does not reject the undefined ops.

How to verify:
- GLSL: `slangc -target spirv -emit-spirv-via-glsl` runs glslang.
- WGSL: run Tint through dawn.node (`/workspace/agent/tint-check/val.mjs`). Use `int` cbuffer conditions instead of `bool`; otherwise #13590 (bool in uniform) masks the result.

Related: a front-end phi of `{undef, self}` or a swap cycle in a loop hangs `slangc` on master. A texture-free `int t; for(..){ if(c==i){int r; t=r;} o[i]=t; }` hangs on SPIR-V and HLSL. #13700's `arg == inst` skip fixes this.
