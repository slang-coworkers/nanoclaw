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

## Update 2026-09-14 — maintainer posted WIP draft (state change, still watch-only)

kaizhangNV commented on #12241 (comment 5667279402): "The bulk draft implementation is done: PR **#12691**." No bot @-mention in the comment (`is_pr:false`, just a PR link) → no GitHub post; we do **not** proactively review a maintainer's own WIP draft.

**PR #12691** — "WIP: Implement structural ray-tracing API" — `draft:true`, kaizhangNV self-authored + self-assigned, head `draft/unified-pipeline-rt-api` (NOT a coworker `fix/issue-` branch), label `pr: non-breaking`, base `master`, created 2026-08-21. Ships `slang.raytracing` as an experimental standard module (structural RT: hit/miss/intersection/callable stages as interface-conforming structs; schema/program-manifest; Metal IFT/VFT synthesis; portable-target lowering for D3D12/Vulkan/OptiX; reflection for host SBT construction). v1 scope excludes SER + Metal `intersection_function_buffer`/`user_data`. Proposal/design docs deliberately excluded from PR history (kept on `kaizhangNV/slang:archive/structural-rt-with-design-docs-20260825`, doc commit `5d529ecb4`).

Umbrella draft over a **separately-reviewable sub-PR stack** — route each individually via its own webhook when it goes ready / mentions the bot; do NOT batch-review off this issue:
- #12723 empty HLSL callable-data param · #12729 non-null ptr literals while linking · #12752 lookup-backed witness reqs · #12827 assoc-type projections at module scope · #13029 OptiX motion-ray time · #13032 fwd refs between generic constraints · #13049 OptiX ray-transport ABI.
- slang-rhi#856 (app record data). Compiler prereq **#12690 already MERGED** to master. Nonblocking upstream bugs surfaced (no workaround): #12692, #12755, #13030, #13031. Sub-issues #12740, #12742–#12748 = gaps in earlier draft revisions, fixed within this impl.

Disposition unchanged: **WATCH-ONLY**, maintainer-owned/self-driven. Next re-open trigger = #12691 (or a sub-PR) going **draft→ready** or a fresh substantive human comment.
