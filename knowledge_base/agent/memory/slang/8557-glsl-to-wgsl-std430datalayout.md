---
type: chain
title: slang#8557 — Std430DataLayout missing when compiling GLSL to WGSL
description: Maintainer re-triage ask; verdict is close once #13935 merges. Parked on maintainer, one re-chase armed.
tags: [wgsl, glsl, layout, parked]
---

# slang#8557 — Std430DataLayout missing when compiling GLSL to WGSL

- **State (2026-10-28):** OPEN, label WebGPU, assignee jkwak-work. PARKED on the maintainer's
  close decision, which depends on PR #13935 merging.
- **Ask:** jkwak-work (issuecomment-6480475497, 10-28) asked the bot to re-triage, thinking
  #13908 would let the issue close for the given repro.
- **Owner:** slang-triager, thread `gh-issue-shader-slang/slang-8557`. No fixer: the fix is
  already in human PR #13935 (albertrodriguezclo, also the reporter of
  [#13904](13904-wgsl-scalar-cb-layout-reflection.md)).

## Verdict (triager, verified by me 10-28 21:18Z)

Comment issuecomment-6480867757 (nv-slang-bot, 21:15Z):

- #13908 (merged 10-28 18:15Z) alone does **not** fix the repro: master `be7363048` still fails
  E36107 on `Std430DataLayout` (the `hlsl.meta.slang` gate lists only spirv/glsl/llvm).
- Master + #13935 head `5182749de` (adds `[require(wgsl)]`): compiles to `var<storage, read>`,
  accepted by wgpu 0.32 / naga on the L40S; `read_write` variant rejected as a control.
- Gaps the repro doesn't cover, posted on the issue: WGSL drops explicit vertex input locations
  (looks like #9693); `m * v` still hits the glsl-module `operator*` gate (draft #13356);
  Metal still gated.

## Timer

One-shot `rechase-slang-8557-r1` at 2026-11-04 21:00Z (slot r1 reserved via task-hygiene.py).
If #13935 merged and #8557 is still open → triager re-runs the repro and posts a follow-up to
jkwak-work; never closes. Otherwise no re-arm (the weekly parked-chains digest covers it).
