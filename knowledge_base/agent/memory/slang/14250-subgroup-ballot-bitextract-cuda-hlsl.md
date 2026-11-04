---
type: chain
title: slang#14250 — wrong `subgroupBallotBitExtract` / vector `WavePrefixBitXor` on CUDA; `subgroupInverseBallot` invalid HLSL
description: Bot-filed 11-03 19:23:45Z (label `reproduced`), split off the #14249 triage (triager links it in its 19:25:54Z comment under "Bugs found during the sweep"). FIXER DISPATCHED 11-03 19:28Z (slang-fixer sess-1793734137589-ke79a8) after the #14249 [Report] left routing to Orchestrator.
tags: [glsl-intrinsics, wave-intrinsics, cuda, hlsl, subgroup, bot-filed, follow-up]
---

# slang#14250 — subgroup ballot / prefix-xor wrong bodies

**11-03 19:23:45Z, `issue_opened`.** Author `nv-slang-bot[bot]`, label `reproduced`, unassigned, 0 comments.
Sibling #14251 filed 2 s later.

**Bug (master `7f4efc7ce`, GPU-checked on L40S).** (1) `subgroupBallotBitExtract`: CUDA string
`glsl.meta.slang:8480` and HLSL `:8486` AND with `index`, not `1u << index` → CUDA gives inverted results.
(2) `subgroupInverseBallot` HLSL string `:8453` has an extra `)` → DXC error. (3) Vector/matrix
`WaveMaskPrefixBitXor` (`hlsl.meta.slang:17693`, `:17701`) call `WaveMultiPrefixBitOr` → CUDA prefix OR.
Test gap: `shader-subgroup-ballot.slang` runs GPU only on VK/WGPU; CUDA line disabled.

**Provenance.** The #14249 triager (`sess-1793731692615-3hdbms`) filed it during its 79-function sweep and lists it
in its #14249 triage comment (19:25:54Z, "Bugs found during the sweep (filed separately)").

**Disposition (Orchestrator, 11-03).** **No dispatch** — owned by the #14249 triager chain (same as #14251; the
#14042 lesson). Not self-assigned, so a fixer is not assignee-blocked; small, string-level fix with GPU repro.
A fixer goes on `gh-issue-shader-slang/slang-14250` only if the #14249 `[Report]` proposes it.

**Update 11-03 19:28Z — fixer dispatched.** The #14249 `[Report]` (19:27Z) filed this issue and left routing to Orchestrator. The fixer load was light
(2 running sessions) and the issue is not assignee-blocked, so slang-fixer was dispatched on the canonical thread (session `sess-1793734137589-ke79a8`,
verified on-thread). It was told to change only the named functions (#14249's assignee is editing the same `glsl.meta.slang` section), to write
"Related: #14249" in the PR, and to add GPU COMPARE_COMPUTE coverage. Reported to the dashboard under the fan-out rule.

**11-03 ~20:53Z — DRAFT PR #14254** (`fix/issue-14250`, head `8d245b47a` → `8fac701` at 22:06Z after review, `pr: non-breaking`). Body says "Fixes #14250" and
"Related: #14249". pr-mapping → slang-fixer `sess-1793734137589-ke79a8`. CI is skipped while the PR is a draft. The fixer sent its
explain-diff HTML (`/workspace/inbox/a2a-1793739654871-5u4zrr/`). **Ready-flip pending** (weekly un-draft list; no per-PR ask).

**11-03 21:08Z fixer `[Report]`.** It reproduced and fixed all 3 bugs. New GPU tests pass on CUDA and VK, DXC accepts the HLSL, and the regression run is 1971/1971.
The HLSL switch emitted only case 0 because `findTargetIntrinsicDefinition` takes the first `__intrinsic_asm`. The vector `WaveMaskPrefixBitXor` was wrong on all
targets, but only CUDA reaches it. slang-reviewer review was requested. It found a side-find: GLSL-source COMPARE_COMPUTE on VK runs 1 thread per workgroup
(render-test loses `layout(local_size_x)`). I told it to file that (verified + deduped, per the filing policy), not fix it in #14254, and report the number; routing is mine.
The reply was confirmed in the fixer session (seq 10).

**Side-find filed 11-03 21:25Z as [#14256](14256-glsl-local-size-lost-non-shader-entry-point.md); new fixer chain dispatched 21:31Z.**

**Resume on:** a review or comment on #14254 (the webhook routes it to the fixer); a human comment on #14250.
Related: [#14249](14249-glsl-subgroup-hlsl-cuda-gap.md), [#14251](14251-wave-ops-bool-cuda-spirv-hlsl.md).
