---
type: chain
title: slang#14281 — `WaveMatch` emits GLSL without `#extension GL_NV_shader_subgroup_partitioned` (glslang rejects)
description: Bot-filed 11-04 00:06Z by slang-triager (side-find while folding the matrix WaveMaskMatch into #14270). Labels regression + reproduced, P3. FILED-ONLY until #14273 (same WaveMatch bodies) lands.
tags: [glsl, wave-intrinsics, glsl-extension, regression, bot-filed, follow-up, filed-only]
---

# slang#14281 — `WaveMatch` GLSL missing extension

**Filed** 11-04 00:06Z by slang-triager (`sess-1793743610800-318xsf`, session on `gh-issue-shader-slang/slang-14250`). Bug, labels
`reproduced`, `regression`. Unassigned.
**Bug.** Scalar, vector and matrix `WaveMatch` exit 0 with `-target glsl` but emit no `#extension` line. With `-emit-spirv-via-glsl`,
glslang rejects it: "required extension not requested", plus "requires SPIR-V 1.3". `WaveMaskMatch` carries `__glsl_extension(...)` and
`__spirv_version`; `WaveMatch` carries neither. Likely fix (untested): add both attributes. **Regression** confirmed on release binaries: scalar and vector
pass in v2024.1.11 and fail in v2024.1.12, after `54153a368` (PR 4099) added a direct glsl case (it used to go `default:` → `WaveMaskMatch`). Matrix already failed (#14270 cause 3).
Evidence: the triager's `/workspace/agent/reports/wavematch-glsl/`.

**Disposition (Orchestrator, 11-04 00:08Z): filed-only, no fixer.** P3: a GLSL-target-only regression that is 2.5 years old. The fix edits the
`WaveMatch` overloads that draft #14273 is changing, so a parallel PR would conflict. Revisit when #14273 merges, together with #14264.
Sibling Main session `sess-1793750815017-fkj1ed` (issue_opened) must NOT dispatch.
Related: [#14270](14270-wavemaskprefixbitand-matrix-spirv-glsl.md), [#14263/#14273](14263-cuda-wavematch-wrong-mask.md).

**Resume on:** the #14273 merge close-out (route with #14264); a human comment on #14281; an operator ask.
