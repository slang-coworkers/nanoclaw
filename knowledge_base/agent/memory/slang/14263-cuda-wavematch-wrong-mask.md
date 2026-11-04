---
type: chain
title: slang#14263 — CUDA `WaveMatch` returns 0 instead of the matching-lane mask
description: Bot-filed 11-03 ~21:46Z by the #14251 fixer as follow-up (d). GPU-verified wrong results. FIXER DISPATCHED by Orchestrator (#14249 session) 11-03 21:50Z (sess-1793742658766-2wnjo7) on gh-issue-shader-slang/slang-14263.
tags: [cuda, wave-intrinsics, wrong-code, bot-filed, follow-up]
---

# slang#14263 — CUDA `WaveMatch` wrong mask

**Filed** 11-03 ~21:46Z by the #14251 slang-fixer (`sess-1793734151343-ptsuqv`). Labels `cuda,bug,reproduced`; unassigned.
**Bug.** CUDA `WaveMatch` lowers to `__match_all_sync` for every type. On the L40S with lane values `lane % 2`,
Vulkan gives `0x55`/`0xAA` and CUDA gives `0` in all 16 slots (the correct op is `__match_any_sync`). Repro is in the issue.
Not a duplicate (#4097 closed, SPIR-V only). Related: #14251, #14264 (same `__match_all_sync` path, `half`).

**Disposition (Orchestrator, 11-03).** Wrong results on a GPU target and not assignee-blocked, so a fixer was dispatched
(fan-out reported to the dashboard). Sibling Main session `sess-1793742410896-gq5i0q` (issue_opened webhook) must NOT dispatch again.

**11-03 21:52Z — webhook session stood down.** `sess-1793742410896-gq5i0q` verified the fixer session on-thread (dispatch says #14264 stays filed-only, not folded in; avoid #14254/#14255 lines) and sent nothing to the fixer.

**11-03 ~22:32Z — DRAFT PR #14273** (`fix/issue-14263`, head `b8b3e16f0` → `4a2bfdc7e` at 22:57Z with the matrix `WaveMaskMatch` fold-in → `c3e121add` at 23:46Z (round 3), `pr: non-breaking`). Body says "Fixes #14263" and "Related: #14251".
pr-mapping → `sess-1793742658766-2wnjo7`. It is a prelude-only fix: `_waveMatchScalar`/`_waveMatchMultiple` now use `__match_any_sync`, as the IR-op path already did.
Explain HTML is in `/workspace/inbox/a2a-1793745493402-8jusfo/`. **Ready-flip pending.**

**11-03 22:43Z `[Report]`.** There were two CUDA bugs: (1) the prelude used `__match_all_sync` (`:4590`), now `__match_any_sync`; (2) `hlsl.meta.slang:19606/19626` copied the mask
into `.yzw`, now `uint4(m,0,0,0)`. CUDA output is byte-identical to vk in 56 slots; `tests/hlsl-intrinsic/` 689/689 and `tests/glsl-intrinsic/` 258/258. Review requested.
My 22:45Z decisions: **fold** the matrix `WaveMaskMatch` CUDA missing-`.x` bug (`:17626`) into #14273 with a matrix test row (same family; do not file it).
**#14264** stays filed-only until #14273 merges (same 4 helpers; approach: match on `__half_as_ushort`, watch the `__half3` padding). Route it on the fixer's close-out.

**11-03 22:58Z.** The fold-in was pushed: test `d7f615da4` (matrix slots 56–63; master fails in NVRTC with `uint4`→`uint`) and fix `4a2bfdc7e`. All 64 CUDA slots match vk. CI run 41734538548. The reviewer was told the head moved.

**11-03 23:48Z `[Fix Report]`.** Every CUDA WaveMatch/WaveMaskMatch path the test covers matches vk; 4 files, +143/−9. slang-reviewer R1 on `4a2bfdc7e` gave APPROVE_WITH_NITS (0 bugs),
and N1–N5/T1 were applied, giving head `c3e121add`. The reviewer's full suite is 11216/11219 (3 fp8-cuda failures that also fail on master). CI run 41741167502. **#14273 is a draft; ready-flip pending.**
Reviewer side-find S1: the matrix `WaveMaskMatch` has no spirv case (E36107), and its glsl case emits `subgroupPartitionNV(mat2x2)`, which glslang rejects. I sent it to the triager
(`sess-1793743610800-318xsf`) to fold into [#14270](14270-wavemaskprefixbitand-matrix-spirv-glsl.md); no new issue.

**Resume on:** #14273 merge close-out (then route #14264 and [#14281](14281-wavematch-glsl-missing-extension.md) — both edit the same WaveMatch code — #14264 with the `__half_as_ushort` and real-component-count notes); a review or comment on #14273; a human comment on #14263.
