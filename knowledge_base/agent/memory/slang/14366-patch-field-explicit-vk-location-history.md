---
type: chain-log
title: "slang#14366 — dated history"
description: "Dated readings of #14366, 11-05 → 11-06: filed at pdeayton-nv's request; maintainer chose absolute field Locations (spec S1–S10) and a fixer started; the hull work split to #14335; the maintainers then disagreed and pdeayton-nv deferred to tangent-vector (struct-relative stays, 22:39Z); fixer stood down 22:55Z. Current state lives in the record; new dated entries append here."
tags: [spirv, tessellation, hull, domain, varying-location, follow-up]
---

# slang#14366 — dated history

Record (state, open question, local branches, lessons): [[slang/14366-patch-field-explicit-vk-location.md]]. Split out of the
record on 2026-11-07, when it passed 16 KB; the superseded absolute-Location entries (11-06 17:59Z → 21:14Z) were condensed.
New dated entries go **here**.

**Origin.** pdeayton-nv's review of draft PR #14335 ([issuecomment-6670518771](https://github.com/shader-slang/slang/pull/14335#issuecomment-6670518771),
11-05 21:53Z) raised two points. Point 2 was this behaviour: "Could you create a new issue to fix it unless you think it's fine to
fix in this PR?" The fixer replied at 22:02Z (issuecomment-6670691212). It reproduced the behaviour and said it would file the issue and link it on #14335. The issue was filed at 22:47Z.
The triage memo for #14334 had already named "hull ignores `[[vk::location]]` on patch fields" as out of scope.
(Point 1 of the review, a regression in a void hull that writes global `out` variables, is fixed on #14335 itself. See [#14334](14334-hull-domain-patch-location-mismatch.md).)

**Content (the fixer's repro, not verified by Main).** The hull ignores the annotation: `n` 0 / `color` 1. The domain treats it as relative to the struct: with `PatchData` first, `n` 6 / `color` 5. With `OutputPatch` first, `n` 0 / `color` 6.
Code: `createPatchConstantFuncResultTypeLayout` (slang-ir-glsl-legalize.cpp:1198) and `SimpleScopeLayoutBuilder::endLayout` (slang-parameter-binding.cpp:3225).

**11-05 22:48Z: issue_opened, NO DISPATCH.** The memory grep had no hit on 14366. Live state: no assignees, no labels, no events. The issue is owned by
the #14334 chain (the fixer filed it on request). A fix needs a maintainer decision first: should an explicit Location on a patch field be absolute (like GLSL
`layout(location=N) patch out`) or relative to the struct? The decision changes front-end layout code that other stages share. **Parked: advisory:maintainer-decision.**
Resume when a human comments on #14366 or #14335, or when the decision is made. A fix would then be a new fixer chain (operator go).

**11-06 17:41Z: first maintainer decision** (pdeayton-nv, [issuecomment-6691386811](https://github.com/shader-slang/slang/issues/14366#issuecomment-6691386811)):
absolute, as in glslang and DXC; conflicting explicit assignments are diagnosed, not rebased. Unparked and routed to slang-triager
(comment verbatim, post authorized); starting the fixer chain was reported to the operator, not asked, because a maintainer requested it.

**11-06 17:59Z: re-triaged** ([6691713173](https://github.com/shader-slang/slang/issues/14366#issuecomment-6691713173); P2 Bug,
`reproduced`, on master fef74e3c6). **Conflict found:** in the front end, an explicit Location on a struct field is relative to the
struct in *every* stage (VS `vsMain(A, B{loc5,loc7}, d)` gives 6/8; glslang gives 5/7; DXC rejects partial explicit assignment).
Options A (field Locations absolute in every stage) / B (absolute only for patch-constant fields), asked on the issue.
Memo: [raw/triage-14366.md](raw/triage-14366.md).

**11-06 18:21Z: pdeayton-nv chose A, every stage** ([6692175660](https://github.com/shader-slang/slang/issues/14366#issuecomment-6692175660),
detailed spec verbatim there; later superseded). **18:32Z:** handed to fixer `sess-1793989933374-lesjfp` with the spec as S1–S10
(triager reply [6692386068](https://github.com/shader-slang/slang/issues/14366#issuecomment-6692386068)); stacked on
`fix/issue-14334` @87af7e3bc5. Probed compatibility changes: parameter + field explicit 7/9 → 5/7; fragment result after an `out`
parameter 2/3 → 1/2; an array of structs (`B b[2]`, fields 5 and 6) already emits overlapping Locations (VUID-08721).

**11-06 20:23–20:30Z: split with #14335** (Orchestrator decision; detail in the [#14334 history](14334-hull-domain-patch-location-history.md)).
tangent-vector's review of #14335 (r4496887089, r4496901140, r4496960931): the hull's Locations must come from the front-end layout,
and no IR pass numbers outputs. **#14335 goes first and owns the hull path; #14366 keeps only the shared explicit-Location rule**
(S1–S10 minus hull consumption; new overlap error E39034, keyed by `vk::index`). Scope delta:
[6694773468](https://github.com/shader-slang/slang/issues/14366#issuecomment-6694773468). The fixer had already written the hull
design before the split; it is parked on local `wip/issue-14366-hull-consumption` and in `patches/fix-14366-hull-consumption.patch`
(slang-fixer group folder), and I relayed it to the #14334 triager `j75jq7` (pinned, in_reply_to=2).

**11-06 20:37–20:43Z: the global-`in` gap.** Case `struct B{[[vk::location(1)]] float4 x;}; in float4 g0; vsMain(B b, float4 a)`:
master df8b1d354 gives 1/2/3; fix/issue-14366 @7a8e2d6b9 gives b.x 1, a 0, **g0 1** (spirv-val VUID-08721). Cause:
`translateGlobalVaryingVar` (~114–137) starts global inputs after the *last* VaryingInput parameter. I rejected shipping it as a PR
"Known gap" (a regression of a shader valid on master). The fixer showed (code trace, reasoned not run) that a front-end reservation
alone cannot move that `nextOffset` base, so the fix needs the IR base change or #14335's option-A step. Its evidence: fully implicit
layouts show 0 diffs across 422 tests / 778 outputs; one explicit change (Metal reflection of tests/spirv/mesh-primitive.slang).
Blocked on the #14335 A/B decision; no leaving draft while the case regresses.

**11-06 21:07–21:14Z: PAUSED, the maintainers disagree** (checked live). tangent-vector (MEMBER) on #14335 ([6695608888](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695608888)) says a field
`[[vk::location]]` should **not** be absolute ("unequivocally Bad Thing"), considers master's struct-relative behaviour correct, and would rather not allow it on fields at all. On #14335 itself, tangent-vector chose (C):
block it behind a separate PR for global/module-scope varying parameters. That became prerequisite **#14375**, a new fixer chain run by the sibling Main session `o06xef`, reported to the dashboard 21:12Z.
`o06xef` sent the [PAUSE] to the #14366 triager at 21:10Z. The fixer stopped and **pushed nothing**: no remote branch, no PR. Local: `fix/issue-14366` @6c2199458a (4 commits on df8b1d354) and
`wip/issue-14366-hull-consumption` @bd243df21. The triager posted the question [6695761155](https://github.com/shader-slang/slang/issues/14366#issuecomment-6695761155) to @pdeayton-nv and
@tangent-vector: struct-relative, absolute, or not allowed on fields? Should the hull honour a struct-relative field Location (that fixes the original hull bug with no rule change; #14376 covers the hull/domain start)?
**Parked on that maintainer decision. No re-check task**; it waits for webhooks plus the supervisor register entry. If the answer is struct-relative, most of the branch is moot except E39034 and the hull part, which #14335 owns.

**11-06 22:39Z: DECIDED, struct-relative stays** ([6697597760](https://github.com/shader-slang/slang/issues/14366#issuecomment-6697597760), pdeayton-nv; jkwak-work assigned the issue to pdeayton-nv at 22:07Z):
"please follow @tangent-vector's guidance over mine. Let's keep current struct-relative behavior for now. The hull should use the same front-end layout rules as the domain, with hull
legalization consuming the computed layout rather than assigning locations itself." **The absolute-Location work is dropped.** What remains is the hull path, which belongs to #14335 (blocked on prerequisite #14375, chain `o06xef`).
Routed to the #14366 triager (`2tz45p`) to reply and re-scope. Proposed outcome: #14366 is resolved by #14335, the local `fix/issue-14366` is retired, and E39034 and the rest are dropped unless a maintainer asks for them.
I also sent the decision to the #14334 triager `j75jq7` (pinned, in_reply_to=2), with the bd243df21 reference patch.

**11-06 22:49Z: re-scoped** (triager; reply [6697746321](https://github.com/shader-slang/slang/issues/14366#issuecomment-6697746321)). The memo now has one current path: keep struct-relative, and #14335 owns the hull layout.
The absolute spec and approach A are marked superseded. **#14366 is resolved when #14335 lands** (#14335 is blocked on #14375). It stays open, and no closing keyword comes from our chain. Caveat (the triager's reading of the design, not measured):
hull and domain agree only when the patch struct starts at the same Location in both stages. That is #14376: the hull `color` is expected at 6, matching an OutputPatch-first domain (6) but not a PatchData-first one (5).
**Open question to pdeayton-nv:** keep the **E39034** overlap diagnostic as a separate PR, or drop it? Under struct-relative it still catches a real silent bug: on master, `B b[2]` with fields at 5 and 6 gives 6/7, overlapping (VUID-08721), with no error.
If it is kept, the triager asks me before opening a new fixer chain; that is a new chain, so report it to the operator. Fixer branches stay local and are not deleted: `fix/issue-14366` @6c2199458a (only E39034 kept),
`wip/issue-14366-hull-consumption` @bd243df21 (not continued). There will be no PR from this chain. The docs are dropped, the hull/domain tests belong with #14335, and rv2 is moot.

**11-06 22:55Z: fixer stood down** (its [Fix Report], via the triager). Nothing shipped. `fix/issue-14366` @6c2199458a keeps only E39034 (`reserveExplicitVaryingRange`, the `overlapping-varying-locations` diagnostic,
tests/diagnostics/vk-location-overlap.slang) plus an unshipped E39023 mixing-error regression test. The full run passed 11877/11905; 26 CUDA failures (launch, invalid PTX, OOM) were not root-caused. Earlier runs had only 3 CUDA fp8 failures, so this may be GPU contention; it is not an infra alert because nothing ships.
**Waiting on:** pdeayton-nv on E39034. Keep → the triager hands straight to the fixer and sends a [Report]; drop → final [Resolution]. Then #14335 → #14375.
