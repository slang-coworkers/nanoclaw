---
type: chain
title: slang#14251 — wave ops on bool / bool vectors: CUDA NVRTC ElementTypeTrait gap; WaveActiveBit* on bool invalid SPIR-V + HLSL
description: Bot-filed 11-03 19:23:47Z (label `reproduced`), sibling of #14250 (19:23:45Z); both split off the running #14249 triage. FIXER DISPATCHED 11-03 19:29Z (slang-fixer sess-1793734151343-ptsuqv) after the #14249 [Report] left routing to Orchestrator.
tags: [wave-intrinsics, cuda-prelude, spirv, hlsl, bool, bot-filed, follow-up]
---

# slang#14251 — wave ops on `bool` / `bool` vectors

**11-03 19:23:47Z, `issue_opened`.** Author `nv-slang-bot[bot]`, label `reproduced`, unassigned, 0 comments.
Body ends "Related: #14249".

**Bug.** (1) CUDA: `ElementTypeTrait` in `prelude/slang-cuda-prelude.h` has no `bool1..4` specializations, so
NVRTC fails for most wave ops on `bool2..4` (`WaveRotate`/`WaveClusteredRotate` work via int round-trip overloads).
(2) `WaveActiveBitAnd/Or/Xor` on `bool`: SPIR-V emits `OpGroupNonUniformBitwise*` (needs `Logical*`); HLSL passes
`bool` to DXC's unsigned-only `WaveActiveBit*`. `slangc` exits 0 on all three targets.

**Provenance.** Filed 2 s after #14250 (same bot, same `reproduced` label), while the slang-triager session on
`gh-issue-shader-slang/slang-14249` (`sess-1793731692615-3hdbms`, started 18:48) was building the subgroup
inventory and had not yet reported. Neither bot issue had its own dispatch. ⇒ Split-offs of the #14249 triage.

**Disposition (Orchestrator, 11-03).** **No dispatch** — the #14249 triager chain owns this; minting a separate
triager would duplicate it (the #14042 lesson). Unlike #14249, #14251 is **not** self-assigned, so a fixer is not
blocked by assignee. A fixer goes on `gh-issue-shader-slang/slang-14251` only if the #14249 `[Report]` proposes it.

**Update 11-03 19:29Z — fixer dispatched.** The #14249 `[Report]` (19:27Z) filed this issue and left routing to Orchestrator. The fixer load was light
(2 running sessions) and the issue is not assignee-blocked, so slang-fixer was dispatched on the canonical thread (session `sess-1793734151343-ptsuqv`,
verified on-thread). It was told to change only the named functions (#14249's assignee is editing the same `glsl.meta.slang` section), to write
"Related: #14249" in the PR, and to add GPU COMPARE_COMPUTE coverage. Reported to the dashboard under the fan-out rule.

**11-03 ~21:10Z — DRAFT PR #14255** (`fix/issue-14251`, head `023752299` → `847c886` at 22:39Z after review round 1 → `305b317` at 23:54Z after round 2, `pr: non-breaking`). Body says "Fixes #14251" and
"Related: #14249". pr-mapping → slang-fixer `sess-1793734151343-ptsuqv`. The fixer sent its explain-diff HTML (`/workspace/inbox/a2a-1793740658888-8ns0fh/`).
**Ready-flip pending** (weekly un-draft list; no per-PR ask).

**11-03 21:24Z fixer `[Report]`.** Root causes: the CUDA prelude `ElementTypeTrait` had no bool; SPIR-V bitwise wave ops emitted `Bitwise*` where bool needs `Logical*`
(WaveActiveBit*/WaveMultiBit*/WaveMultiPrefix*Bit*); HLSL now reduces bool as a 0/1 uint. Bool stays in the overload sets. GPU tests pass on CUDA and VK, DXIL passes DXC,
and the regression run is 2065/2065. `glsl.meta.slang` is untouched. The fixer dropped its duplicate `WaveMaskPrefixBitXor` fix so that it stays only in #14254.
slang-reviewer review requested; jkwak-work was auto-assigned as shepherd. Follow-ups: I told it to file (a) bool in WGSL subgroup ops, (c) DXC `WaveActiveBit*(int)`,
(d) CUDA `WaveMatch` via `__match_all_sync` gives wrong results, and (e) the CUDA vote test `__half*` NVRTC failure, each reproduced on master and deduped. **Not** (b) Metal,
which is unvalidated and goes into the PR body as not tested. Numbers come in its [Fix Report]; fixer routing is mine.

**11-03 22:23Z.** slang-reviewer R1 returned REQUEST_CHANGES (small). The trait fix lets CUDA `WavePrefixBitXor(boolN)` compile, which turns the old vector
`WaveMaskPrefixBitXor`→Or bug from an NVRTC error into silent wrong results. The fixer is adding back the 2-line hunk, identical to #14254's; `git merge-tree` is clean
in either merge order, so no merge-order rule is needed. I agreed by staying silent (default = proceed). Follow-ups filed: #14261–#14264 (see their records).

**11-03 23:55Z `[Fix Report]`.** Fixed: 7 files, +505/−43, 9 commits, head `305b31791`. slang-reviewer R1 REQUEST_CHANGES (the Xor→Or hunk re-added); R2 APPROVE_WITH_NITS, nits applied, 0 open bugs.
Regression 2065/2065; reviewer full suite 11215/11218 (3 fp8-cuda failures that also fail on master). dx12 runtime rows need CI: run 41741656029 is `waiting` (probably approval). Shepherd: jkwak-work.
Explanation comment 6615652001. **#14255 is a draft; ready-flip pending (weekly list).**

**Resume on:** a review or comment on #14255 (the webhook routes it to the fixer); a human comment on #14251.
Related: [#14249 record](14249-glsl-subgroup-hlsl-cuda-gap.md).
