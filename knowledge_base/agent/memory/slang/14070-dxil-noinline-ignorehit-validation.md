---
type: chain
title: slang#14070 — DXIL: a `[noinline]` helper that calls IgnoreHit fails DXC validation
description: Human-filed by kaizhangNV (MEMBER, self-assigned) 2026-10-29 23:47:08Z, found during portable-RT work (#14051). Triaged bug/medium/P2 10-30 00:01Z (rec A: run the CUDA-only shader-terminating-callee inliner for HLSL too). Parked, owned by the reporter; R6 one-shot t-9a039e posts 11-02 23:55Z; no fixer without the reporter's go-ahead.
tags: [dxil, hlsl, ray-tracing, noinline, capabilities, r6]
resource: /workspace/agent/reports/triage/triage-14070.md
---

# slang#14070 — `[noinline]` IgnoreHit helper fails DXC validation

**Ask.** An anyhit entry calls a `[noinline]` helper that calls `IgnoreHit()`. With
`-target dxil -profile sm_6_6`, DXC 1.9 reports `Opcode IgnoreHit not valid in shader model lib_6_6(lib)`.
Without `[noinline]` it compiles. Vulkan and OptiX accept the out-of-line form. The reporter wants either a
supported DXIL form or an actionable target-specific diagnostic, and notes the stage/noinline target contract
needs investigation (they do not claim DXC must accept it).

**Routing (10-29 ~23:5xZ).** Live check: open, 0 comments, no labels, assignee kaizhangNV (self). The memory grep
for 14070 had no hit; a search for `IgnoreHit noinline` found no duplicate. The only session on the thread was my
webhook session. kaizhangNV's open #14051 (portable RT frontend, 100 files) touches capabilities and tests,
but no HLSL/DXIL emit or inlining file; the body says the portable backend has no workaround either.
Same reporter, same day: [14066](14066-result-void-error-extraction.md) and [14067](14067-ir-validate-throw-terminator.md),
which I handled the same way. Related hazard: the [#13108 record](13108-cuda-byvalue-struct-copy.md) mentions an IgnoreHit write-back hazard.
Dispatched to slang-triager on `gh-issue-shader-slang/slang-14070` with the R6 hold: no bot comment,
PR or commit naming the issue before 2026-11-02 23:47:08Z, and no fixer handoff without the reporter's go-ahead.
- 10-29 23:52Z, triager progress (its finding, not re-checked by me): reproduced on ToT 1f0b33b86 with the same DXC 1.9 error. It is now checking the DXC rules and Slang's options, with GitHub writes held under R6.

**Triage (slang-triager, 10-30 00:01Z, ToT 1f0b33b86; the triager's findings. I checked only that the function exists at the cited line).**
bug / medium / HLSL-DXIL emit + IR inlining / P2. Not a regression, not a duplicate.
- Fails at sm_6_3–sm_6_9, and `AcceptHitAndEndSearch` fails the same way. DXC rejects it on purpose: hctdb gives both ops `anyhit` only,
  with no `library`. The validator checks helpers as `lib` (1.6–1.9), and DXC's test `raytracing_accept_ignore_hit_fail_lib.hlsl` expects the error.
  Other RT intrinsics (`ReportHit`, `TraceRay`, `CallShader`, `RayTCurrent`, `HitKind`) pass in `[noinline]` helpers.
- The gap: `inlineShaderTerminatingCalleesForRayEntryPoints` (`slang-ir-legalize-varying-params.cpp:1876`, from #11660) runs only for CUDA
  (`slang-emit.cpp:2437`), and it inlines such callees even when they are `[noinline]`. That is why OptiX "accepts" this code. HLSL emits the `[noinline]` unchanged.
- Options: **A (rec)** run that pass for HLSL too and make the E55214 text target-neutral; B an HLSL-only Slang error (like Metal E56108);
  C drop `[noinline]` at emit (consumer patch, breaks `export`). Exported or precompiled helpers can't be inlined, so they need a Slang diagnostic.
- Side note (the triager's guess, not checked): the GLSL output keeps an out-of-line `inout` helper that calls `ignoreIntersectionEXT`,
  so a payload write could be lost, like OptiX #11658/#6326. Not acted on.

**Parked 10-30 00:01Z,** owned by the reporter. Nothing on GitHub (R6). The draft is in the triager's memory (`issues/comment-14070.md`).
Its one-shot **t-9a039e** runs 2026-11-02 23:55Z. If there is no reporter PR or maintainer comment, it posts the 5-bullet, then adds `reproduced` + Type=Bug
only if both are still blank. (My `ncl tasks get` cannot see the triager's tasks, so "not found" there proves nothing.)
