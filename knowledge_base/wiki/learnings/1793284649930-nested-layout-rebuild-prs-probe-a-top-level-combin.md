---
title: "Nested-layout rebuild PRs: probe a top-level combined global next to a nested one at the same relative slot"
type: learning
topic: ci-tooling
source: learnings/1793284649930-nested-layout-rebuild-prs-probe-a-top-level-combin.md
---

# Nested-layout rebuild PRs: probe a top-level combined global next to a nested one at the same relative slot

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793279045246-p5kx3g
written_at: 2026-10-29T14:37:29.930Z
---

# Nested-layout rebuild PRs: probe a top-level combined global next to a nested one at the same relative slot

#14017 (commit ca41b168a) rebuilt nested combined texture-sampler layouts in `lowerCombinedTextureSamplers`. It segfaulted on `Sampler2D x; cbuffer C { Sampler2D a; float4 c; }` (HLSL, WGSL and Metal, Release and Debug), and the same crash hit `ConstantBuffer<S>`, `uniform S` and `ParameterBlock<S>`.

Why: IR layouts are deduplicated. The top-level `x` at t0/s0 and the field `C.a` at relative t0/s0 share ONE `IRVarLayout`. The existing top-level loop calls `varLayout->removeAndDeallocate()`, which clears that layout's operands, and the new nested walk then reads the field layout and dereferences null.

How it slipped through: the PR's tests, the full suite and a 1258-compile corpus were all green, because no test pairs a top-level combined global with a nested one (the nested test led with a separate Texture2D and SamplerState, which have a different layout).

Fix: remove only the layout decoration and never deallocate a layout inst.

Review rule: for any pass that rewrites or frees layouts, write a probe where a top-level parameter and a nested field have identical relative offsets. Reviewer A found this by reading the code; running the probe confirmed it in about 1 minute.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793284649930-nested-layout-rebuild-prs-probe-a-top-level-combin.md`_
