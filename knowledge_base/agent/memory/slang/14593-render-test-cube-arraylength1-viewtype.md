---
type: chain
title: slang#14593 — render-test TextureCube arrayLength=1 classified as plain cube (VUID 07752, via-GLSL)
description: Human-filed test-harness bug (jkwak-work, self-assigned) 11-18; compiler verified correct, fixer chain on canonical thread gh-issue-shader-slang/slang-14593
---

# slang#14593 — Vulkan validation error for a cube array texture with -emit-spirv-via-glsl

Human (jkwak-work, **self-assigned** — not a stand-down, R6) filed 11-18 15:0xZ.
Canonical thread `gh-issue-shader-slang/slang-14593`.
Webhook dispatched to slang-triager 15:08Z (👀 posted; my session 8mw3l7, triager sess sjc5rb).

## Triage (15:14Z — all Main-verified against live state)

- **Classification:** bug (test-harness) / low / P2 / tools/render-test + vulkan binding; Type=Bug set on the issue.
- **Verdict:** compiler CORRECT on both direct and via-GLSL paths (`OpTypeImage %float Cube [d] 1 0 1 Unknown`
  verified locally). Defect: render-test `isArray = inputDesc.arrayLength > 1`
  (tools/render-test/shader-renderer-util.cpp:78) classifies `TextureCube(size=16, arrayLength=1)`
  as plain cube → slang-rhi creates VK_IMAGE_VIEW_TYPE_CUBE (vk-texture.cpp:190-216) → VUID 07752.
  Path-independent (disabled direct `-vk` leg would hit it too); PR #14561's target synthesis
  merely newly exposes it. dx12 passes (no cross-validation of SRV dimension).
  `reproduced` label NOT applied: no Khronos validation layer in the triager container
  (SLANG_RUN_SPIRV_VALIDATION would not cover via-GLSL anyway — shared-wiki rule);
  SPIR-V Arrayed=1 + view-type mapping code-traced instead.
- **Recommended fix (approach A):** track whether `arrayLength` was explicitly provided in
  TEST_INPUT parsing (tools/render-test/shader-input-layout.cpp:102-106) and classify cube
  with explicit arrayLength as TextureCubeArray → VK_IMAGE_VIEW_TYPE_CUBE_ARRAY / D3D12
  TEXTURECUBEARRAY SRV (NumCubes=1). Alternatives: B = new `TextureCubeArray` TEST_INPUT kind;
  C = stopgap arrayLength=2 in the two test inputs (leaves the trap armed).
- Triage 5-bullet POSTED (issuecomment 6982725214, 15:15:33Z — verified live; my earlier
  `--jq` read raced it and showed 0 comments, re-fetch confirmed it).

## Chain state

- **TERMINAL on our side 11-18 17:55Z: draft PR #14596** @ head `b788d56e6` (7 commits,
  +84/−4, `pr: non-breaking`, pr-mapping wired to fixer sess yf3qob; Main-verified head/commits).
  Fix: one-line `isArray = arrayLength > 0` (shader-renderer-util.cpp:78) + contract comment +
  arrayLength field contract in shader-input-layout.h. Tests: 2 new (texture-cube-array-length-1,
  texture-2d-array-length-1, vk×2 legs each; dx11/dx12/cuda legs) + texture-get-dimensions.slang
  direct-vk leg re-enabled. Review APPROVE_WITH_NITS after 2 rounds (R1 REQUEST_CHANGES gaps
  closed — the 2D test proven decisive by revert drill; R2 nits applied; one justified decline:
  1D/MS companion test). Pre-fix repro: VUID 07752 fired on BOTH vk paths under Khronos
  validation (L40S, log /workspace/agent/reports/repro-14593-prefail.log); post-fix all
  locally-runnable tests green. `reproduced` label on the issue.
  **Pending external: Windows CI (dx11/dx12 legs) — bot CI run in the priority-yield gate;
  retry-yielded-bot-ci reruns it.** Awaiting human review/merge; ready-flip → weekly undraft
  list (not P0/P1); resume on human comment/CI webhook only.
  Explanation: /workspace/agent/reports/pr-explanations/2026-11-18-shader-slang-pr14596-cube-array-length-1-r2.html
- **Watch:** author self-assigned and works on related PR #14561 — duplication risk if he
  fixes it himself (like #14557/#14560). On a human fix PR: stand our draft down per
  the leave-open/shepherd-picks disposition.
- Related: #4797 (same VUID, closed fix-unknown, different trigger). Exposed by #14561
  target synthesis (its rebase note also on the #14576 record).
- **Review round 1 applied 16:59Z**: combined review (A/B/C) REQUEST_CHANGES (0 bugs, 2 gaps,
  4 clarity) — all applied at head `f23ee0a67` (two new commits, no force-push; Main-verified
  head). New test tests/compute/texture-2d-array-length-1.slang pins the shape-general
  classification (Texture2D arrayLength=1 → Texture2DArray, vk×2 green); cube test gained
  dx12 + cuda legs (cuda 3/3 local). Round-2 [Fix Review Request] dispatched (last round —
  two max). Two declines justified: issue-URLs in test headers, optional isArray rename.
  `reproduced` label added to the issue after the live pre-fix VUID repro.
  - **Side-find FILED 17:13Z: shader-slang/slang-rhi#976** (routed 17:0xZ via triager thread
    `triage-14593-sidefind-rhi-cpu-arraylength`; Main-verified live). Stronger than the latent
    flag: triager's headless harness (rhi main `4b4067d`) shows TextureCubeArray arrayLength=1
    always reads face/element 0 (10/12 wrong), AND at arrayLength>=2 the cube index is never
    honored at any length — whole cube-array CPU path broken (cpu-texture.cpp:328/:380).
    1D/2D arrays @1 misclassified but coincidentally correct. Distinct from open rhi#960.
    Latent in-tree (no slang-rhi cube tests; CPU not in test masks). **FILED-ONLY — fixer
    chain gates on operator/maintainer pickup** (filing policy). NOT part of PR #14596.
  - rhi#976 `issue_opened` webhook (17:12Z) hit a parallel Main session (syo52i), which
    dispositioned it FILED-ONLY (no triage dispatch, no 👀 — own Terminal filing, #14548
    rule; verified no phantom triager session on the thread). Operator roll-up = 8mw3l7's
    job (triager's [Report] landed on it 17:13Z; still mid-turn at 17:25Z with no dashboard
    row — do NOT duplicate-report; check dashboard for the roll-up before adding one).
- Post-merge watch: #14576's ready-flip PR #14580 expects maintainer PR #14561 to drop its
  `targets=all-vk-glsl` exclusion — this fix is what makes the glsl target pass.

History: triage 11-18 15:14Z; record created same day.
