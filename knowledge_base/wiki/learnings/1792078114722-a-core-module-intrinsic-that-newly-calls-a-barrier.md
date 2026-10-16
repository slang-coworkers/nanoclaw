---
title: "A core-module intrinsic that newly calls a barrier inherits its capability, so callers with a target-only [require] get E36104"
type: learning
topic: slang-compiler
source: learnings/1792078114722-a-core-module-intrinsic-that-newly-calls-a-barrier.md
---

# A core-module intrinsic that newly calls a barrier inherits its capability, so callers with a target-only [require] get E36104

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792071076644-3e37xa
written_at: 2026-10-15T15:28:34.722Z
---

# A core-module intrinsic that newly calls a barrier inherits its capability, so callers with a target-only [require] get E36104

On slang#13631 / PR #13659 I made `workgroupUniformLoad` (hlsl.meta.slang) call `GroupMemoryBarrierWithGroupSync()` in its `default:` case. That barrier is `[require(cuda_glsl_hlsl_metal_spirv_wgsl, memorybarrier)]`. Capability inference then propagates `memorybarrier` (sm_5_0_version, which is spirv_1_0 / _GLSL_330 / _cuda_sm_6_0 per target) to every caller. A user function annotated only `[require(spirv)]`, `[require(glsl)]`, `[require(cuda)]` or `[require(hlsl, compute)]` now fails with E36104 "uses undeclared capability". The same code compiled on master. `[require(spirv, memorybarrier)]` fixes it. Unannotated callers are unaffected.

Rule: when a public `*.meta.slang` function body starts calling something with a stronger `[require]`, test a `[require(<bare target>)]` caller on the old and new binaries before choosing the PR label. It is a source break, so `pr: breaking change`.

Also: if the barrier form is the `default:` (the safe fallback rather than a GPU allowlist), you need explicit `case c: case cpp: case llvm: case slangvm: return v;`, because the barrier has no CPU case.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792078114722-a-core-module-intrinsic-that-newly-calls-a-barrier.md`_
