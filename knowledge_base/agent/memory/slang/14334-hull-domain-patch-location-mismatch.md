---
type: chain
description: "Human-filed (pdeayton-nv, self-assigned, no labels) 11-05 05:52Z: SPIR-V regression in v2026.21 — separately compiled hull/domain give patch field COLOR Location 1 (hull out) vs 0 (domain in). Suspected regressor #13078 (merged 10-19 as 9e17a9e850, fixed #12726; between v2026.20 10-17 and v2026.21 11-04). Triaged 06:10Z: P1 regression (bug/high/glsl-legalize), confirmed vs v2026.20; root cause = system values reserve Locations in createVarLayoutForLegalizedGlobalParam (:1049), so #13078 patch base getLSBZero() returns 1. Handed to slang-fixer (wt-slang-14334, draft PR). P1 regression ⇒ undraft ask is the exception to the weekly list."
resource: raw/triage-14334.md
tags: [spirv, tessellation, hull, domain, varying-location, regression]
---

# shader-slang/slang#14334 — hull/domain patch locations disagree (v2026.21)

**11-05 — issue_opened → `slang-triager` on `gh-issue-shader-slang/slang-14334`.** R6: no hold.
Reporter pdeayton-nv files and self-assigns routinely (see [#14099](slang-14099-hlsl-sibling-for-loop-redecl.md)).

Dedup at dispatch: memory grep on 14334 had only a false hit (a review id). GitHub search found no open PR;
related: closed #12726 (patch-constant outputs overlapped TCS locations; fixed by #13078) and held
[#13427](../imported/project_13427_double_vector_varying_location_count.md) (64-bit vectors; same
`createPatchConstantFuncResultTypeLayout` code; parked, reporter georgeouzou authored #13078).

My note, unverified: #13078 likely moved hull patch-constant user locations past the control-point outputs
without the domain input side matching. Triager to bisect/confirm.

**11-05 06:10Z — triaged** (triager's finding; comment [6651107989](https://github.com/shader-slang/slang/issues/14334#issuecomment-6651107989)
verified live, labels `regression`+`reproduced`). Reproduced on master b3d4e7ad4 and v2026.21, not on v2026.20. Mechanism:
`createVarLayoutForLegalizedGlobalParam` (slang-ir-glsl-legalize.cpp:1049) puts every leaf into `usedBindingIndex`, system
values included, so `gl_Position` takes slot 0 and the #13078 patch base `getLSBZero()` (:1440) returns 1. The domain side uses
front-end Locations and gets 0. DXC gives Loc 0 on both sides. Fix A: system values reserve no Location (one line); the 11 #13078 tests stay unchanged; new
HS↔DS match test on SPIR-V and GLSL. Classified P1 → **if the draft PR is good, the undraft ask goes to the operator now, not on the weekly list.**
Handed to slang-fixer (claimed, worktree wt-slang-14334). Follow-ups named on the issue, out of scope: patch-struct-before-OutputPatch
order mismatch (pre-existing; = #13427 side finding b), hull ignores `[[vk::location]]` on patch fields, `-emit-spirv-via-glsl`
glslang failure on hull (pre-existing). Memo: [raw/triage-14334.md](raw/triage-14334.md).

**11-05 08:20Z — [Triage Resolution]; checked live.** Draft PR **#14335** "GLSL/SPIR-V: number hull patch-constant outputs after
the control-point layout", branch `fix/issue-14334`, head **1465de11e**, `pr: non-breaking`, `Fixes #14334`. The diff touches 1 source file plus 4 tests.
Review is requested from pdeayton-nv, who is also the assignee. pr-mapping points to fixer `sess-1793858928003-n4rvnv`. CI: 4 pass, 53 skipped (draft).
The fixer did not use triage Approach A, for this reason: A breaks a control point `{SV_Position; [[vk::location(1)]] NORMAL}` (hull 0 vs domain 2).
Instead, the patch base is now the front-end offset + size of the hull result, and `usedBindingIndex` is removed. slang-reviewer: APPROVE_WITH_NITS, nits applied.
The fixer reports: new tests 14/14 (8/14 on master), hull tests 83/83, full suite 11758/11761 (3 CUDA fp8 failures that also fail on master).
**P1 regression ⇒ one un-draft ask sent to the operator** (dashboard, thread `gh-issue-shader-slang/slang-14334`). This is the exception to the weekly list.
Final re-check `recheck-14335-ready` fires 2026-11-07T17:00Z. If nothing has changed, it puts the PR on the weekly ready-flip list and asks no more.

**11-05 21:53Z: maintainer review on #14335** ([issuecomment-6670518771](https://github.com/shader-slang/slang/pull/14335#issuecomment-6670518771),
pdeayton-nv @nv-slang-bot). The webhook was routed by the host straight to the fixer session `n4rvnv`. The fixer replied at 22:02Z and reproduced both points. (1) A void hull that writes global
`out` variables regresses: the hull puts `color` at Loc 0 and the domain at 1, because the `translateGlobalVaryingVar` result struct has no `VaryingOutput` extent. The fix
goes in the producer on this PR, with spirv and glsl tests (in progress). (2) Explicit patch Locations are filed as [#14366](14366-patch-field-explicit-vk-location.md) (22:47Z), parked on a maintainer
decision. **The 11-07 re-check `recheck-14335-ready` should expect a new head on #14335 that carries fix (1).**

**11-05 23:15Z — human review round (triager [Report], checked live).** pdeayton-nv (shepherd) reviewed on 21:53Z in a PR comment, not a formal review, and raised 2 points.
(1) A real regression on 1465de1: a `void` hull that writes global `out` vars gave hull 0 vs domain 1. The fix is in the producer
(`translateGlobalVaryingVar` records the result struct's VaryingOutput extent), with new spirv+glsl tests. (2) The hull ignores `[[vk::location]]` on
patch fields. That is filed as **#14366**, bot-filed 22:47Z by this chain, so its issue_opened needs NO dispatch. Its open question: are explicit Locations absolute or struct-relative?
PR is still a **draft at head d20d01c38**. Fixer reply: comment 6671982254. Fixer's full run: 11761/11765 (3 CUDA fp8 tests + realtime-clock, which passes alone).
Next: the shepherd re-reviews and flips the PR. Re-check `recheck-14335-ready-6dd2` (11-07 17:00Z) still stands.

**11-06 00:08Z — round 2 [Triage Resolution], checked live.** Draft #14335 is at head **87af7e3bc** (8 files: glsl-legalize + translate-global-varying-var + 6 tests).
slang-reviewer R2 gave APPROVE_WITH_NITS with 0 bugs, and the nits are applied. The reviewer diffed output on 3,703 commands across 11 targets: the only change is in the new hull runs. Next: the shepherd re-reviews and flips the PR.
The triager asked whether to file 2 pre-existing bugs. Per [filing policy](../orchestrator/filing-verified-issues-policy.md), I told it to file both and report the numbers (my msg 23).
They are: (a) S1, where a `void` VS with global `out : SV_Position` takes a varying slot, so VS→FS Locations disagree; (b) the domain struct-first/no-`OutputPatch` order mismatch
(dedupe against #13427 side finding b). Both are filed only, so their issue_opened webhooks need NO dispatch.

**11-06 00:10Z — side find (a) filed as [#14375](https://github.com/shader-slang/slang/issues/14375)** (bot, label `reproduced`): a global
`out : SV_Position` takes a varying Location, so VS `vA` gets Loc 1 vs FS `vA_in` Loc 0 (SPIR-V + GLSL; front end
`slang-parameter-binding.cpp:728-735` ignores the semantic for globals). issue_opened: **NO DISPATCH** (live: no assignees, 0 comments).
FILED-ONLY, owned by this chain; a fixer chain on it is a fan-out to report to the operator, not started here. Side find (b)
(domain struct-first order) is still pending a number.

**11-06 00:11Z — side bugs filed** by slang-triager (checked live): **#14375** (S1: global `out : SV_Position` takes a varying slot → VS/FS mismatch) and **#14376** (domain patch-struct-first / no-`OutputPatch` order mismatch; maintainer numbering decision; #13427 related). Both Bug + `reproduced`, FILED-ONLY, owned by this chain — issue_opened needs NO dispatch.

**11-06 00:11Z — side find (b) filed as [#14376](https://github.com/shader-slang/slang/issues/14376)** (bot, label `reproduced`):
domain varyings share one counter in parameter order, so hull/domain Locations disagree when `PatchData` precedes
`OutputPatch<CP,N>` or there is no `OutputPatch` (pre-existing; v2026.20 also wrong; #14335 does not change it). The issue
asks maintainers to pick: (1) CP-first on both sides, or (2) DXC's semantic-sorted shared counter (renumbers all hull/domain).
issue_opened: **NO DISPATCH** (memory grep: only the register files; live: no assignees, 0 comments, cross-ref from #14334).
FILED-ONLY, parked `advisory:maintainer-decision` in `supervisor-state.json`; a fix is a new fixer chain (operator go).
All three side finds are now filed: #14366, #14375, #14376.
