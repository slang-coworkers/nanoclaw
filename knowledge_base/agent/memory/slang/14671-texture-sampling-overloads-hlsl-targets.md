---
type: issue-chain
title: "slang#14671 — Align texture sampling overloads with HLSL and target capabilities"
description: Maintainer-filed (tangent-vector 11-20) cube/cube-array invalid offset overloads + missing clamp/status forms; triaged P2 bug, fixer live on approach A
tags: [slang, chain, hlsl.meta.slang, texture, capability]
---

# slang#14671 — Align texture sampling overloads with HLSL and target capabilities

Issue: https://github.com/shader-slang/slang/issues/14671 (HUMAN-filed 11-20 by tangent-vector,
core team; no labels at filing). R6 dispatch: 👀 (reaction 674969886) + triager on canonical
thread `gh-issue-shader-slang/slang-14671` (Main sess imw9p6; first turn died on 429 retry,
zero outbound rows — no duplication risk).

## Triage (slang-triager, sess hptrhd, [Triage] 20:02Z)

- bug (+ feature gap) / high / frontend (core-module intrinsics) + target-emit / **P2**.
- Reproduced on fresh master `410071448`: valid HLSL `cube.SampleGrad(..., minLod)` mis-selects
  the `constexpr int3` offset overload → E40012; cube `ConstOffset` in SPIR-V is exit-0 INVALID
  (silent bad codegen, not a diagnostic).
- Also: WGSL offset shape check is a tautology (hlsl.meta.slang:1399); no 3D-Dref shape check;
  `OpCapability MinLod` injected unconditionally (no capability gating, capdef:775-785,1258-1268);
  two short comparison-status forms (`SampleCmpBias`/`SampleCmpGrad` `(offset, out uint status)`)
  rebind the last arg as DXC's `clamp` — per-target semantic divergence.
- Labels applied: `reproduced` + Issue Type `Bug`.
- Solution approaches: **A (recommended)** core-module alignment — extend cube static_assert
  precedent to all offset overloads + complete clamp/status overload table per the issue's table +
  real `[require]` gates (spvMinLod / spvSparseResidency) + WGSL/3D-Dref diagnostics; B =
  emission-time diagnosis only (leaves valid HLSL rejected); C = full capability overhaul
  (programmable offsets deferred per the issue itself).

## Chain state

- **Fixer LIVE** (sess iwvxmu on canonical thread, from 20:03Z) with triager's phase-1 brief
  (approach A). Files: hlsl.meta.slang:2987-4458 (+combined :1421-2677, WGSL helper :1399),
  slang-capabilities.capdef, tests/hlsl-intrinsic/texture/.
- **[Fix Report] 02:45Z 11-21 — TERMINAL our side, resting on review: draft PR #14683 OPEN**
  @ head `fcc1f1d` (5 commits, +1740/−145, 10 files; label `pr: breaking change`; pr-mapping →
  fixer sess iwvxmu). Scope shipped: cube/cube-array offset overloads → static_assert (plain +
  combined), 3D-Dref diagnosed, WGSL offset check real, missing table forms added (cube (C)/(C,S)/(S),
  noncube (O,C)/(O,C,S) on CmpBias/CmpGrad), combined-sampler SampleBias clamp-drop fixed, short
  (O,S) comparison forms scoped to spirv, capdef GL_ARB_sparse_texture_clamp→spvMinLod +
  cpp_glsl_hlsl_metal alias, SampleCmpLevel SM 6.7 via __requireCapability (E41012
  warn-and-upgrade). Tests: repro PASS, hlsl-intrinsic 744/744, full suite green (3 unrelated
  pre-existing fp8-cuda). CODE_REVIEW r2 approve. Reviewer sess 4yt8fk live since 02:23Z;
  CI run 44852921082; explanation cmt 7055849490, issue status cmt 7056094166.
- **Round 1 applied 05:46Z 11-21, head amended 05:54Z to `0034002ba`** (test-only +commit:
  GLSL runs now filecheck full argument lists with distinct per-call literals — late r1 ask;
  texture dir 53/53). Earlier delta `e8ab32291` (+120/−31: GLSL clamp-before-bias operand
  order fixed at 4 SampleBias sites — confirmed silent-mis-sampling bug, registry-verified;
  naming/comments/tests per r1). Peer r1 = REQUEST_CHANGES (1 bug + 7 gaps + 13 advisory) all
  addressed/declined-with-reason; CODE_REVIEW r3 re-approve; hlsl-intrinsic 750/750. Known
  divergences documented: integer minLOD on cube (clear diagnostic; maintainer API decision),
  isShadow exposure (pre-existing).
- **✅ TERMINAL OUR SIDE 07:44Z 11-21 — review chain closed, handed to the maintainer. Final
  head `82500e64a`** (9 commits over master, 14 files, +1973/−172; comment-only delta after
  e7052cf34). slang-reviewer round 2 (last) = **APPROVE_WITH_NITS** — 0 real bugs (round-2 GLSL
  claim refuted vs Khronos registry), 6 gaps + 6 clarity nits all applied + reviewer-verified;
  CODE_REVIEW approves all deltas. Tests at e7052cf34: hlsl-intrinsic 751/751, texture 54/54,
  wgsl 8/8; CI run 44880186141 pending at the final head. Draft PR #14683 stays DRAFT —
  ready-flip pending the weekly undraft list (no per-PR operator ask). Resumable artifact =
  PR #14683 explanation cmt 7055849490 (updated at each head), which lists the maintainer's
  open rulings.
- **Resting on HUMAN action (maintainer = issue author tangent-vector):** (1) cube-array
  `SampleCmpGrad` DXIL coverage; (2) short (offset, status) form migration; (3) hard error vs
  E41012 warn-and-upgrade (#9210); (4) integer minLOD on cube API decision; (5) isShadow
  exposure (pre-existing architecture); (6) marks the draft ready when satisfied. Webhooks
  route to fixer sess iwvxmu via pr-mapping — resume on PR webhook / human comment only.
- **Maintainer rulings still open:** cube-array `SampleCmpGrad` DXIL coverage; short-form
  migration; hard-error-vs-warn-upgrade (#9210). Webhooks route to the fixer via pr-mapping —
  resume on PR webhook / human comment only.
- Open sub-decisions flagged for the draft-PR review (maintainer/issue-author decides):
  cube-array `SampleCmpGrad` DXIL coverage; short status-form migration path; **sm_6_6-style
  requests on __requireCapability'd forms get E41012 warning + implicit profile upgrade (Slang's
  intended semantics — dedicated test profile-implicitly-upgraded.slang), NOT a hard error —
  policy ruling on warning-upgrade vs hard error surfaced in the PR (related #9210).**
- Full triage memo (verbatim): [raw/triage-14671.md](raw/triage-14671.md). Issue 5-bullet
  triage outcome posted by the triager as comment 7049387168 (20:0xZ).
- Related: capability-system work #9210.

## Rules

- Do not re-dispatch #14671 webhooks — owner chain is live; route to the running sessions.
- Fixer's phase-1 scope = approach A; programmable offsets are follow-up, not in scope.
