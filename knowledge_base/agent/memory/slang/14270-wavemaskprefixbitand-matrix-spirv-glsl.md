---
type: chain
title: slang#14270 — matrix `WaveMask*` / `WaveActiveAllEqual` overloads unavailable on SPIR-V/GLSL
description: Bot-filed 11-03 22:11Z by slang-triager (slang-reviewer side-find S1 on PR #14254, relayed by the #14250 fixer). Bug/low/P3. FILED-ONLY, no fixer (Orchestrator, #14249 session) — P3 with 8 fixer sessions running.
tags: [hlsl-meta, capabilities, spirv, glsl, wave-intrinsics, bot-filed, follow-up, filed-only]
---

# slang#14270 — matrix `WaveMaskPrefixBitAnd` gated `cuda_hlsl`

**Filed** 11-03 22:11:15Z by slang-triager (session on `gh-issue-shader-slang/slang-14250`), label `reproduced`, unassigned.
**Bug.** `hlsl.meta.slang:17649` carries `[require(cuda_hlsl, subgroup_partitioned)]`, but its sibling overloads carry
`cuda_glsl_hlsl_spirv`. As a result spirv/glsl report E36107 at master `f1cd35ff8`. PR #7103 (`0476b57fa`) widened the Or/Xor matrix
overloads and missed And. The fix is one line plus a spirv/glsl compile test, and its callee already validates.
Unchecked: the matrix WaveMaskBroadcastLaneAt/ReadLaneAt/ReadLaneFirst/AllEqual overloads also have narrower requires (own bodies, possibly correct); they are not filed.

**Disposition (Orchestrator, 11-03 22:13Z): filed-only.** It is P3 and the gap fails loudly. 8 slang-fixer sessions are running, so under the fan-out rule it is held as filed-only.
It is independent of #14254: same file, different lines. Sibling Main session `sess-1793743879581-ok46d2` (issue_opened webhook) must NOT dispatch.
Related: [#14250](14250-subgroup-ballot-bitextract-cuda-hlsl.md), [#14249](14249-glsl-subgroup-hlsl-cuda-gap.md).

**11-03 ~22:15Z — webhook session stood down.** `sess-1793743879581-ok46d2` confirmed the triager (`sess-1793743610800-318xsf`, seq 6) holds the filed-only instruction; no dispatch, no GitHub post.

**11-03 22:14Z triager `[Report]`, and my 22:16Z answer.** The other matrix overloads were checked at `f1cd35ff8`. `WaveMaskBroadcastLaneAt`, `WaveMaskReadLaneAt`,
`WaveMaskAllEqual` and `WaveActiveAllEqual(matrix)` fail on spirv/glsl, and `WaveMaskReadLaneFirst` fails on hlsl too. This is a different cause: the gate matches the body,
and no spirv/glsl implementation exists. The non-mask `WaveReadLaneAt`/`ReadLaneFirst` matrix overloads work. I told the triager to **fold these into #14270**
instead of filing a new issue: broaden the title, add a cause-2 section, run OUTPUT_REVIEW, then post a delta comment. The reason: there were already 9 bot issues from this cluster today, and a maintainer handles both groups together.
It is still filed-only at P3.

**11-03 22:23Z — broadened.** New title: "Matrix `WaveMask*` and `WaveActiveAllEqual` overloads are unavailable on SPIR-V and GLSL". Delta comment 6616920879.
Cause 1 is now at line 17650 (the old body said 17649). Cause 2 has a table for BroadcastLaneAt 16972, ReadLaneAt 17023, ReadLaneFirst 17561 (cuda-only), AllEqual 17418,
and WaveActiveAllEqual(matrix) 18235. codex OUTPUT_REVIEW approved in round 2. Evidence: the triager's `/workspace/agent/reports/14270/`. Implement vs. document is left open for a maintainer.

**11-03 23:56Z.** The triager added the matrix `WaveMaskMatch` to the issue. spirv is a cause-2 row (E36107, gate at line 17621). glsl is a new **cause 3**: invalid output, `subgroupPartitionNV(mat2x2)`, which glslang rejects.
The delta comment 6616920879 was edited in place; OUTPUT_REVIEW passed in round 1. Side-find: every `WaveMatch` overload emits GLSL without `#extension GL_NV_shader_subgroup_partitioned`
(no `__glsl_extension` on it; `WaveMaskMatch` has one). I told the triager to **file it separately**, filed-only, P3, "Related: #14270/#14273".

Filed as [#14281](14281-wavematch-glsl-missing-extension.md) (11-04 00:06Z).

**Resume on:** a human comment on #14270; fixer load easing (a later /supervise-issues pass can pick it up); an operator ask.
