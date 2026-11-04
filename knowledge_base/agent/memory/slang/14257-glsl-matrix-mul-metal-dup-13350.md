---
type: chain
title: slang#14257 — GLSL matrix operator* missing metal in [require] (duplicate of #13350 / draft PR #13356)
description: Maintainer (jkwak-work) self-filed + self-assigned 11-03 21:29Z. Same 7 gates as #13350; bot draft PR #13356 (parked for jhelferty-nv) already widens them to include metal+wgsl. Partial dup: the METAL test line also needs #8557 (std140). Triager posted the pointer cmt 6616103112 at 11-03 21:40:55Z. Chain idle, waiting on jkwak-work; NO fixer, NO push to #13356.
tags: [glsl-module, matrix, operator-mul, metal, capability-gate, duplicate, maintainer-owned]
---

# slang#14257 — GLSL matrix `operator*` off Metal

**11-03 21:29:24Z, `issue_opened`.** Live read: OPEN, author **jkwak-work**, assigned to jkwak-work by jkwak-work
1 s after filing (21:29:25Z), 0 labels, 0 comments. Found through the #14215 work (`SIMPLE` checks exit code): the
METAL line of `tests/glsl/matrix-mul.slang` has failed since #4510 but its FileCheck only matched text.

**Duplicate of [#13350](13350-glsl-matrix-mul-wgsl-metal-gate.md)** (andy-slater, WGSL+Metal; assignee jhelferty-nv,
Q4 2026). I checked live 11-03: bot draft PR **#13356** @ 39e7f04 changes the same 7 gates (3 `operator*`, 4 `operator*=`)
from `cpp_cuda_glsl_hlsl_spirv_llvm` to `cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm`, and adds
`tests/glsl/matrix-mul-wgsl-metal.slang`. It does not touch `tests/glsl/matrix-mul.slang` (that file's METAL line is
on master as-is). **Correction 11-03 21:36 (triager caught it):** that METAL line does NOT pass with #13356 alone. Its `layout(std140)` block then fails E36107 on `Std140DataLayout` (gated spirv/glsl only, `hlsl.meta.slang:40-55`), which is open **#8557** (assigned jkwak-work), see our cmt 5920354066 there. My dispatch had said the line would pass; I sent the correction. Triager confirmed it 21:38 on a near-master build (9b46bca64): with `*` bypassed, the METAL line stops at `Std140DataLayout`. Draft, MERGEABLE, ~178+ behind, review requested from jhelferty-nv, last comment ours 10-30.

**Disposition (Orchestrator 11-03).** Bug class (#14249 precedent), so slang-triager on
`gh-issue-shader-slang/slang-14257`: verify the duplicate and post ONE short pointer comment on #14257
(#13350 / #13356 for the operator gates; the matrix-mul.slang METAL line then still needs #8557 std140; bot can merge master into #13356 on request).
No fixer: reporter self-assigned. #13356 stays parked (#13350 decision A = (c)); no push, no rerun.

**Resume on:** triager `[Report]`; a jkwak-work / jhelferty-nv reply asking for a merge-master or other bot action
on #13356 (→ slang-fixer on `gh-issue-shader-slang/slang-13350`, the #13356 owner); #14257 closed as dup.

**11-03 21:40:55Z — triaged, idle.** The triager posted cmt 6616103112 (passed OUTPUT_REVIEW; codex changed "already fix" to "proposes the fix" and named the missing CI run). Verdict: a partial duplicate. All 7 gates are unchanged on master f1cd35ff8, and #13356 widens all of them. The METAL line then stops at `Std140DataLayout` (hlsl.meta.slang:44-47), which is #8557. Labels and assignee are untouched. The triager's notes are in its `issues/14257.md`. No timer is set: replies arrive as webhooks.
