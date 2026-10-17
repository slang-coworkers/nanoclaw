---
type: chain
title: slang#13704 — WGSL forced scalar layout on entry-point uniforms
description: External report (albertrodriguezclo), reproduced and triaged 10-16; parked for the reporter's own patch, no fixer released. Interacts semantically with draft PR #13402.
---

# slang#13704 — forced scalar layout breaks WGSL `var<uniform>` entry-point params

- **Issue:** https://github.com/shader-slang/slang/issues/13704, filed 2026-10-16 14:14Z by `albertrodriguezclo`,
  an external contributor with about 20 open WGSL/Metal PRs. The reporter offered their own patch and a filecheck test.
- **Owner:** slang-triager session `sess-1792160343710-puotr2`, thread `gh-issue-shader-slang/slang-13704`.
- **Triage (10-16 14:47Z):** [comment 6218052329](https://github.com/shader-slang/slang/issues/13704#issuecomment-6218052329).
  I checked it live: posted by nv-slang-bot, label `reproduced`, Type Bug, no assignee. bug / P2, WGPU family only.
  Reflection is std140 with or without the flag; `-force-glsl-scalar-layout` and `-fvk-use-c-layout`
  emit stride-4 arrays that naga rejects. HLSL, CUDA and Metal output is unchanged, and SPIR-V/GLSL are self-consistent.
- **Direction posted:** A (reporter's patch: `DefaultBufferLayoutType` for WGPU at
  `slang-ir-entry-point-uniforms.cpp:559`). B (gate the option ladder on Khronos/LLVM-CPU) is its principled
  form. C (consumer-side std140 override) needs a maintainer decision.
- **#13402 coupling:** a different file, so no textual conflict. Once #13402 lands, `wgsl-spirv*` hits this bug too, so the
  fix must use `isWGPUTarget`, not `== WGSL`. See [13391-wgsl-tint-std140.md](13391-wgsl-tint-std140.md).
- **Adjacent, not filed:** SPIR-V with `-fvk-use-dx-layout` (reflection stride 12, emitted std430/16), and GLSL with
  `-fvk-use-c-layout` (emitted `layout(std140)` push constant, reflection C).
- **Timer:** the triager says it armed a one-shot re-check for 10-21. I can't see a peer group's tasks from Main,
  so this is unverified.
- **Resumes on:** the reporter's PR, a human comment, or an operator release of slang-fixer.
