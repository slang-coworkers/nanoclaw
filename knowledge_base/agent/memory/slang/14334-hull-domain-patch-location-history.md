---
type: chain-log
title: "slang#14334 — dated history (PR #14335 and side finds)"
description: "Dated readings of the #14334 chain, 11-05 → 11-06: triage (P1 regression from #13078), draft PR #14335 rounds 1–2, side finds #14366/#14375/#14376 filed, un-draft, tangent-vector's front-end-layout redesign ask, option C making #14375 the prerequisite. Current state lives in the chain record; new dated entries append here."
tags: [spirv, tessellation, hull, domain, varying-location, regression]
---

# slang#14334 — dated history

Chain record (state table, decisions, lessons): [[slang/14334-hull-domain-patch-location-mismatch.md]]. The prerequisite
#14375 has its own record: [[slang/14375-global-varying-entrypoint-ownership.md]]. Split out of the chain record on
2026-11-07, when it passed 16 KB. New dated entries go **here**, one paragraph each; findings are the coworker's own unless
"checked live".

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

**11-05 23:15Z — triager [Report], checked live.** #14335 is still a **draft, now at head d20d01c38**, carrying fix (1): the
producer fix, where `translateGlobalVaryingVar` records the result struct's VaryingOutput extent, with new spirv+glsl tests.
Point (2) is **#14366**, bot-filed 22:47Z by this chain, so its issue_opened needs NO dispatch; its open question is whether
explicit Locations are absolute or struct-relative. Fixer reply: comment 6671982254. Fixer's full run: 11761/11765 (3 CUDA fp8
tests + realtime-clock, which passes alone).

**11-06 00:08Z — round 2 [Triage Resolution], checked live.** Draft #14335 is at head **87af7e3bc** (8 files: glsl-legalize + translate-global-varying-var + 6 tests).
slang-reviewer R2 gave APPROVE_WITH_NITS with 0 bugs, and the nits are applied. The reviewer diffed output on 3,703 commands across 11 targets: the only change is in the new hull runs. Next: the shepherd re-reviews and flips the PR.
The triager asked whether to file 2 pre-existing bugs. Per [filing policy](../orchestrator/filing-verified-issues-policy.md), I told it to file both and report the numbers (my msg 23).
They are: (a) S1, where a `void` VS with global `out : SV_Position` takes a varying slot, so VS→FS Locations disagree; (b) the domain struct-first/no-`OutputPatch` order mismatch
(dedupe against #13427 side finding b). Both are filed only, so their issue_opened webhooks need NO dispatch.

**11-06 00:10–00:11Z — side finds (a) and (b) filed** (bot, label `reproduced`, checked live; both FILED-ONLY and owned by this
chain, so their issue_opened webhooks got **NO DISPATCH**; a fixer chain on either is a new chain that needs an operator go):
- **[#14375](https://github.com/shader-slang/slang/issues/14375)** (S1): a global `out : SV_Position` takes a varying Location,
  so VS `vA` gets Loc 1 vs FS `vA_in` Loc 0 (SPIR-V + GLSL; front end `slang-parameter-binding.cpp:728-735` ignores the
  semantic for globals).
- **[#14376](https://github.com/shader-slang/slang/issues/14376)**: domain varyings share one counter in parameter order, so
  hull/domain Locations disagree when `PatchData` precedes `OutputPatch<CP,N>` or there is no `OutputPatch` (pre-existing;
  v2026.20 also wrong; #14335 does not change it). Maintainers pick: (1) CP-first on both sides, or (2) DXC's
  semantic-sorted shared counter (renumbers all hull/domain). Parked `advisory:maintainer-decision` in `supervisor-state.json`.

All three side finds are now filed: #14366, #14375, #14376.

**11-06 — un-drafted, then the maintainer asked for a redesign (checked live).** pdeayton-nv marked #14335 ready at 17:32Z, which resolved my P1 un-draft ask, so I cancelled
re-check `recheck-14335-ready-6dd2`. At 19:46Z, tangent-vector posted [6693897805](https://github.com/shader-slang/slang/pull/14335#issuecomment-6693897805), asking whether the front-end layout is now the
only source of truth. They followed with 3 inline COMMENTED reviews on slang-ir-glsl-legalize.cpp (:1202, :1318, :1321): the function "should not exist", "a huge code smell", "This IR pass
should not be responsible for 'numbering' the outputs at all". The front-end layout/binding step must encode the patch-constant output layout in
`VarLayout`/`TypeLayout`/IR layout, and legalize only reads it. Fixer's plan: [6694067523](https://github.com/shader-slang/slang/pull/14335#issuecomment-6694067523).
The fix is now a front-end refactor, and it probably also covers the patch-constant half of [#13427](../imported/project_13427_double_vector_varying_location_count.md)
(tangent-vector gave the same direction there on 10-07). Webhook-driven, with no timer: the fixer owns the PR on head 87af7e3bc and will post its design, then implement and run a review round.
The same minute (19:51Z) the `ready_for_review` webhook came on the approver route: NOT forwarded, because slang-pr-approver is
paused; queued in `data/approver-pause-queue.md` at head 87af7e3bc5.

**11-06 20:23Z — #14335 and #14366 sequenced (Orchestrator decision).** The #14334 triager reported that the two fixes overlap: both would make the hull consume the front-end layout. Decision: **#14335 first**. The front end lays out
the patch-constant result (`processEntryPointVaryingParameterDecl` → `EntryPointLayout` → IR), the hull only reads it, and `createPatchConstantFuncResultTypeLayout` is deleted. **#14366 stacks on it** with only the shared
explicit-Location rule, plus no hull/legalize edits. I sent this to the #14366 triager session `sess-1793986986720-2tz45p` (pin + in_reply_to=2; landed as its seq 32 and was relayed to its fixer at 20:24Z).
Open maintainer question, owned by this chain: is `translateGlobalVaryingVar` handled in #14335 or in #13892?

**11-06 20:50Z — PARKED on a maintainer A/B choice** (checked live). The redesign is in [6694688509](https://github.com/shader-slang/slang/pull/14335#issuecomment-6694688509) and the A/B addendum (global `in`/`out`
mixed with explicit field Locations) in [6695166086](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695166086). A = the IR start is the largest offset + size. B = the front end reserves global-scope varyings.
The part common to A and B is done locally in 4 commits, **not pushed**, so the PR head is still 87af7e3bc. In those commits the front end lays out the patch-constant result as `EntryPointLayout::patchConstantResultLayout`, passed to IR as the optional 3rd operand of `IREntryPointLayout`.
`createPatchConstantFuncResultTypeLayout` and `getVaryingOutputLocationEnd` are deleted, and `translateGlobalVaryingVar` is reverted to master. Every hull test passes except the 2 global-output tests that depend on the A/B choice.
Deciders: pdeayton-nv and tangent-vector. I named the decision on the dashboard. Timer: one-shot `recheck-14335-ab-choice-9bd7` at **2026-11-10T17:00Z**; if there is still no answer then, the chain becomes webhook-only.

**11-06 21:07Z — tangent-vector chose option C; I approved the prerequisite chain** ([6695608888](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695608888), checked live).
(1) Store the patch-constant layout as an `IRAttr` (`IRHullEntryPointPatchConstantOutputLayoutAttr`), not as an optional operand. (2) **C:** "consider this PR/issue as blocked while you create a separate PR" that fixes how parameter
binding/layout handles global-/module-scope varyings, possibly folding in fixes to the entry-point semantic checking. (3) He rejects absolute field `[[vk::location]]`, which conflicts with pdeayton-nv's #14366 spec.
**Decision (Orchestrator, 21:11Z, msg 67 → triager j75jq7, landed seq 42):** GO, because a maintainer asked for it. Tracked under **#14375** (this chain's bot-filed S1): branch `fix/issue-14375`, `Fixes #14375`, same fixer session, investigate first,
then a draft PR. #13892 (jkwak-work's umbrella; no PR from them, last updated 10-23) and #13622 (global-`in` SV stage check, tangent-vector's) are named as related, plain text, no Fixes link.
#14335 stays open and blocked on the #14375 PR; the IRAttr change goes in locally, no push until the prerequisite lands. Reported to the dashboard.
**21:12Z — #14375 handed off** (triager msg 74): a [Triage handoff] went to the same fixer session; the handoff 5-bullet is [6695688439](https://github.com/shader-slang/slang/issues/14375#issuecomment-6695688439) (checked live).
#14375 from here on: [[slang/14375-global-varying-entrypoint-ownership.md]].
