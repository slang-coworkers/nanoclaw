---
type: project
name: project_13774_ser_fused_reorder_execute
description: "slang#13774 (albertrodriguezclo, external, 10-20 13:18Z): SER fused ops (OpHitObject*ReorderExecute*EXT) unreachable from HitObject code. Docs already promise ReorderExecute/TraceReorderExecute/TraceMotionReorderExecute; hlsl.meta.slang never got them. Triaged P2 feature, handed to slang-fixer (Approach A) 13:43Z."
---

# slang#13774 — SER fused reorder-execute ops have no HitObject spelling

**10-20 13:18Z, `issue_opened`**, from an external reporter. Live read at dispatch showed it open and unassigned, with no labels
and 0 comments. I routed it to `slang-triager` on `gh-issue-shader-slang/slang-13774`.

**Triage (13:42Z):** feature request, P2, low severity, core module plus SPIR-V. The triager found the docs already list the API.
I checked this against `origin/master` @7251cc6:
- `docs/shader-execution-reordering.md:50-54` has a heading "Fused Functions (Vulkan EXT only)". It lists `ReorderExecute`,
  `TraceReorderExecute` and `TraceMotionReorderExecute`, with `<payload_t> inout` signatures at :916-1010.
- `hlsl.meta.slang` has 0 hits for `ReorderExecute`. Only the GLSL half (int payload location) exists, at
  `glsl.meta.slang:6982+`.
- `slang-ir-ray-tracing-legalize.cpp:146-159` already maps the payload index of all three fused opcodes.

The chosen design is Approach A: implement the documented names. The issue gets the fused op on SPIR-V and the three-call
sequence on other targets. One scope point is left for the maintainer to settle in PR review: the docs say "Vulkan EXT only",
but the reporter wants a portable fallback.

**GitHub artifacts:** label `reproduced`, Type=Feature, and a bot triage comment at 13:43:56Z (issuecomment-6292301699).
**Fixer:** session `sess-1792503789030-iptw3s` on the triager's edge (`epsn3s`), created 13:43Z, worktree `wt-slang-13774`.
There is exactly one fixer session, so it is not a duplicate. I did not dispatch the fixer myself
([[feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer]]).

**Separate bug the triager found, not filed:** with `-capability spvShaderInvocationReorderNV`, the GLSL fused functions emit
the EXT op on `OpTypeHitObjectNV`, which fails spirv-val. That is the triager's finding; I have not reproduced it.

**Related PR by the same reporter: #13763** (open, 10-20 12:42Z). It fixes the default-capability E41011 error in the GLSL
`hitObject*EXT` wrappers in `glsl.meta.slang`, including both `hitObjectReorderExecuteEXT` and `hitObjectTraceReorderExecuteEXT`.
It does not duplicate #13774, which is the HLSL `HitObject` surface. But the fixer's brief names those GLSL lines as its
template, so #13763 is a conflict risk. I relayed this through the triager (13:45Z). The triager forwarded it to the fixer at 13:46Z (msg 21). I verified the #13763
diff myself: it changes `case spvShaderInvocationReorderEXT:` to `case spirv:` 11 times and leaves the `[require]` lines alone.
The fixer was told to use the same case shape in hlsl (NV case first, then `case spirv:`) and not to edit the GLSL lines.

**10-20 15:33Z, reporter comment ([issuecomment-6294635438](https://github.com/shader-slang/slang/issues/13774#issuecomment-6294635438), author_association NONE):**
the reporter wants the sequence fallback on other SER targets ("with a capability error we'd have to wrap every call in a
`__target_switch` again") and says "The documented names are fine." This agrees with the brief's recommendation, but it is
the reporter's preference, not a maintainer decision: the docs' "Vulkan EXT only" note is still a call for PR review.
I routed it to the triager (issue → triager). At 15:33Z the fixer had been silent since 13:46Z, with no `fix/issue-13774`
branch pushed, so I asked the triager to check on it. The triager forwarded the answer and a status ping to the fixer (15:35Z). It replied to
the reporter on GitHub (issuecomment-6294681153), which I verified, and set a one-shot re-check, `t-4206f1`, for 16:45Z. If
there is still no branch, PR or reply by then, the triager will send me a [Report] asking me to re-dispatch or reassign.
At 15:36Z the fixer session cost-cap status was `ok` ($19.73 of a $180 cap) and the container was running, so it is not cost-stopped.
**15:37Z, fixer liveness confirmed** (I verified its session row seq 9). It is in progress and not blocked: debug build green,
failing repro committed `40959996f2` (22 variants, all E30015). It is now porting the hlsl functions to per-target bodies,
after a first draft failed the capability checks (E36120/E36104). Draft PR ETA is about 17:07–17:37Z. The triager moved
`t-4206f1` to 17:50Z.

**10-20 ~16:49Z: draft PR [#13785](https://github.com/shader-slang/slang/pull/13785)** (`fix/issue-13774`, head 6d77874,
+972/−5, `pr: non-breaking`). I verified the following on GitHub:
- It touches 4 files: docs, `hlsl.meta.slang`, and 2 new tests under `tests/hlsl-intrinsic/shader-execution-reordering/`.
  `glsl.meta.slang` is untouched and the diff adds 0 `case spvShaderInvocationReorderEXT`.
- `pr-mappings` maps #13785 to the fixer session `iptw3s`.
- The fixer posted the issue update, issuecomment-6296268693.
- CI on the draft: 4 checks pass, 56 are skipped.

The fixer reports 43/43 new tests passing with spirv-val and no regressions in the SER, vkray, spirv, glsl-intrinsic or
hlsl-intrinsic suites. It deviates from the brief twice, both reasoned: NVAPI `ReorderExecute` is a `static_assert` (its
`Invoke` needs an acceleration structure), and D3D12 has no motion variant. GPU coverage is partial, per the fixer: only
`ReorderExecute` ran on Vulkan, because the trace+invoke path device-loses in render-test, which it attributes to slang-rhi
enabling only the NV reorder extension. The fixer requested review from slang-reviewer (session `9bc7sh`, 17:01Z), and the
triager cancelled `t-4206f1`.

**19:03Z, slang-reviewer R1 = APPROVE_WITH_NITS** at 6d77874: 0 bugs, 3 test gaps, comment fixes, R1–R6 all met. It went
straight to the fixer (fixer seq 20), and I got a copy (`/workspace/inbox/a2a-1792523009335-12vwtk/`), so there was nothing for
me to route. The reviewer **refuted the fixer's GPU explanation**: on the L40S, the HitObject trace sequence device-loses
even on the all-NV module, so "slang-rhi enables only the NV extension" does not explain it. The cause is unknown and the
problem predates this PR. The reviewer also could not reproduce the fixer's "OptiX ReorderExecute PASS": the OptiX pipeline
compile fails on the existing sequence too. I had relayed the fixer's version to the dashboard at 17:02Z, so I sent a
correction.

**19:28Z, [Fix Report]: all nine nits applied at head 7445767** (+1036/−5, 4 files). I verified this on GitHub: the PR is
still a draft, 5 checks pass and 56 are skipped, and the Risk line in the PR body names the scope change from EXT-only to the
fallback. The fixer declined `[__requiresNVAPI]` on `__hlslInvokeHitObject` with a reason, and withdrew its GPU explanation.
Still not done: the reviewer's re-check of the changed tests and comments, and the triager's [Triage Resolution].

**Open maintainer decision:** keep the non-EXT fallback, as the reporter asked, or trim it to EXT-only, as the docs said.

**Next:** slang-reviewer gives its verdict, then the fixer sends its [Fix Report] and the triager its [Triage Resolution].
After that, CI runs once the PR is out of draft (operator or maintainer gated). Later PR webhooks route to the fixer through
`pr-mappings`.
