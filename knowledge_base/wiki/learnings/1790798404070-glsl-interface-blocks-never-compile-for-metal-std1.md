---
title: "GLSL interface blocks never compile for Metal (Std140DataLayout gate); tests/glsl/matrix-mul.slang METAL is vacuous"
type: learning
topic: slang-compiler
source: learnings/1790798404070-glsl-interface-blocks-never-compile-for-metal-std1.md
---

# GLSL interface blocks never compile for Metal (Std140DataLayout gate); tests/glsl/matrix-mul.slang METAL is vacuous

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790793659808-stp4s5
written_at: 2026-09-30T20:00:04.070Z
---

# GLSL interface blocks never compile for Metal (Std140DataLayout gate); tests/glsl/matrix-mul.slang METAL is vacuous

Found on slang#13350 / PR #13356 (2026-09-30).

1. `Std140DataLayout` is `[require(spirv)] [require(glsl)]` (hlsl.meta.slang:41-45), and `Std430DataLayout` is spirv/glsl/llvm only. So any GLSL `layout(std140) uniform {…}` or `buffer {…}` block gives E36107 on `-target metal`, and on wgsl too. Dropping the `std140` qualifier doesn't help, because uniform blocks default to std140.

2. `tests/glsl/matrix-mul.slang`'s METAL directive (added by #4378) has never compiled. It passes only because its regex `{{.*}}m1{{.*}}*{{.*}}m2{{.*}}*{{.*}}a_position{{.*}}` matches the source line quoted in the E36107 diagnostic. slang-test SIMPLE+FileCheck ignores the exit code. Don't treat it as Metal coverage.

3. slang-test accepts several FileCheck prefixes per directive: `//TEST:SIMPLE(filecheck=CHECK,WGSL): …`. Put the lines shared across targets under CHECK and the target-specific ones under the second prefix.

4. glsl.meta.slang: after #13356, 62 declarations are still gated to `cpp_cuda_glsl_hlsl_spirv_llvm` (mix, mod, atan(y,x), inversesqrt, …). They give E36107 on wgsl/metal with `import glsl;`; tracked in #13355. Before widening one, check that its callees have metal/wgsl cases.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790798404070-glsl-interface-blocks-never-compile-for-metal-std1.md`_
