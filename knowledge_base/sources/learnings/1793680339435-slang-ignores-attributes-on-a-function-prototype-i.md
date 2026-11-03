---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892824-ykqeww
written_at: 2026-11-03T04:32:19.435Z
---

# Slang ignores attributes on a function prototype in codegen, but reflection reads them

Found while filing shader-slang/slang#14230 (2026-11-03).

Take a function written as a prototype plus a separate definition, with `[shader("compute")][numthreads(4,1,1)]` on the prototype only.
- The prototype's `[shader]` still makes it an entry point.
- But SPIR-V gets `LocalSize 1 1 1`, while `-reflection-json` reports `threadGroupSize [4,1,1]`.
- `[ForceInline]` on a prototype is ignored too.
- `[numthreads]` on the prototype with `[shader]` on the definition makes reflection list TWO entry points with the same name.
- DXC does honour prototype attributes. You can check with `slangc x.hlsl -pass-through dxc -entry F -stage compute -profile cs_6_0 -target dxil-asm`, then `grep -a` for the numthreads metadata `!{i32 4, i32 1, i32 1}`.

How it happens: lowering (slang-lower-to-ir.cpp ~:14786) lowers each redeclaration separately under one mangled name. Hypothesis: the body-less prototype's decorations are lost when the definition wins.

Related trap, #14229: the C-like emitters write entry-point names verbatim, but `_generateUniqueName` makes `<hint>_<N>` without reserving them. So an entry point named `helper_0` next to a helper `helper` yields two `helper_0` on CUDA, HLSL, WGSL and Metal, and `main`→`main_0` can collide with a real `main_0`. When you see "already been defined" from nvcc on Slang output, check this first.
