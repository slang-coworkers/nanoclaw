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
- **2026-10-19 21:34Z:** the reporter commented ([6277855736](https://github.com/shader-slang/slang/issues/13704#issuecomment-6277855736)).
  Their PR is [#13706](https://github.com/shader-slang/slang/pull/13706) (`fix/wgsl-entry-point-uniforms-std140`, ready, `Fixes #13704`,
  opened 10-16 14:54Z). I read the diff live: it adds an `isWGPUTarget(m_options.targetReq)` → `DefaultBufferLayoutType` branch
  ahead of the scalar/C ladder in `slang-ir-entry-point-uniforms.cpp:559`, plus a test with wgsl rows for default,
  `-force-glsl-scalar-layout` and `-fvk-use-c-layout` (c3a411912). Review is requested from dshreiner-nv. The issue was
  assigned to jkwak-work 10-16 14:54Z and milestoned 10-19. CI at that time: 5 success, 3 pending. They left the
  explicit-layout question (DX layout, `ConstantBuffer<T, ScalarDataLayout>`) to the maintainers. I forwarded the comment to the
  triager on the canonical thread, without a post marker (no bot mention).
- **2026-10-19 21:39Z:** the triager reported that it moved re-check `t-158372` to 2026-10-26 14:00Z. The re-check now only watches whether #13706 merges or closes. On merge: final report to me, no post. On close: report, and a fixer only if a maintainer asks. Still open: one more re-check. This is the triager's claim; I can't see its tasks from Main.
- **2026-10-21 23:44Z:** the assignee jkwak-work @-mentioned the bot ([6329079064](https://github.com/shader-slang/slang/issues/13704#issuecomment-6329079064)).
  They question the direction: scalar layout means 4-byte alignment, so should `-force-glsl-scalar-layout` be an
  error on WGSL? And is `@align(16)` in the emitted std140 wrapper the problem (`@align(4)` instead)? They asked
  for help understanding the issue. I routed it to the triager on the canonical thread with `<github-post-authorized />`.
  #13706 is still open at `c3a4119126`, with no human review, and its direction now depends on the answer.
- **2026-10-21 23:57Z:** the triager answered ([6329245722](https://github.com/shader-slang/slang/issues/13704#issuecomment-6329245722); I checked it live, nv-slang-bot, 5704 chars).
  - `@align(4)` can't fix it: WGSL §14.4.5 requires a 16-byte array *stride* in uniform memory, and WGSL has no stride attribute. naga rejects every variant.
  - Making the flag an error would break SlangPy/WebGPU, because SGL sets it for every device. Other targets ignore it already.
  - New: the `uniform_buffer_standard_layout` extension (Dawn has it, naga doesn't) makes stride 4 legal.
  - Options: A ignore (what #13706 does), B a warning, C honour it via the extension. It recommended A, with B optional, and left the decision to jkwak-work.
  - `t-158372` (10-26 14:00Z) now also watches for a jkwak-work reply (the triager's claim).
- **2026-10-22 18:36Z:** jkwak-work decided **A** ([6348373622](https://github.com/shader-slang/slang/issues/13704#issuecomment-6348373622)): on WGSL the flag is ignored, which matches the other targets, and the docs scope the flag to GLSL/SPIR-V. That is what #13706 does. The comment has no bot mention, so I routed it to the triager with no post marker. #13706 is still open at `c3a4119126`, with no human review.
- **Resumes on:** #13706 merging or closing, a maintainer comment, or the operator's file-the-adjacent-bugs decision (asked 10-16, unanswered).
