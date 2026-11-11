---
type: chain
title: slang#14249 — GLSL subgroup functions lack HLSL/CUDA implementations (shader-subgroup tests disabled)
description: Human bug (jkwak-work, self-filed + self-assigned) 11-03 18:45Z. TRIAGED 19:25Z (cmt 6613400566; bug/medium/P2, reproduced; 44 of 79 subgroup fns gated off hlsl/cuda). PARKED on the assignee; fixer NO-GO. Side-finds #14250/#14251 have their own fixer chains. 11-10 re-check: no comment, no fix PR; parked on assignee, no timer (webhooks + /supervise-issues).
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

**11-10 19:30Z — one-shot re-check `recheck-14249-assignee-c5f7`: no activity.** Still OPEN, assignee
jkwak-work. The only comment is the triage comment 6613400566, so no human has asked for a bot PR or given
other direction. The assignee touched the issue: label `regression` and milestone **Q4 2026 (Fall)** on 11-04
16:57Z. The PR search returns no fix PR. #14269 (jkwak-work, MERGED 11-04 21:37Z, "slang-test: fail SIMPLE
tests on an unexpected exit code") is the test-infra change. It lists #14249 only as the `TODO(#issue)` for the
disabled HLSL/CUDA lines. The three `referenced` commits (96c6d5da1, 8ef09f7db, d6ad99cb3) are #14269 branch
commits and its merge. #14254/#14255 are the side-find chains. **Parked on assignee. No further one-shot**:
the next webhook or a /supervise-issues tick picks it up. (Reading the fork with `gh api repos/jkwak-work/slang/...`
gives a 401 from the gateway. Resolve fork SHAs through `repos/shader-slang/slang/commits/<sha>` instead.)

**Resume on:** issue closed or an assignee fix PR (→ record update only, no post); triager `[Report]` (incl. fixer go/no-go for #14250/#14251); a human comment asking for a bot PR (→ slang-fixer, canonical thread).
