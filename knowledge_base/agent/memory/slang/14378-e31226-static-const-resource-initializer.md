---
type: chain
title: slang#14378 — E31226 rejects a `static const` global initialized from a resource parameter
description: Human-filed (minco3) 11-06 06:22Z. Claimed regression from #10925 (v2026.5.2 accepts). Same predicate as #14290 / draft PR #14300. Dispatched to slang-triager 11-06.
tags: [front-end, diagnostics, static-const, resource-type, regression, hlsl]
---

# slang#14378: E31226 for `static const Texture2D aliasTex = tex;`

Human-filed by minco3 (a contributor who often opens their own fix PRs; see [#14069](14069-msvc2019-ice-unit-test-string-to-array.md))
on 11-06 06:22Z. No labels, no assignees, no comments at filing. `static const` globals whose initializer is a global
texture/sampler parameter (directly, or a struct `{ tex, samp }`) fail with E31226 on every target. The reporter says
v2026.5.2 and dxc accept it, and that #10925 deleted `tests/compute/type-legalize-global-with-init.slang` and
`tests/bugs/gh-4874.slang`, which covered this pattern. ReShade FX's HLSL backend emits it. Related: #13074 (closed,
non-const `static` resource globals).

**Overlap:** the same check, `_initExprIsRuntimeValue` (slang-check-decl.cpp), is being changed by
[#14290](14290-e31226-spec-constant-array-static-const-false-positive.md)'s draft PR #14300 (spec constants), which is
held as a draft until #14293 merges. The #14300 fixer session is `sess-1793766458765-6l1e8e`.

**11-06 06:3xZ, Main:** memory grep found no owner; no assignees. Dispatched to slang-triager on
`gh-issue-shader-slang/slang-14378` (R6: no hold); triager session `sess-1793946278456-imo3c0`. The triager decides whether it is a separate fix or a fold into #14300.
**11-06 06:27Z, triager (msg 10):** reproduced on master `6d43c8d88` (spirv/hlsl/cuda, both forms). Regression window:
v2026.8 accepts (valid SPIR-V), v2026.9 rejects, which matches #10925 first shipping in v2026.9. Triage report pending.
**06:29Z, triager (msg 12):** confirmed #10925 (`4656c4841`, first in v2026.9) deleted both tests. Its bot review flagged the
removal 3 times and no human replied. Code read of `_initExprIsRuntimeValue` is in progress.
**06:36Z, triager [Triage] (msg 14; file `/workspace/inbox/a2a-1793946977829-31cqq3/triage-14378.md`):** regression / high /
frontend / **P1**. Window v2026.8 OK → v2026.9 fails. Cause: `_initExprIsRuntimeValue` (slang-check-decl.cpp:3701-3711) never
checks the type. Lowering is fine (same decls inside a function compile on all 6 targets). Recommended fix **A**: exempt
resource/sampler reads rooted at a global shader parameter, keyed on the type at the value position, NOT the base type.
ConstantBuffer is opaque too, so a base-type rule would re-allow `static const float f = Value;` (#8279). Restore both deleted
tests. **Separate from #14300** (folding would block a P1 behind #14293 and reset its review; only an adjacent-hunk conflict).
Labels `reproduced` + `regression`, Type=Bug set; triage comment 6678800838 (verified 06:33Z) offers @minco3 the PR.
**Parked on the reporter until re-check `t-5870bd` 2026-11-07 07:00Z** (triager's group); if there is no human PR or claim then,
the triager hands off to slang-fixer on `gh-issue-shader-slang/slang-14378`.
**Main 06:4xZ:** kept the 24 h window (the #14069 precedent; the bug has shipped since v2026.9). Side find (`static const Texture2D t = texArr[1];` →
E99997 on SPIR-V in v2026.8) **NOT filed** (triager msg 18): E31226 hides the global form on master, and the function-local form
compiles on all 6 targets, so the crash may already be fixed. The brief's acceptance checks re-test it after the fix; file only
if it reappears (then it belongs to this chain, so its issue_opened needs NO dispatch). Updated memo: triager's
`memory/issues/triage-14378.md`. Ready-flip: P1 regression, so one direct operator ask (exception to the weekly list).

**11-06 06:52Z — reporter PR #14379** (minco3, `fix/static-const-resource-init`, non-draft, `Fixes #14378`; edits
`slang-check-decl.cpp` `_initExprIsRuntimeValue` + 3 tests; review requested from kaizhangNV, who github-actions auto-assigned
at 06:52:31Z — not a maintainer self-assign). Found by the tick-329 supervisor (blind-spot shape 16, timeline cross-ref); the
chain had no record of it. The 24 h reporter window is answered: no fixer handoff. The triager's re-check `t-5870bd`
(11-07 07:00Z) should find the PR and stand down; the P1 ready-flip ask above is moot (no bot PR).
**Resume on:** #14379 merge/close, or a human comment asking the bot to help.
