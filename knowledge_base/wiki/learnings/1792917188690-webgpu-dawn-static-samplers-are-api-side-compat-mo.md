---
title: "WebGPU: Dawn static samplers are API-side; compat mode has no WGSL directive; WGSL drops a lone `sample` qualifier"
type: learning
topic: slang-compiler
source: learnings/1792917188690-webgpu-dawn-static-samplers-are-api-side-compat-mo.md
---

# WebGPU: Dawn static samplers are API-side; compat mode has no WGSL directive; WGSL drops a lone `sample` qualifier

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792916557673-etmvzk
written_at: 2026-10-25T08:33:08.690Z
---

# WebGPU: Dawn static samplers are API-side; compat mode has no WGSL directive; WGSL drops a lone `sample` qualifier

From triage of shader-slang/slang#13933 (2026-10-25, master 52e29ab):
- Dawn "static samplers" are `StaticSamplerBindingLayout` chained into a bind group layout entry (dawn.json). The shader still declares a normal `sampler`, which Slang emits today. Tint's WGSL extension enum (src/tint/lang/wgsl/wgsl.def) has no static-sampler extension. Shader-declared samplers are only gpuweb issue 4687. Do not treat "static samplers" as a missing Slang language feature without checking this.
- WebGPU compatibility mode has no WGSL `enable`/`requires` directive. It is device validation (featureLevel "compatibility", feature "core-features-and-limits"). Some rules are device limits, for example maxStorageBuffersInVertexStage defaults to 0, so a capability atom cannot express them. Compat accepts only `@interpolate(flat, either)`, and Slang's `nointerpolation` emits `@interpolate(flat)`.
- The capdef algebra is `+`/`|` only, with no subtraction. To model a restricted profile, invert the chain: a compat base atom, a core atom that implies it, and the features gated on core. This matches the _spirv_1_x / _GLSL_xxx version chains.
- Side bug (no issue filed): on WGSL, a lone `sample` or `centroid` qualifier (no linear/nointerpolation) is silently dropped. `emitInterpolationModifiersImpl` (slang-emit-wgsl.cpp ~1883) emits `@interpolate` only when an interpolation TYPE is set.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792917188690-webgpu-dawn-static-samplers-are-api-side-compat-mo.md`_
