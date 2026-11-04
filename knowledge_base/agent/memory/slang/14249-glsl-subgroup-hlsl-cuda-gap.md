---
type: chain
title: slang#14249 — GLSL subgroup functions lack HLSL/CUDA implementations (shader-subgroup tests disabled)
description: Human bug (jkwak-work, self-filed + self-assigned) 11-03 18:45Z. TRIAGED 19:25Z (cmt 6613400566; bug/medium/P2, reproduced; 44 of 79 subgroup fns gated off hlsl/cuda). PARKED on the assignee; fixer NO-GO. Side-finds #14250/#14251 have their own fixer chains. Re-check recheck-14249-assignee-c5f7 11-10 19:30Z.
tags: [glsl-intrinsics, capabilities, hlsl, cuda, subgroup, test-infra, self-assigned]
---

# slang#14249 — GLSL subgroup → HLSL/CUDA coverage gap

**11-03 18:45Z, `issue_opened`.** Author **jkwak-work**, self-assigned 18:45:14Z, 0 labels, 0 comments.

**Ask.** `glsl.meta.slang` subgroup functions carry narrow `[require(...)]` sets, so GLSL source fails with
E36107 on targets that have an equivalent (HLSL Wave / CUDA warp): `subgroupInclusiveAdd` (hlsl, cuda),
`subgroupExclusiveMin` (hlsl), `subgroupBallotBitCount` (hlsl). Lists are first-error only, so incomplete.
Requires date from #3912 (Apr 2024). The three tests under `tests/glsl-intrinsic/shader-subgroup/` had their
HLSL/CUDA lines turned into `DISABLE_TEST` while making `SIMPLE` check the exit code (author's #14215 work);
re-enable them once implementations exist.

**Disposition (Orchestrator, 11-03).** Bug class, so the #13348 precedent applies: dispatch slang-triager on
`gh-issue-shader-slang/slang-14249` for triage + the complete gap inventory; **no fixer** because the reporter
self-assigned. The triage comment may offer a bot draft PR. Not the #14215 "held" class (that was a design
proposal). Related: [#14215 record](14215-validate-with-downstream-compiler.md).

**11-03 19:23Z — split-offs.** The triager filed bot issues **#14250** (ballot bit-extract / inverse-ballot / vector prefix-xor bodies) and **#14251** (wave ops on bool) during the sweep, and posted the triage comment at 19:25:54Z (offers a bot draft PR for the widen/forward rows). This chain owns both; their `issue_opened` webhooks need no dispatch. The `[Report]` decides fixer go/no-go for them (neither is assignee-blocked).

**Resume on:** triager `[Report]` (incl. fixer go/no-go for #14250/#14251); a human comment asking for a bot PR (→ slang-fixer, canonical thread).
