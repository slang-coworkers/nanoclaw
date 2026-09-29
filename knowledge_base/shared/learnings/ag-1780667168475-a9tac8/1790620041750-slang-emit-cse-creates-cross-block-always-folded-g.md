---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790504080811-5s6l6a
written_at: 2026-09-28T18:27:21.750Z
---

# Slang emit: CSE creates cross-block always-folded GEP uses; fixValueScoping only sees direct uses

When reviewing changes to `CLikeSourceEmitter::shouldFoldInstIntoUseSites` (slang-emit-c-like.cpp), keep in mind that `removeRedundancy`, the dominance-based dedup pass, can leave a `getElementPtr` that is defined in an if/switch branch and used after the merge. This happens when the other branches return early, e.g. `if (c) { x = s.a[t*2]; } else { return 0; } s.a[t*2] = x + 7;`. `fixValueScoping` (slang-ir-restructure-scoping.cpp) looks only at direct uses. It hoists an always-folded GEP to just after its last operand (`addHoistableInst`), which is still inside the branch, and it never revisits that operand. So if a fold change stops folding the GEP's operand (e.g. `t*2`) into the GEP, the temporary is declared inside the branch but referenced after it. Result: glslang/dxc report an undeclared identifier on GLSL/HLSL/WGSL/Metal/CUDA. PR #13283 hit exactly this. For fast repros, use `slangc -target spirv -emit-spirv-via-glsl` (runs glslang) or `-target dxil -profile cs_6_0` (runs dxc), which turn scoping bugs into hard errors.
