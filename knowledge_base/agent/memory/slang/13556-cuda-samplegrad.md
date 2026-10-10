---
type: chain
title: "slang#13556: CUDA/PTX has no SampleGrad lowering (tex*Grad)"
description: "External feature request (minco3), opened 2026-10-09. Triaged feature/medium/P2 (cuda core module), reproduced. GO 2026-10-09 on Approach A (cuda case on the plain SampleGrad overloads, mirroring SampleLevel) as a draft PR with Fixes #13556, routed through slang-triager to the fixer."
---

# slang#13556: CUDA/PTX `SampleGrad` via `tex*Grad`

**Origin.** minco3 (external) opened this on 2026-10-09 at 23:11Z. At routing time a live read showed it open, with
0 comments and the body unchanged from the webhook. The ask covers only the plain `SampleGrad(s, loc, gradX, gradY)`
overloads: map each shape to the CUDA `tex1D/2D/3D/Cubemap[Layered]Grad<T>` functions, the same way the existing
`SampleLevel` → `tex*Lod` cuda case works (float3→float4 reshape, layer index as a separate int, float4 gradients
for 3D/cube). The offset and lodClamp overloads are out of scope. A fallback ask: list the gap in `docs/cuda-target.md`.

**Routing (2026-10-09 23:1xZ).** Main session `sess-1791587500117-540s6o` dispatched it to slang-triager on
`gh-issue-shader-slang/slang-13556`.

**Triage (slang-triager, 2026-10-09 23:44Z).** Comment
[6091165670](https://github.com/shader-slang/slang/issues/13556#issuecomment-6091165670). I checked these on GitHub
myself: the comment is from the bot, labels are cuda+reproduced, Type=Feature, and #13555 is the same reporter's
separate silent-drop issue. The rest are the triager's receipts and I have not re-run them. The memo is the
triager's `triage-13556.md`.
- Reproduced at f6238cee3 on every plain-overload shape (cuda and ptx). `-ignore-capabilities` emits an empty entry
  point, which is the #13555 class, so it was not refiled.
- Feature, medium, P2. **Approach A:** a `case cuda:` on both plain overloads and `cuda` in `[require]`, mirroring
  the SampleLevel cuda case (hlsl.meta.slang:2415 / :4133). 3D/cube gradients are widened with make_float4. Add a
  docs line at cuda-target.md:135. The prototype (+156/−2, reverted) compiled every shape through NVRTC 12.6.
- Side note, perf only, not filed: CubeArray float3 Grad keeps 3 `tex.grad.acube` instructions.

**Disposition (orchestrator, 2026-10-09 ~23:50Z).** GO on Approach A as a draft PR with `Fixes #13556`. This uses
the standing proactive authority, drafts only. The reporter is external, nobody is assigned, and there is no
in-flight PR. Scope: plain overloads, docs line, and GPU-free tests. The offset/lodClamp overloads, the #13555 silent
drop, and the perf note stay out.

**Fixer (2026-10-10 00:06Z).** slang-fixer started the build on branch `fix/issue-13556` (worktree `wt-slang-13556`). No PR yet.

**PR (2026-10-10 00:29Z).** Draft [#13559](https://github.com/shader-slang/slang/pull/13559), head 4b3d4b33e0, `Fixes #13556` (checked live). The triager reports 4 files, +433/−3, and 14/14 tests passing. CI is gated: falcor-ci awaits a human approval. slang-reviewer started its 3-reviewer pass at 00:49Z.

**Review progress (slang-reviewer, 2026-10-10 02:02Z).** The reviewer reproduced 14/14 tests passing, 1757/1757 on the subset, and NVRTC compiling all 7 shapes. Clarity review (C) is done. Correctness (A) and Devin are being re-run after subagent loss and a timeout. Finding so far: `docs/target-compatibility.md:210` still names only Load/SampleLevel for the CUDA half restriction. Verdict expected around 02:30Z.
