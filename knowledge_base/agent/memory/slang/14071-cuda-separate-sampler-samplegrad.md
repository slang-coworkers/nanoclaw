---
type: chain
title: "slang#14071: CUDA/PTX separate-sampler SampleGrad rejected while separate-sampler SampleLevel drops the sampler"
description: "Human request (minco3) 10-29: CUDA separate-sampler SampleGrad is E36107 while SampleLevel drops s. Preferred fix reverses jkwak-work's #13559 ruling. PARKED for jkwak-work (assignee) on A/B/C since triage comment 6591886780 (11-03); re-check t-35ef08 11-10 00:10Z. Owns spin-outs #14073 (items 1-3 merged in #14079; closed 11-06 via #14079 + #14388) and #14083 (parked)."
tags: [cuda, texture, samplegrad, r6, maintainer-decision]
---

# slang#14071: CUDA separate-sampler `SampleGrad` vs `SampleLevel` asymmetry

**Filed** 2026-10-29T23:56:25Z by minco3 (same reporter as [#13556](13556-cuda-samplegrad.md) and #13555). No labels,
no assignee, 0 comments at dispatch (checked live).

**Ask.** On CUDA/PTX, `Texture2D.SampleLevel(SamplerState, ...)` compiles and drops `s` (`tex2DLod`), but
`Texture2D.SampleGrad(SamplerState, ...)` is E36107. Preferred: lower separate-sampler `SampleGrad` the same way
(ignore `s`, reuse the #13559 `tex*Grad` lowering). Alternative: document why the two differ. The lodClamp overload
is out of scope. Motivation: OptiX HLSL uses separate samplers, and RT stages have no implicit derivatives.

**Why it parks.** The preferred fix is exactly what jkwak-work rejected on #13559
([discussion_r4273039653](https://github.com/shader-slang/slang/pull/13559#discussion_r4273039653)): *"I don't think
this is acceptable. We cannot just ignore the sampler when the user expect it to be used explicitly. I think we
should remove `cuda_` from the `require` line of this function"*. #13559 shipped with the separate-sampler form
pinned as E36107. The 13556 record already listed the `Sample`/`SampleLevel` sampler drop as a possible unfiled
follow-up; this issue files the inverse. Options for the maintainer: (A) extend the drop to SampleGrad (reverses the
#13559 ruling), (B) document the asymmetry (the issue's alternative), (C) make `Sample`/`SampleLevel` consistent
with the ruling (likely breaking for existing CUDA users).

## Current state (11-06 21:20Z)

| item | state |
|---|---|
| #14071 | OPEN, assignee jkwak-work, human-triaged 11-02 (label `optix`, Type=Bug). Bot triage comment [6591886780](https://github.com/shader-slang/slang/issues/14071#issuecomment-6591886780) posted 11-03 00:15Z at master 96a728c85. **PARKED** on the A/B/C call. |
| re-check | triager one-shot `t-35ef08`, 11-10 00:10Z: reports a maintainer reply to Main, posts nothing otherwise, dispatches no fixer. |
| #14073 (F1–F4 spin-out, bot-filed) | **CLOSED 11-06 21:18Z.** Items 1–3 in [#14079](https://github.com/shader-slang/slang/pull/14079) (`9b46bca644`); item 4 (option (a), jkwak-work [6691067713](https://github.com/shader-slang/slang/issues/14073#issuecomment-6691067713)) in [#14388](https://github.com/shader-slang/slang/pull/14388) (`b85caf9285`). Deferred nits kept in `remedy-14388-r1.patch`. |
| #14083 (G2 spin-out, bot-filed) | `[CudaKernel]`/`[CudaDeviceExport]` skip `validateEntryPointCapabilities`, so unavailable intrinsics compile to an empty body. Parked with jkwak-work; no bot fixer. Addendum [6692697361](https://github.com/shader-slang/slang/issues/14083#issuecomment-6692697361) (11-06): statements after the unsupported call are deleted too. |

**All three issues belong to this chain:** an `issue_opened` / comment webhook on #14073 or #14083 needs no new
dispatch; route it to chain session `sess-1793318187530-57d4wk`.

## Behaviour on master 96a728c85 (11-03)

Separate-sampler `SampleGrad` (all 3), `SampleBias`, `SampleCmp*` and, since #14079, `GatherCmp*` → E36107 on CUDA.
Separate `Sample` (hlsl.meta.slang ~:2979), `SampleLevel` (~:4221) and `Gather*` still compile and drop `s`. The combined
`Sampler2D.Gather` ICE (F2) is fixed. Docs: cuda-target.md:139 gives the CUtexObject reason.

## Decisions and lessons

- **Relaying the triage comment:** don't argue with a human Type=Bug ("kept on purpose in #13559 … the asymmetry is
  real"), and re-verify at that day's master before posting — t-3160ea held its post on 11-03 because #14079 had changed
  behaviour since the draft.
- **`Part of #14073`, not `Fixes`,** when a PR leaves an item (F4) open — the #13556 lesson; a `Fixes` would auto-close it.
- **No master-merge push on an approved BEHIND PR:** it can dismiss the approval and restart CI; pull_request CI builds
  the merge ref and the merge queue handles BEHIND.
- **Never cancel a yielded bot CI run:** `retry-yielded-bot-ci.py` rejects runs with a cancelled non-marker job, so they
  can't be retried (shared learning filed 10-30). The 10-30 fleet-wide `falcor-ci` deadlock is in the #14073 log.
- Bundle verified side findings into **one** bot issue; filing a verified issue isn't gated.

Dated history (routing, triage, comment post, #14083): [[slang/14071-cuda-separate-sampler-history.md]]. The closed #14073 spin-out
(F1–F4 verification, #14079 and #14388 rounds, the 10-30 `falcor-ci` deadlock): [[slang/14073-cuda-gather-spinout-history.md]].
New dated entries go to the #14071 history file, not here.
