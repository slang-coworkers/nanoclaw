---
type: chain-log
title: slang#14071 — dated history
description: "Dated readings of the #14071 chain and its parked #14083 spin-out: 10-29 routing → triage, comment 6591886780 posted 11-03, #14083 verdict 11-05 and addendum 11-06. The closed #14073 spin-out (PRs #14079/#14388) has its own log; current state and lessons live in the chain record; new dated entries append here."
---

# slang#14071 — dated history

Chain record (state table, options A/B/C, spin-outs, lessons): [[slang/14071-cuda-separate-sampler-samplegrad.md]].
The closed #14073 spin-out (F1–F4, PRs #14079 and #14388) is in [[slang/14073-cuda-gather-spinout-history.md]].
New dated entries go **here**, one bullet each. When this file nears 12 KB, prune the oldest "no change" bullets.
Numbers are the coworker's own unless marked ✅ Main-verified.

**Routing (orchestrator, 2026-10-29 ~23:58Z).** `grep 14071 memory/slang/` had no hits. The only session on
`gh-issue-shader-slang/slang-14071` was my own Main webhook session `sess-1793318187530-57d4wk`. Dispatched to
slang-triager on that thread. **R6:** no labels, no crash word → no bot comment, PR, or issue-naming commit before
2026-11-02T23:56:25Z. No fixer dispatch.

**Triager interim (10-30 00:01Z, msg 10; the triager's finding, not yet verified by me).** Reproduced on master
1f0b33b86: separate-sampler `SampleGrad` → E36107 on ptx and cuda; separate-sampler `Sample`/`SampleLevel`/`Gather*`
drop `s`. Adjacent finding being checked: CUDA `GatherCmp` drops the compare value (a silent wrong result). I told
the triager to put it in the memo and not file it on its own; filing is my call after the memo.

**[Triage] (10-30 00:07Z, msg 12; memo `/workspace/inbox/a2a-1793318824179-dmq13q/triage-14071.md`).** feature-request /
low / P3 / CUDA target-emit + core module + docs. The E36107 is intentional per the #13559 ruling. Separate-sampler
overloads that drop `s` on CUDA: `Sample` (hlsl.meta.slang:2979), `SampleLevel` (:4221), all `Gather*` (:4996/:5043);
everything else (all 3 `SampleGrad`, `SampleBias`, `SampleCmp*`) is E36107. Docs: cuda-target.md:135 (from #13559) gives
the CUtexObject reason, which also applies to the overloads that compile; :20/:200 say "samplers are ignored"; :393 is
stale. Options A (reverse the ruling) / B (docs only, the triager's lean) / C (reject `s` everywhere, breaking ~10
in-tree tests). Correction to my dispatch: on #13559 the bot *stated* (r4273094495) that Sample/SampleLevel drop `s`;
it did not ask. Re-check **t-3160ea** fires 2026-11-03 00:10Z and posts `comment-14071.md` (+`reproduced`, Type=Feature
if still unset).

**Comment draft reviewed (10-30 00:1xZ, `/workspace/inbox/a2a-1793318922440-ingl4r/comment-14071.md`).** I checked
the claims at 1f0b33b868: cuda-target.md:135 matches, and :20/:200 do say samplers are ignored. Edits sent: no-ping
"jkwak-work" (not `@`); re-verify at that day's master before posting; link the F1–F4 issue and hedge (B), because
`GatherCmp` also drops the compare value.

**10-30 ~00:15Z: side findings F1–F4 bundled into one bot issue, #14073** (filing isn't gated); its history is in the #14073 log.

**11-02 R6 note:** the 4-day hold behind this chain was the stale #1993 draft rule, retired in Core Memory on 11-02
([13591 record](../imported/project_13591_ai_contributor_standards_batch.md)). #14071 released on its own at 11-02 23:56Z,
and t-3160ea posted at 11-03 00:10Z, so I did not run it early.

**11-03 00:14Z: t-3160ea HELD the post (triager msg 68), which was correct, because behaviour had changed.** On master
96a728c85: separate `SampleGrad` is still E36107, and separate `Sample`/`SampleLevel`/`Gather` still drop `s`. Since
#14079, `GatherCmp*` is E36107 and the combined `Gather` ICE is fixed. ✅ Main-verified: **human triage on 11-02
18:46Z (jhelferty-nv) assigned jkwak-work, labelled `optix`, and set Type=Bug**, so the bot sets no label or Type. The
master docs cuda-target.md:139 match the revised draft. The revised draft is
`/workspace/inbox/a2a-1793664863001-lzfn73/comment-14071.md`. **My OK came with two edits:** (1) drop `Sample` from the
"compile for SPIR-V and DXIL" sentence (it needs a derivative context); (2) reword "The E36107 is intentional" so it
doesn't argue with the human Type=Bug ("kept on purpose in #13559 … the asymmetry is real"). Post now, after
re-verifying at that day's master. t-35ef08 (11-10 00:10Z) becomes the parked check for a maintainer reply.
- **11-03 00:15Z: triage comment posted**,
  [6591886780](https://github.com/shader-slang/slang/issues/14071#issuecomment-6591886780) (✅ Main-verified: bot
  author, both edits present, SHA 96a728c85, no @-mention). **PARKED for jkwak-work (A/B/C).** The re-check is
  triager one-shot `t-35ef08` at 11-10 00:10Z: it reports a maintainer reply to me, posts nothing otherwise, and
  dispatches no fixer.

## #14083 (G2 spin-out, parked with jkwak-work)

**G2 follow-up filed: [#14083](https://github.com/shader-slang/slang/issues/14083) (10-30 02:05:18Z).** "CUDA:
[CudaKernel] and [CudaDeviceExport] functions skip capability checks, so unavailable intrinsics compile to an empty
body". ✅ Main-verified live: author nv-slang-bot, label `cuda`, 0 comments, body does not name #14071 (R6-safe); it
names #14079 and distinguishes #13683 (specializeStageSwitch, a different failure). Likely cause per the body:
`validateEntryPointCapabilities` (slang-check-shader.cpp:1813) runs only for `EntryPoint` objects. **Owned by this
chain: its `issue_opened` webhook (Main session `sess-1793325920758-x74cie`) dispatched nothing.** Triage/fix routing
for #14083 is decided in chain session `sess-1793318187530-57d4wk`, after the #14079 remedy push.

**11-05 11:35Z: the operator asked (dashboard msg 34) for a triage verdict on #14083. I gave the verdict myself and
dispatched no triager.** Live state: OPEN, 0 comments, assignee jkwak-work (self-assigned 11-02 18:48Z), Type=Bug
(set by jhelferty-nv), milestone "Q4 2026 (Fall)". The only `referenced` event is #14079's merge commit 9b46bca6 in
the undefdev fork. ✅ Main re-ran the repro with the local Release slangc (built 11-02 22:24Z): `-target cuda` gives
rc=0 and empty bodies for both `k` and `f`; a `[shader("compute")]` entry point making the same `SampleCmp` call gives
E36107. Verdict: front-end capability checking (slang-check-shader.cpp), Bug, P2 (silent miscompile, CUDA-only
roots). Next step: held for jkwak-work (rung 4), no bot work.

**11-06 18:40Z: #14083 side find from the #14388 Fix Report (fixer msg 34). ✅ Main-verified** with the local Release slangc
(11-02 22:24Z): a `[CudaKernel]` with `o[0]=…; o[1]=tex.SampleLevel(samp,uv,0.0,int2(1,1)); o[2]=…;` and `-target cuda` gives
rc=0, and the body keeps only the `o[0]` store.
**The unrelated statements after the unsupported call are deleted too.** The mechanism, per the reviewer's `-dump-ir`
(not verified by me): the callee has no `case cuda:`, so its body ends in `missingReturn`; `performForceInlining` puts that
terminator in the kernel's block, and DCE drops the rest. **Decision:** the fixer posts ONE addendum comment on #14083
(repro + mechanism; no @, no fix offer, no #14071). The fix stays with jkwak-work (rung 4). I sent this at msg 35 and
am waiting for the comment link. Note: `57d4wk` also woke at 18:34Z for the reviewer verdict. Both Main sessions are
writing this file, so read its tail before sending to the fixer.
- **11-06 18:47Z: #14083 addendum posted**, [6692697361](https://github.com/shader-slang/slang/issues/14083#issuecomment-6692697361)
  (fixer msg 36; ✅ Main-verified: bot author, no @, no "14071", names the `o[2]` deletion). It covers the repro on fef74e3c6,
  the IR mechanism (callee is a lone `missingReturn` → after inlining the stores sit in an unreachable block), the
  entry-point E36107 control, and the #14388 Gather-offset path. #14083 stays with jkwak-work. The fixer is idle until
  #14388's CI or review webhook arrives.
