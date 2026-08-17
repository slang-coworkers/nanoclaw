---
title: "CUDA SamplerComparisonState no-op prelude typedef is safe (SampleCmp errors loudly)"
type: learning
topic: misc
source: learnings/1785445968024-cuda-samplercomparisonstate-no-op-prelude-typedef-.md
---

# CUDA SamplerComparisonState no-op prelude typedef is safe (SampleCmp errors loudly)

**Context:** shader-slang/slang#12278 / PR #12300 — the CUDA prelude fix adds a dummy `SamplerComparisonStateUnused*` typedef so a *declared/bound-but-unused* `SamplerComparisonState` global compiles under `-target cuda`/`-target ptx` (symmetric to the existing `SamplerState` dummy). Maintainer jkwak-work chose this "Approach A" (no-op) over a diagnostic (Approach B) and approved directly.

**The load-bearing scope question — does making a comparison sampler a no-op open a silent-miscompile hole?** NO. Verified from source at HEAD 1963de7280:

- `SampleCmp` (and `SampleCmpLevelZero`, etc.) in `source/slang/hlsl.meta.slang` (~line 1520) is declared `[require(glsl_hlsl_metal_spirv_wgsl, texture_shadow)]` and its `__target_switch` has cases for `glsl/hlsl/metal/spirv/wgsl` only — **no `cuda` case**.
- So *calling* `SampleCmp` on CUDA fails with a **loud capability diagnostic**, not a silent wrong result. The prelude typedef only lets an *unused/bound* comparison sampler occupy uniform space as a harmless pointer no-op — identical to how `SamplerState` already behaves on CUDA.

**Reviewer takeaway:** when a "make-it-a-no-op" prelude fix is proposed, the safety check is whether the *methods* of that type have a target case for the backend. If the method's `__target_switch` omits the backend + is capability-gated, the no-op type-backing is safe (usage errors loudly upstream). Confirm the emitter case for the type name is pre-existing (here `kIROp_SamplerComparisonStateType → "SamplerComparisonState"` in `slang-emit-cuda.cpp:388`, already on master) — the fix is then purely the missing prelude backing type.

**Process note:** GH token was dead (rotated) again — reviewed via local-git read-only `gh` shim in production `pr` mode on the public repo (anonymous `git fetch`/`ls-remote` works; shim serves `pr diff`/`pr view --json headRefOid,baseRefOid,files`). Diff SHA256 matched the runner's integrity marker byte-for-byte.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785445968024-cuda-samplercomparisonstate-no-op-prelude-typedef-.md`_
