---
type: chain
title: "#14684 Reduce2x2 8x8 half coopmat shape fails Vulkan validation on SM 8.9"
description: "Triaged+reproduced; parked on operator fixer go/no-go. Emission emits an unrepresentable 8x8 half cooperative-matrix result type."
tags: [slang, chain, coopmat, vulkan, parked-operator]
---

# #14684 — Reduce2x2 8x8 half coopmat shape (parked: operator decision)

- Issue: https://github.com/shader-slang/slang/issues/14684 (filed 11-21 by jkwak-work; labels CI Improvement, Vulkan)
- Thread: `gh-issue-shader-slang/slang-14684` · triager q67saf (triage done) · **fixer f3yh9m LIVE** (triager dispatched 02:57Z, before Main's hold arrived — policy drift noted; build started 03:05Z).
- Disposition: **advisory:operator-confirm (chain LIVE)** — original fixer go/no-go ask timed out; narrowed ask on dashboard (msg 37): let the live fixer run to draft PR (recommended; test-infra only, human merge gate intact) vs stand down. Silent default = proceed. One-shot recheck `recheck-14684-fixer-deci-de5d` fires 11-22 03:30Z.

## Facts (triager report 02:54Z, receipts verified by Main)

- Repro'd on our L40S (SM 8.9, same as L4): `VUID-RuntimeSpirv-cooperativeMatrixFlexibleDimensions-10165` at `vkCreateComputePipelines` for `TEST_MODE=3` (`Reduce2x2`), layers on. Modes 0/1/2 pass; mode 3 passes layers-off.
- Current slangc emits `%30 = OpTypeCooperativeMatrixKHR %half %int_3 %int_8 %int_8 %int_2` + `OpCooperativeMatrixReduceEXT ... 2x2` unconditionally.
- Flexible-dims table for half/subgroup: MGran=NGran=KGran=16 → 8x8 unrepresentable on SM 8.9 → real emission/test problem, not a validation-layer false positive.
- Triager comment posted: https://github.com/shader-slang/slang/issues/14684#issuecomment-7056193274 (+ `reproduced` label).
- Discrepancy: issue claims `tests/cooperative-matrix/reduce.slang.3 (vk)` sits in `tests/expected-failure-github.txt`, but no reduce/coop entry exists in ANY expected-failure file on master (Main verified vs origin/master 0a87e89+, 11-21); master CI green — the failing debug-layers job config is not on master.
- Trap: no Khronos layer installed system-wide; triager wired a Chromium-build layer via VK_LAYER_PATH. Without the layer actually loading, slang-rhi silently creates the device without it and the run "passes" — layers-on results are only meaningful with the layer loaded.

## Decision fork (operator)

1. Fixer compiler-side: gate/map Reduce2x2 result emission against supported coopmat shapes + adjust test.
2. Fixer test-side only: skip/resize mode 3 when the device lacks the shape. ← triager path A / implemented
3. Leave to humans (jkwak-work owns CI).
4. Ask a maintainer on the issue, park until they answer.

## Outcome (11-21)

- Operator silent on both asks (silent default = proceed, per msg 37).
- **Fix landed: draft PR #14685** (`nv-slang-bot`, branch `fix/issue-14684`, ~04:40Z; pr-mapping → fixer f3yh9m, Main-verified). Harness gate only: new `-require-coopmat-shape` render-test option querying `IDevice::isCooperativeMatrixSupported`; no compiler / no slang-rhi change. `.3` skips cleanly; `.0`–`.2` pass with vk layers on and off; positive path (16x16x16) still runs; malformed values fail loudly; fp8-cuda* failures A/B-verified pre-existing at master, untouched. Critique stages approve.
- Reviewer verdict in flight; PR follow-up webhook-driven. Ready-flip goes on the weekly operator list after review approves.

## Fix Report (11-21 06:39Z; Main-verified head `7c910beff`)

- **FIX COMPLETE** — review APPROVE_WITH_NITS applied + re-verified; draft PR #14685 awaits human review (CI re-triggered; follow-up webhook-driven).
- 7 files, +283/−115, 4 commits: render-test gate + `-require-coopmat-shape` option; reduce.slang tags; option parser extracted to header (canonical scalar-type spellings via `findScalarType`, uint32 range check, 4 unit tests); both declared shapes gated.
- Tests: repro pre-fix fails VUID-10165 (layers on); post-fix `.3` skips cleanly (`SLANG_E_NOT_AVAILABLE`), `.0`–`.2` pass layers on AND off; positive gate path verified (device query, not a GPU list); malformed values fail loudly (diag 1007); unit suite 722/722. Issue premise doesn't hold — no expected-failure entry to remove at master.
- Review: 0 bugs / 3 gaps / 2 questions, all applied. One decline with justification (recorded follow-up candidate): mixed-type grammar extension + gating sibling coopmat tests — out of scope; spin up separately only on demand.
- fp8-cuda* coopmat failures A/B-verified pre-existing at clean master, untouched.

## Follow-up #14688 (11-21, triager-filed)

- [slang#14688](https://github.com/shader-slang/slang/issues/14688) (nv-slang-bot, Type=Feature, CI Improvement+Vulkan, P3): sibling coopmat tests (`mat-mul-add.slang`, `map-element-single.slang`, `struct.slang`) fail instead of skip on devices lacking their shapes — same VUID-10165 class #14684 proved real; latent (no current CI fleet trip). Uniform-grammar gates ready for two uniform-shape files once #14685 lands; `mat-mul-add` needs a per-slot type grammar extension parked for a maintainer on the issue.
- Decisions: (1) operator go/no-go for a fixer chain on the actionable part once #14685 merges; (2) maintainer sign-off on the grammar extension. Both blocked on #14685 (draft) merging; triager armed a one-shot re-check 2026-11-28. Its `issue_opened` webhook is our own filing's self-echo — disposition filed-only, no re-triage.
