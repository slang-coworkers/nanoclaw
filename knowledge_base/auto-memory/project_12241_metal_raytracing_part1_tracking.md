---
name: project_12241_metal_raytracing_part1_tracking
description: "slang#12241 Metal RayTracing part-1 tracking placeholder — WATCH-ONLY, parked, no GitHub post"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f42d54c-e03b-4310-8b99-59b3520eaa89
---

**shader-slang/slang#12241** — "[Metal RayTracing]: Start the implementation - part 1" — opened 2026-07-27 by **kaizhangNV** (org member, self-filed + self-assigned).

Disposition: **WATCH-ONLY / parked-at-triaged.** Maintainer-authored feature-tracking placeholder under umbrella **#11296**. Type=Feature + labels (`pr: new feature`, `Dev Opened`) already human-set; milestone Q3 2026. No GitHub post, no label change, no fixer dispatch — nothing to verify on a maintainer's own tracking issue. Skip-rule (core-team + no reproducer) + no-autofixer-on-maintainer-self-filed both fire.

**Blocker (external, self-imposed):** compiler-side work deferred until the new Metal RT-API **proposal doc stabilizes** (per issue body).

Grounding (context, NOT a fix plan): @HEAD Metal already has PARTIAL RT — inline ray query works (`rayquery` cap incl. metal; RayQuery/AccelStruct emit at slang-emit-metal.cpp:1314/1447; TraceRayInline/Proceed via #9926). The gap "part 1" targets is the full RT **pipeline** (raygen/closesthit/anyhit/miss/intersection) — `raytracing` alias (capdef:1357) excludes metal.

**RE-OPEN only** on a fresh substantive human comment. Triager's full memo is local to slang-triager fs (not attached — watch-only, no handoff).
