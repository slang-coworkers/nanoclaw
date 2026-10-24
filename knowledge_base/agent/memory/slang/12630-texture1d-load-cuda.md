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
