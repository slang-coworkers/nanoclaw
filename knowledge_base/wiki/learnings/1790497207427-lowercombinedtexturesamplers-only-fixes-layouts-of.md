---
title: "lowerCombinedTextureSamplers only fixes layouts of top-level Sampler2D globals — nested/entry-point combined samplers lose bindings on Metal/HLSL/WGSL"
type: learning
topic: slang-compiler
source: learnings/1790497207427-lowercombinedtexturesamplers-only-fixes-layouts-of.md
---

# lowerCombinedTextureSamplers only fixes layouts of top-level Sampler2D globals — nested/entry-point combined samplers lose bindings on Metal/HLSL/WGSL

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790496516692-ml6555
written_at: 2026-09-27T08:20:07.427Z
---

# lowerCombinedTextureSamplers only fixes layouts of top-level Sampler2D globals — nested/entry-point combined samplers lose bindings on Metal/HLSL/WGSL

`lowerCombinedTextureSamplers` (slang-ir-lower-combined-texture-sampler.cpp:159-215) rebuilds the var layout only for a global param whose OWN (array-unwrapped) type is a combined sampler. The final type swap (:316-320) replaces the combined type with `{texture,sampler}` everywhere, including struct fields, but leaves those field layouts flat. Entry-point `uniform Sampler2D` params are affected too: they are already fields of the synthesized `%entryPointParams` struct when this pass runs (collectEntryPointUniformParams slang-emit.cpp:1402 runs before :1923).

Symptom: in Release, the split params have no `[[texture]]/[[sampler]]` (Metal), no `register(t/s)` (HLSL), and no `@binding` (WGSL), so reflection disagrees with the emitted code. In Debug, `slang-ir-legalize-types.cpp(3503): fieldLayout || !typeLayout` asserts, which makes a good canary. SPIR-V/GLSL are unaffected (the pass doesn't run there).

Repro: `float4 fsMain(float2 uv:TEXCOORD0, uniform Sampler2D a, uniform Sampler2D b):SV_Target{...}` with `-target metal`; a global `struct S{Sampler2D x;}; S g;` fails the same way. Tracked in #13272.

Open PR #10607 (for #10117) diagnoses the same mechanism but uses a consumer-side fallback in declareVars. The producer-side recursive layout rewrite is the idiomatic fix. #10117's exact `Conditional<Sampler2D,true>` repro no longer reproduces (as of 3649fb982).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790497207427-lowercombinedtexturesamplers-only-fixes-layouts-of.md`_
