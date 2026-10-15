---
type: chain
title: "slang#13556: CUDA/PTX has no SampleGrad lowering (tex*Grad)"
description: "MERGED 2026-10-15 by jkwak-work (PR #13559, f2b163c082); #13556 auto-closed as completed. Only the combined Sampler*.SampleGrad lowers to CUDA tex*Grad; separate-sampler SampleGrad stays E36107 per the maintainer. Possible unfiled follow-up: separate-sampler Sample/SampleLevel on CUDA also drop s."
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

**Resolution (slang-triager, 2026-10-10 05:09Z).** Draft #13559 head a4e1ee4811, 6 files +457/−4 (verified live). slang-reviewer gave APPROVE_WITH_NITS twice. Reviewer A did not finish and Devin timed out. Requested reviewer: kaizhangNV. CI run 38025947083 at a4e1ee4 is `waiting` on falcor-ci human approval (verified live). Re-chase `rechase-13556-samplegrad-d1aa` (2026-10-12T05:30Z).

**Re-chase (orchestrator, 2026-10-12 05:30Z, task d1aa).** Nothing has changed since 2026-10-10 05:03Z, verified live. The PR is open, draft, head a4e1ee4811. It has 0 reviews, 0 inline comments, and 4 comments, all from bots. Issue #13556 has 1 comment (the bot triage) and is now **assigned to kaizhangNV**, who is also the requested reviewer. CI run 38025947083 (`CI`, workflow_dispatch) is still `waiting` at **`falcor-build-approval-gate`**. In that run `wait-for-human-priority`=failure, which is the priority yield and not red. The `pull_request` CI run 38025951238 was skipped and the earlier head's run 38017831087 was cancelled. The operator was told once on orchestrator-dashboard (thread gh-issue-shader-slang/slang-13556, msg 3). The follow-up `rechase-13556-samplegrad-9d2a` (2026-10-15T05:30Z) is **silent unless something changes**.

**Maintainer review (2026-10-12 to 10-14), verified live.** On 10-12 16:39Z jkwak-work took over the issue
assignment from kaizhangNV and set a milestone. On 10-14 15:49Z jkwak-work **flipped #13559 out of draft** and
requested review. That was a human doing it, not us. The same minute they left review thread
[discussion_r4273039653](https://github.com/shader-slang/slang/pull/13559#discussion_r4273039653): *"I don't think
this is acceptable. We cannot just ignore the sampler when the user expect it to be used explicitly. I think we
should remove `cuda_` from the `require` line of this function"* (the separate-sampler `SampleGrad(SamplerState s, …)`).
The fixer agreed and pushed **db81dbdad0**. Now only the combined `Sampler*.SampleGrad` lowers to `tex*Grad`; the
separate-sampler form is back to master's form, stays E36107, and has a test pinning that. The PR was retitled
"Lower combined-sampler SampleGrad to CUDA tex*Grad built-ins", +336/−4. The fixer asked jkwak-work on the thread
(1) whether to remove the combined form too, and (2) whether the existing separate-sampler `Sample`/`SampleLevel`
CUDA cases, which also drop `s`, need a follow-up.
- ⚠️ **The PR body still says `Fixes #13556`.** The issue asked for the separate-sampler overload, and that one stays
  an error, so a merge would auto-close #13556 with that half deliberately not done. The triager is leaving that to the
  maintainer, and so am I. jkwak-work is the assignee and the reviewer, and the PR body's root-cause line states the
  narrowing openly. I'm putting it in front of the operator rather than raising it on GitHub.
- The issue trail comment 6091165670 was edited at 16:25Z to the revised scope.
- CI run 38596364751 (pull_request, db81dbd) is `waiting`, with real builds running and none failed (per the triager).
- I rewrote `rechase-13556-samplegrad-9d2a` (2026-10-15T05:30Z) for the non-draft state.

**CI and thread (2026-10-15 01:20Z, verified live).** jkwak-work resolved review thread 4273039653 with no comment. Reviews: only jkwak-work COMMENTED, on the old head a4e1ee4; no approval. CI run 38596364751 at db81dbd: 47 jobs passed, and `falcor-build-approval-gate` is waiting for a human. mergeable_state is blocked. The 3 maintainer questions are still open (combined form, separate-sampler Sample/SampleLevel, Fixes vs Part of). I moved the re-chase `rechase-13556-samplegrad-9d2a` to 2026-10-17T05:30Z.

**MERGED (2026-10-15, verified live).** jkwak-work merged #13559 at 02:42:42Z (merge commit f2b163c082, head
db81dbdad0). `Fixes` auto-closed #13556 as completed at 02:42:44Z. What shipped: combined `Sampler*.SampleGrad` lowers
to `tex*Grad<T>`. Separate-sampler, offset and lodClamp `SampleGrad` stay E36107 on CUDA. I cancelled
`rechase-13556-samplegrad-9d2a`. **Unfiled possible follow-up** (the operator's or maintainer's call; nobody asked
for it): the existing separate-sampler `Sample`/`SampleLevel` CUDA cases also drop `s`, which is the same thing
jkwak-work rejected for SampleGrad.

**Durable lesson.** A maintainer can narrow the scope in review and still merge with `Fixes`. The issue then closes
with part of the ask deliberately undone. We left that call to the maintainer and did not raise it on GitHub; they
merged as-is.
