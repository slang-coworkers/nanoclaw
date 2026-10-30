---
type: chain
title: slang#12630 — Texture1D.Load for CUDA/PTX (draft PR #13377)
description: Approach A fix in draft PR #13377; parked with no timer on two jkwak-work decisions (CUDA CI, OptiX raw 1D CUtexObject)
tags: [slang, cuda, ptx, texture1d, held-on-maintainer, parked]
---

# slang#12630 — `Texture1D.Load` on CUDA/PTX

- **Issue:** https://github.com/shader-slang/slang/issues/12630. jkwak-work commented 10-01 20:31Z/20:33Z.
  The triager asked the two open questions at 10-02 00:23Z
  ([cmt 5943235033](https://github.com/shader-slang/slang/issues/12630#issuecomment-5943235033)).
- **PR:** draft https://github.com/shader-slang/slang/pull/13377 (Approach A), branch `fix/issue-12630-impl`,
  head `2042d2cb31` (unchanged since 10-06), `pr: non-breaking`, 0 reviews.
- **Owners:** slang-fixer session `sess-1787171558661-q4gptw`; slang-triager. Thread `gh-issue-shader-slang/slang-12630`.
- **Open maintainer (jkwak-work) decisions:**
  1. **CUDA CI.** No CUDA GPU job has ever run on #13377. Head `2042d2c` has 0 Actions runs, so there is no gate
     to approve. A NEW run is needed (fixer push/merge of master, a manual dispatch, or ready-for-review); then
     ci-approvers approve it.
  2. **OptiX.** Does the OptiX bring-up bind raw 1D `CUtexObject`s over linear memory? The 2D lowering doesn't
     support that.
- **Chase history:** 3-day re-chases on 10-02 22:40Z, 10-05, 10-08, 10-11, 10-14, 10-17, 10-20 and 10-23 16:00Z.
  All 8 found no change. The only non-bot events after the ask: jkwak-work removed `Dev Opened` (10-08), and minco3
  cross-referenced from #13554/#13555 (10-09). Neither answers a question. The operator was asked keep-vs-park on
  10-14, 10-17 and 10-20, and did not answer. Run logs: `tasks/rechase-12630-cuda-ci-*.md`.
- **PARKED 2026-10-23 16:00Z, no timer (the default after 3 unanswered asks).** GitHub had nothing new after
  10-20 16:00Z, and the dashboard (seq 506332→507678) had no operator reply. No re-chase is scheduled, and nothing
  was posted to GitHub. The operator was told once on orchestrator-dashboard. Webhooks deliver any comment or push
  on #12630/#13377.
- **Unpark:** if the operator replies "resume 12630", schedule one 3-day re-chase with the same checks. If jkwak-work
  answers, or a `test-*-gpu-cuda` job runs, tell slang-triager on the thread above.
- **2026-10-29 21:52Z, a human comment unparked the chain.** albertrodriguezclo (CONTRIBUTOR, not the maintainer) posted
  [cmt 6509184430](https://github.com/shader-slang/slang/issues/12630#issuecomment-6509184430), with no @nv-slang-bot
  mention. They ask to map read-only `Buffer<T>` on CUDA to a linear-memory `CUtexObject` read through `tex1Dfetch`. That
  is the case #13377 documents as unsupported, and close to the open OptiX question. I dispatched it to slang-triager on
  the canonical thread without the post-authorized marker. jkwak-work is still silent; #13377 is still at `2042d2c`.
  At dispatch time GitHub via OneCLI returned `app_not_connected` (401) in Main's container, and I reported it to the
  dashboard.

- **10-29 22:05Z.** The triager checked the comment: the claim reproduces at master 977df1246, it isn't a duplicate,
  and a workaround passed on the L40S (1000/1000). It staged a follow-up issue, "CUDA: support read-only `Buffer<T>` as a
  texture object over linear memory (`tex1Dfetch`)", and a 2-line reply on #12630. It held both for my authorization
  because the comment has no @mention; its own GitHub auth was fine, and only Main's container had the 401. Copy of the
  draft: [drafts/12630-buffer-linear-tex-issue-draft.md](drafts/12630-buffer-linear-tex-issue-draft.md).
  **I authorized:** filing the issue with no fixer routing, posting the reply, and having slang-fixer run #13377's CUDA
  runtime tests on its L40S and report the results on the PR.
  **When that bot-filed issue's `issue_opened` arrives, this chain owns it and it needs no dispatch.**
- **10-29 22:16Z.** The follow-up was filed as **#14064** (Type=Feature, label `cuda`, author nv-slang-bot, not routed to a
  fixer), and the reply cmt 6509566757 is posted on #12630. I checked both live. **#14064 belongs to this chain; its
  `issue_opened` needs no dispatch.** The fixer's local L40S run of #13377's CUDA tests is in progress; results come back
  through the triager. Main's gh auth was working again by 22:17Z.
- **10-29, after 22:16Z.** The `issue_opened` webhook for #14064 arrived in Main. I absorbed it into this chain with no
  dispatch, as the rule above says.
- **10-29 22:24Z, local GPU evidence.** At `2042d2c`, 10/10 CUDA, PTX, CPU and VK tests pass on the fixer's L40S. The
  negative control (fix reverted) fails on cuda with all zeros. Posted as PR comment 6509717394, labelled "not CI"; I
  checked it live. The PR is still a draft, and CI has never run. **Parked again on jkwak-work:** mark #13377 ready for
  review (or start a CI run), and answer the OptiX linear-memory question (cmt 5943235033). Timer: one-shot
  `rechase-12630-gpu-eviden-53b4`, 11-02 16:00Z.
- **10-29 23:56Z, a human commented on #14064.** minco3 posted
  [cmt 6511372988](https://github.com/shader-slang/slang/issues/14064#issuecomment-6511372988), with no @nv-slang-bot
  mention. They report that their OptiX host binds `Buffer<uint>` as a linear `CUtexObject` in the 8-byte slot, which is
  a user data point on jkwak-work's open OptiX question 2. They also say a user `__target_intrinsic` on `Buffer<T>`
  still fails with E36107. Main relayed the comment verbatim to the triager's chain session `sess-1787171052043-isgnta`
  (landed seq 48, 23:59:58Z), asking it to verify the E36107 claim and propose a GitHub action. GitHub writes are held
  for my authorization, and the issue is not routed to a fixer. Chain session ids: Main `sess-1787170977616-2upr38`,
  triager `…isgnta`, fixer `…q4gptw`. The relay went from Main's #14064 session `sess-1793312084258-34ynbp`, so the
  triager's report comes back there.
- **10-29 23:56Z, minco3 on #14064** (cmt 6511372988): HLSL to PTX for OptiX. Their host already binds typed buffers as
  linear `CUtexObject`s, and keeping `Buffer<T>` fails even with a user intrinsic. The triager reproduced this, and found
  that with `-ignore-capabilities` the read works (1000/1000 on L40S), so the gap is the `__ShapeBuffer` `[require]` plus a
  missing `case cuda:` in `Load`. I authorized (10-30) the triager's PATCH of its own #14064 body and a short reply to minco3.
  minco3's host is not jkwak-work's answer, so the OptiX question on #12630 stays open.
