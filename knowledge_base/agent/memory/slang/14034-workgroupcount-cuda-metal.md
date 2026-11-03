---
type: chain
title: slang#14034 — WorkgroupCount() unavailable on CUDA (gridDim) and Metal ([[threadgroups_per_grid]])
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:17Z, same cloth-sim porting batch as #14026–#14031. Triaged feature/P2 and reproduced. Parked 5-bullet posted 11-02 17:17Z; PARKED on maintainer direction (approve Approach A? public semantic?) and on a likely reporter PR; re-check t-f136f9 2026-11-09 17:15Z.
tags: [cuda, metal, capabilities, system-values, feature-request, r6]
---

# slang#14034 — `WorkgroupCount()` on CUDA and Metal

**Ask.** `WorkgroupCount()` is `[require(glsl_spirv|wgsl)]` only, so grid-stride loops give E36107 on
`-target cuda`/`metal`. Expected: CUDA → `gridDim`; Metal → an implicit `uint3 [[threadgroups_per_grid]]`
entry-point parameter (as `SV_DispatchThreadID` → `[[thread_position_in_grid]]`); optional
`SV_WorkgroupCount`-style semantic; an HLSL diagnostic is acceptable. The reporter's `__target_switch` +
`__intrinsic_asm` workaround works on CUDA only (Metal emits `threadgroups_per_grid()` as a call).

**Triage (slang-triager, 10-29 17:40Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
cuda/ptx/metal/hlsl give E36107 (`hlsl.meta.slang:8491-8506`); spirv/glsl/wgsl compile. On the L40S, the
`gridDim` workaround PASSes on cuda and vk, and direct `WorkgroupCount()` PASSes on vk (reads 3,2,1). A user
`: SV_WorkgroupCount` parameter is E49999 on every target (there is no `core.meta.slang` semantic decl). Metal has no
user workaround: `getSystemValueInfo` (`slang-ir-legalize-varying-params.cpp:4325-4605`) maps no `*_per_grid` value.
**Recommended A (~20 LOC):** follow the #13920 WGSL precedent (internal `__builtinWorkgroupCount : SV_WorkgroupCount`,
`hlsl.meta.slang:18`): add cuda/metal arms, Metal → `threadgroups_per_grid`, a CUDA `gridDim` global plus a case, and
`-cuda`/`-mtl` runtime test lines. B: a CUDA `__intrinsic_asm` (two mechanisms for one value). C: a user-facing
semantic, as a maintainer follow-up. Related: #13920, #14029, #7733/#7734, #1421.
**No fixer was dispatched.** The reason is R6, and also #13920's description says "Metal and CUDA could use the same system value
later", so the reporter will likely send this PR soon. Memo: `/workspace/inbox/a2a-1793295648077-ohsztm/triage-14034.md`.

**GitHub state (verified 10-29 17:4xZ).** Issue Type=Feature; label `reproduced` (the triager added it; R6's mechanical check
in `compliance_check.py` counts comments only); 0 comments.
**R6:** no `bot-ok`, no crash word (E36107 is an ordinary diagnostic), so the bot holds any comment
until `created_at`+4 d = **2026-11-02 17:10:17Z**.

**Related.** #14029 (CUDA grid sync; the same persistent-kernel use case).

**11-02 re-check (t-f093d7).** The triager reports that E36107 still reproduces on 6815ed82d. No PR has `Fixes #14034`, and there has been no maintainer activity.
I verified that the parked 5-bullet, comment 6583505566 (nv-slang-bot, 2026-11-02T17:17:16Z), is the only comment. The reporter's PR **#14148**
(OPEN, "Add DispatchedWorkgroupSize()…", `Fixes #14136`) is the sibling. The triager says its body points at #14034 for the same mechanism. The comment asks the
maintainers to decide (1) whether to approve A for cuda+metal and (2) whether to add a public semantic (C) and its name. It also asks the reporter whether they will send the PR.
⚠️ The R6 4-day hold that I put in the 10-29 dispatch was the stale rule (see the root index Core Memory, retired 11-02). Here it only delayed the
comment and changed nothing else.

**Next.** The triager's one-shot `t-f136f9` runs 2026-11-09 17:15Z. It hands off to slang-fixer only if a maintainer approves A and the reporter is not doing it.
If nothing has changed, it re-posts nothing and asks me whether to keep parking.
(Superseded: `t-f093d7` 11-02 17:15Z, done.) If the reporter has opened a PR, validate it against the memo.
If a maintainer has given direction, hand off to slang-fixer. On silence, post the parked 5-bullet. The decision owners are the maintainers
(jkwak-work shepherded #13920). Owner: slang-triager, thread `gh-issue-shader-slang/slang-14034`.
