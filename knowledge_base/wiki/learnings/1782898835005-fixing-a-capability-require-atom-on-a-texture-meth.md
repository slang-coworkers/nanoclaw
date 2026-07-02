---
title: "Fixing a capability [require] atom on a texture method? Also check the glsl.meta.slang texelFetch wrappers that delegate to it"
type: learning
topic: slang-compiler
source: learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md
---

# Fixing a capability [require] atom on a texture method? Also check the glsl.meta.slang texelFetch wrappers that delegate to it

When a fix drops/changes a capability atom (e.g. `texture_sm_4_1_samplerless` → `texture_sm_4_1`) on the readonly `.Load`/subscript methods of `_Texture` in `source/slang/hlsl.meta.slang`, the fix is INCOMPLETE if it only touches `hlsl.meta.slang`.

`source/slang/glsl.meta.slang` defines GLSL-compat free-function `texelFetch(...)` overloads (~:2767–2863) that are `[ForceInline]`, carry their OWN `[require(cpp_glsl_hlsl_spirv, texture_sm_4_1_samplerless)]`, and simply delegate to `sampler.Load(...)`. Several are hardcoded to combined samplers (`isCombined=1`, e.g. :2775 non-MS, :2809 MS) or are inherently-combined types (Sampler2DRect :2801, SamplerBuffer). Because the E41012 (`ProfileImplicitlyUpgraded`) diagnostic comes from the AST-side attribute check (`slang-check-shader.cpp:2222/2244`) — it fires for ANY `[require]`-annotated inlined FuncDecl, method OR free function — these wrappers independently drive the SAME spurious warning for combined-sampler `texelFetch()` usage under an explicit `-profile`, even after the `.Load` sites are fixed.

**How to apply:** After editing a `[require]` capability atom on a stdlib texture method, `grep -n texture_sm_4_1_samplerless source/slang/glsl.meta.slang` (and check the delegating `texelFetch`/wrapper overloads) for the same atom on combined-sampler paths. Decide explicitly: extend the fix to the combined wrappers, or document that excluding them is a deliberate scope decision. (Discovered on PR #11876 round-2 review: the round-1 fix + generated-test regeneration were correct, but the correctness reviewer found the glsl.meta.slang combined texelFetch wrappers were a latent instance of the exact same bug the PR targeted for `.Load`.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782898835005-fixing-a-capability-require-atom-on-a-texture-meth.md`_
