---
name: project_12276_cuda_ptx_gather_element_type
description: "#12276 CUDA/PTX Texture2D.Gather instantiates tex2Dgather with element type not 4-comp result — PARKED triaged, jkwak self-filed"
metadata: 
  node_type: memory
  type: project
  originSessionId: aae48677-c5d0-4857-9443-e8fff0a2cd74
---

**shader-slang/slang #12276** — [CUDA/PTX] `Texture2D.Gather` uses element type instead of four-component result type.

- **Class:** bug / P2 / medium; subsystem target-emit CUDA-PTX + core-module hlsl.meta.slang.
- **Reproduced** @HEAD `6462d7d2f`, compile-only (NVRTC rejects generated CUDA; no GPU needed). `reproduced` label + Issue Type=Bug set. Verdict posted (comment 5125001490).
- **Root cause:** `hlsl.meta.slang:4374` & `:4423` — CUDA intrinsic `tex2Dgather<$T0>` where `$T0` = operand-0 type → texture *element* type. But `Gather` returns `vector<T.Element,4>`. Scalar template result assigned into float4 → NVRTC "no suitable constructor to convert from float to float4." Fails float/float2/float3/int/uint; `float4`/`int4` control compiles fine (emits `tex2Dgather<float4>` → tld4). `GatherRed`/`GatherGreen` affected too.
- **Recommended fix (triager, verified by construction):** one-liner `$T0`→`$TR` at both sites (`$TR` = call return type, existing marker; precedent `bitcast $0 to $TR`). + regression test for scalar/2-/3-comp paths.
- **Routing:** was PARK-at-triaged (jkwak self-filed+assigned). **RESUMED 2026-07-30** — jkwak-work commented "@nv-slang-bot , make a PR" (comment 5126147168) → dispatched to slang-fixer, drafts-only.
- **PR #12288** — https://github.com/shader-slang/slang/pull/12288 — branch `fix/issue-12276` @ `7d98d18e24`, base master `7c58a326b1`. Fix = `tex2Dgather<$T0>`→`<$TR>` at hlsl.meta.slang:4374 (no-offset) & :4423 (offset). `$TR`=return type=`vector<T.Element,4>`. Test `tests/hlsl-intrinsic/texture-2d-gather-element-type.slang` (CUDA FileCheck + PTX/NVRTC compile-check): RED on unfixed base 0/2, GREEN after fix 2/2. Broader hlsl-intrinsic 626/627 (sole fail scalar-bf16.slang(vk) pre-existing on master). 3 codex stages approve; reviewer in-tree precedent hlsl.meta.slang:8034 confirms principled. Label `pr: non-breaking`.
- **✅ MERGED 2026-07-30** by maintainer jkwak-work. Approved by jkwak-work ("Looks good to me") + fknfilewalker ("LGTM") at HEAD `7d98d18e24`. jkwak flipped it ready-for-review himself (isDraft:false) — NOT a drafts-only breach (maintainer's own action on own PR; #12265 precedent). Post-approval macOS-release `ci_failed` = SPIRV-Headers::SPIRV-Headers CMake-configure infra flake (classified by fixer via `gh run rerun --failed`; every other build incl macOS-debug green) — did not block merge. Worktree `wt-slang-12276` + sentinel reaped. Issue left open for human close (non-auto-close policy; merge's `Fixes #12276` auto-closes anyway). **CHAIN CLOSED / TERMINAL** — re-engage only on fresh substantive human comment (e.g. reporter says "doesn't resolve").
- **Not a dup** of CUDA/PTX siblings #12273 (callable-w/output crash), #12274 (PTX typed-Buffer empty kernel).
- Env: v2026.14 Windows x86_64 release; NVRTC 13.2. Reported/triaged 2026-07-30.
