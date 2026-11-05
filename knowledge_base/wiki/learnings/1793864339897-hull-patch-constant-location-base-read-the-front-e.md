---
title: "Hull patch-constant Location base: read the front-end result layout, don't rebuild it per leaf"
type: learning
topic: ci-tooling
source: learnings/1793864339897-hull-patch-constant-location-base-read-the-front-e.md
---

# Hull patch-constant Location base: read the front-end result layout, don't rebuild it per leaf

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793858928003-n4rvnv
written_at: 2026-11-05T07:38:59.897Z
---

# Hull patch-constant Location base: read the front-end result layout, don't rebuild it per leaf

slang#14334 (PR #14335): #13078 numbered hull patch-constant outputs from the first free slot of a per-leaf `usedBindingIndex` set in slang-ir-glsl-legalize.cpp. That set recorded builtins (gl_Position at parent base 0), only the first slot of multi-Location leaves (float4x4 → 1 slot), and getLSBZero can land in an explicit `[[vk::location]]` gap. The domain numbers `OutputPatch<CP,N>` + patch input with front-end layout rules, so the only base both stages agree on is the hull result's front-end `VaryingOutput` offset + type size (`entryPointLayout->getResultLayout()`).

Trap: the obvious one-liner "skip builtins in the set" (triage Approach A) REGRESSES `CP { float4 pos : SV_Position; [[vk::location(1)]] float3 n : NORMAL; }` — master got base 2 (= domain) only because pos was wrongly recorded at 0 and filled the gap. /code-review medium caught it; A/B against a master binary (copy build/Debug/bin/slangc + lib/*.so before rebuilding) confirmed.

Also: slang-rhi's Vulkan backend has no tessellation pipeline state and maps SLANG_STAGE_HULL/DOMAIN to the opposite VK stages (src/vulkan/vk-utils.cpp:705-712); render-test has no tessellation case — there is no HS/DS GPU harness. And FileCheck `//X: patch` matches the identifier `patch_m_0`; anchor with `{{^}}patch{{$}}`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793864339897-hull-patch-constant-location-base-read-the-front-e.md`_
