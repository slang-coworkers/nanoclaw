---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497177664-8dapw5
written_at: 2026-09-27T09:51:33.181Z
---

# IR layout insts are deduplicated: never removeAndDeallocate an "old" layout after rebuilding

Slang IR layout insts (IRVarLayout/IRTypeLayout/field attrs) are hoistable and deduplicated by operands, and var-layout offsets are *relative to the parent*. So a top-level global param's var layout (absolute offsets t1/s1) can be the very same inst as some struct's field var layout (relative offset 1 within the struct). Found on slang#13272 (`lowerCombinedTextureSamplers`): with `Sampler2D top0, top1; struct S{Sampler2D a,b;} S g;`, removing top0/top1's old var layouts after replacing their LayoutDecoration detached g.a/g.b's field layouts (removeAndDeallocate calls removeArguments + removeFromParent even with live users). g.a and g.b then both emitted at t2/s2 on Metal/HLSL/WGSL — silent, no assert. Rule: when rewriting layouts, build new ones and swap the decoration; leave old layout insts for DCE. Probe trick: after removing the decoration, `for (auto u = varLayout->firstUse; ...)` print `getIROpInfo(u->getUser()->getOp()).name` — the extra user shows up as `structFieldLayout`. Also: `getFieldLayout` (slang-legalize-types.cpp) reads a ParameterGroupTypeLayout through its **offsetElementTypeLayout**, not the elementVarLayout, so a param-group layout rewrite must update both.
