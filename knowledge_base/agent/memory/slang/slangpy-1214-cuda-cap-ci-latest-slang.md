---
type: chain
title: slangpy#1214 — SlangPy Tests red on every Slang PR since slangpy#1199 (SGL_MAX_CUDA_COMPUTE_CAPABILITY only in ci.yml)
description: A cross-repo required-check outage. Filed by slang-ci-babysitter 2026-10-08 12:14Z. It blocks every Slang merge. The one-line fix is in slangpy's workflow, which belongs to slangpy maintainers (skallweitNV authored #1199). Escalated to the operator.
tags: [slangpy, slang, ci, required-check, merge-queue, outage]
---

# slangpy#1214: `SlangPy Tests` fails on every Slang PR since slangpy#1199

- skallweitNV's **slangpy#1199** ("Replace shader models with backend compiler profiles") merged on 2026-10-08 at 09:58:26Z as `0851599195`.
  It added `SGL_MAX_CUDA_COMPUTE_CAPABILITY: 90` to `.github/workflows/ci.yml` only (lines 75-76, a +2 change). The comment reads: "later versions do not work on our current driver".
  `ci-latest-slang.yml` is the cross-repo workflow that Slang PRs trigger, and it does **not** have that variable. I verified this at `0851599195`, and no later commit touches that file.
- Six CUDA ray-tracing tests fail on both legs: `createRayTracingPipeline` SLANG_FAIL, plus a `_optix_trace_typed_32` PTX error. The babysitter traced these; I didn't.
- **Impact:** `SlangPy Tests` is one of master's 3 required contexts.
  - Slangpy repository_dispatch runs between 06:00Z and 09:58Z: 11 successes and 0 failures.
  - After 09:58Z: 0 successes and 5 failures (plus 2 cancelled).
  - #13503 was removed from the merge queue at 12:08Z by `github-merge-queue[bot]`. skiminki-nv re-enqueued it at 12:25Z, and it will fail the same way.
- The babysitter's link to #1199 is an inference. My before/after split and the env-var diff support it strongly, but nobody has tested the fix.
- **Owner:** slangpy maintainers. The fix is a one-line workflow edit, and the bot doesn't push workflows. The babysitter filed slangpy#1214 with no pings.
- 2026-10-08: escalated to the operator. A required check is down for every Slang PR, and there's a human-actionable one-line fix.
- **2026-10-08 18:03Z: fix merged.** jkiviluoto-nv's slangpy#1215 ("Cap CUDA targets in latest-Slang CI") closed #1214. I verified this on GitHub.
  The first post-fix cross-repo run (37823268078) was still queued at 18:40Z, so there is no green confirmation yet.
  The babysitter suspects that only the `2u1g-b650-*` runners failed before the fix; that is unverified. If post-fix failures appear only on b650 runners, the cap is not the whole cause.
  The babysitter is holding the #13502/#13503/#13483 requeues until a post-fix green run. `rechase-slangpy-1214-cud-62f1` (22:42Z) confirms.
- jkiviluoto-nv also opened slang#13526 ("Populate LLVM prebuilts automatically after recipe changes"), the fix for #13515.
- **2026-10-08 20:20Z: fix confirmed green.** Post-fix runs 37823268078 and 37828925241 (slangpy `7ba7f800`) passed, including on the b650 hosts, which rules out the runner-class theory.
  Red `SlangPy Tests` statuses still on open PRs are stale, left over from pre-fix runs.
  Merge-queue ejections #13477, #13483, #13502 and #13503 are green at their heads. A human needs to re-enqueue them (the bot can't), and I asked the operator. #13479 is held back by #13515 instead.
  **Chain resolved** apart from those re-enqueues.
