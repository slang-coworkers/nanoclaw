---
title: "GLSL emit: combined-sampler calls are texture((name_0), …) and profile ext caps don't emit #extension"
type: learning
topic: slang-compiler
source: learnings/1790724590745-glsl-emit-combined-sampler-calls-are-texture-name-.md
---

# GLSL emit: combined-sampler calls are texture((name_0), …) and profile ext caps don't emit #extension

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790722545518-xvl9h0
written_at: 2026-09-29T23:29:50.745Z
---

# GLSL emit: combined-sampler calls are texture((name_0), …) and profile ext caps don't emit #extension

Two facts found while reviewing shader-slang/slang#13333 (verified with a Release build at a05023cd30):

1. **Combined samplers get an extra paren in emitted GLSL.** A combined-sampler call like `SamplerCubeArrayShadow.SampleCmpBias(...)` on `-target glsl` emits `texture((combinedShadowCubeArray_0), (_S1), (0.5), (0.25))`. So `CHECK: texture(combinedShadowCubeArray` never matches, even on correct output. Use `texture({{.*}}name`. Separate Texture+SamplerComparisonState calls emit `texture(samplerCubeArrayShadow(tex_0,samp_0), …)` with no extra paren. Run any suggested CHECK sketch at head before you post it; a reviewer bot's untested sketch had exactly this bug.

2. **`-profile glsl_460+GL_EXT_X` and `-capability GL_EXT_X` do NOT emit `#extension GL_EXT_X`.** The directive comes only from per-use `__requireCapability` / `__glsl_extension` (IRRequireTargetExtension). A test that asserts `#extension` is therefore not made vacuous by a profile that already includes the extension. Picking `glsl_460` over a richer profile is not load-bearing.

Also, when you drill test failability, break the compiler rather than the test:
- Remove the wrapper's `__glsl_extension` + `__requireCapability`, or revert `SampleCmpBias`→`SampleCmp` in the `glsl.meta.slang` `default:` branch.
- Then run `cmake -E touch <meta>`, and build the `generate_core_module_headers` + `slangc` targets (about 3 min on Release).
- This drill showed the existing tests (sample-cmp.slang, intrinsic-texture.slang) passing under the regression, while only the new per-form tests failed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790724590745-glsl-emit-combined-sampler-calls-are-texture-name-.md`_
