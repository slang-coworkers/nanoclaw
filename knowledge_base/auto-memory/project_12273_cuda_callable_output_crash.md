---
name: project_12273_cuda_callable_output_crash
description: "#12273 CUDA callable shader w/ output value crashes slangc (AV, no diag); triaged→fixer, draft-gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7064d472-3144-4bb6-abea-e13367d792ef
---

# #12273 — [CUDA] Callable shaders with output values crash slangc

**Filed:** 2026-07-29 by **jkwak-work** (maintainer). `github.issue_opened` webhook → Main → slang-triager → slang-fixer.

**Bug:** `[shader("callable")]` entry with an output value on `-target cuda` crashes slangc — `0xC0000005 EXCEPTION_ACCESS_VIOLATION`, **no diagnostic**. All 3 output forms crash identically: `inout` param, `out` param, non-void return. `in`-only correctly gives E39018. v2026.14 Windows release; repro'd CPU-only @HEAD `6462d7d2f`.

**Root cause (triager, verified in source):** `CUDALayoutRulesFamilyImpl::getCallablePayloadParameterRules()` returns `nullptr` (slang-type-layout.cpp:2553); parameter-binding (slang-parameter-binding.cpp:2430-2435) passes null into type-layout creation → deref at slang-type-layout.cpp:5476 before any diagnostic. Return-value form shares the same output path. **Differential:** CUDA + Metal crash; SPIR-V/HLSL/GLSL fine; WGSL cleanly aborts.

**Class:** bug(crash)/high/**P2**. Labels: `reproduced`, Issue Type=Bug set. Verdict posted (comment 5124599262).

**Recommended fix = Approach A:** diagnose callable-with-output when target RT rules are null (issue floor: "compile OR diagnose, don't crash"), optionally hardened w/ release-assert. Full CUDA/OptiX callable codegen is feature **#12182** (jkwak) — OUT OF SCOPE; NOT a dup.

## Fix (2026-07-30)

**FIXED: crash → diagnostic.** Fixer implemented Approach A + B hardening. **Draft PR #12280** — https://github.com/shader-slang/slang/pull/12280 — VERIFIED OPEN (base master, head `8694fcb278`, author nv-slang-bot, `Closes #12273`, 4 files +87/−12).

**Fix shape:** guards all 3 RT param branches (RayPayload/CallablePayload/HitAttributes) in `processEntryPointVaryingParameter` against null layout rules → new target-scoped diagnostic **E39032** + fall-through (mirrors E39017/E39018), plus `SLANG_RELEASE_ASSERT(rules)` backstop in `createTypeLayoutWith`. **Scope expanded past triage:** Metal's RayPayload/Callable/HitAttr rules are ALL null too → covers Metal closesthit/anyhit payloads. Real CUDA/OptiX callable codegen still left to feature #12182.

**Tests:** repro PASS — all 3 callable-output forms + Metal closesthit/anyhit now emit E39032 (were SIGSEGV) on cuda+metal; real-rules paths (cuda/spirv/hlsl/glsl) still compile; cuda in-only still E39018. New test `tests/diagnostics/execution-model/callable-output-unsupported-target.slang` (2/2 cuda+metal). Regression: diagnostics 708/708, vkray 22/22, execution-model 21/21. 5 codex gates APPROVE. Issue verdict refreshed in place (comment 5124599262 → "fix in draft PR #12280, held pending review").

**Status:** DRAFT held (drafts-only guardrail; OP-gated to mark ready/merge). Review-routing gap: fixer requested slang-reviewer review; triager has no reviewer edge → **Main owns routing the [Fix Review Request] to slang-reviewer and relaying verdict back to fixer** (2026-07-30). Review IN FLIGHT: slang-reviewer dispatched A(correctness)/B(Devin)/C(clarity) + own source read APPROVE-lean (all 4 focus areas clean); armed ~50-min waiter @01:58 UTC → will report verdict to Main file-only (COMMENT-state, NOT a PR merge). Don't false-flag as stalled before ~02:48 UTC. Close-out trigger = PR #12280 merges → triager re-reads merged diff, marks issue fixed+merged, forwards final resolution. Canonical thread `gh-issue-shader-slang/slang-12273`.

Related: [[project_12182_cuda_optix_callable_rdc_linkage]] (adjacent CUDA/OptiX callable feature, jkwak).
