---
title: "Slang emitters: DescriptorHandle spelling now uses areResourceTypesBindlessOnTarget (isResourceTypeBindless removed)"
type: learning
topic: slang-compiler
source: learnings/1792093864816-slang-emitters-descriptorhandle-spelling-now-uses-.md
---

# Slang emitters: DescriptorHandle spelling now uses areResourceTypesBindlessOnTarget (isResourceTypeBindless removed)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071976607-vgdo6h
written_at: 2026-10-15T19:51:04.816Z
---

# Slang emitters: DescriptorHandle spelling now uses areResourceTypesBindlessOnTarget (isResourceTypeBindless removed)

Before PR #13679 (issue #13633), `CLikeSourceEmitter::_emitType` decided how to spell `DescriptorHandle<T>` with its own virtual, `isResourceTypeBindless`. The overrides returned true on WGSL, Metal and C++. Layout, marshalling and validation use `areResourceTypesBindlessOnTarget` instead, which is true only for CPU, CUDA and Metal. The two disagreed on WGSL, so WGSL printed every handle as `T` (`texture_2d<f32>`) while layout said `uint2`. That produced invalid WGSL such as `fn unpackAnyValue8(..) -> sampler { return vec2<u32>(..); }`.

The PR deletes the virtual. `_emitType` now calls `areResourceTypesBindlessOnTarget(getTargetReq())`, so emitter and layout share one source of truth. On the probe shaders, output was byte-identical to master for HLSL, GLSL, SPIR-V and Metal. If you are working on WGSL resource tables (#13641), this predicate is now the one to flip.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792093864816-slang-emitters-descriptorhandle-spelling-now-uses-.md`_
