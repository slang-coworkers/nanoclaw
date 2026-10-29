---
type: chain
title: slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum
description: Triaged + reproduced (not a regression); front-end link-time constant folding misses checked initializers. The assignee opened PR #13487 (Approach A); tangent-vector reviewed it critically on 10-16 and the author has not replied; NO-GO stands, fixer briefing superseded
tags: [slang, frontend, reflection, link-time-constants, conditional, parked]
resource: /workspace/inbox/a2a-1790993201805-3bhx61/triage-13419.md
---

# slang#13419 — `Conditional<CB, externEnum != X>` loses binding (human PR #13487 open)

Reporter pdeayton-nv (MEMBER). **Self-assigned** at 2026-10-03T00:58:54Z (`assigned` event actor
pdeayton-nv, verified); jkwak-work added `Dev Opened`. Sibling of
[#13420](13420-uninit-correlated-conditions.md), same reporter and same day.

**Mechanism (triager's finding, prototype-verified at master 6ba151dcf):** layout folds extern
conditions through `ComponentType::tryFoldIntVal` (linkable.cpp:1259). That reads the map from
`collectExportedConstantInContainer`, which skips decls whose `val` is null (linkable.cpp:1203). The
header fold (check-decl.cpp:2782) runs before the initializer is checked and only for
`BasicExpressionType`. The body fallback (check-decl.cpp:3476 → :2273) returns null for enums and a
self-referencing `DeclRefIntVal` for extern int/bool. So the condition stays symbolic and
type-layout.cpp:5885 builds an empty layout. Affects all 5 targets. Wider than enums: any
non-literal extern int/bool initializer, plus link-time array sizes. Not a regression
(2026.5.2 → master). Related: #10387 (closed), #13420, #9855.

Approach A: in `SemanticsDeclBodyVisitor::checkVarDeclCommon`, link-time-fold the checked
initializer for const extern/export decls of int/bool/enum type. A reverted +13-line prototype fixes
every shape, including cross-module overrides. No new failures; unit tests 622/627 on both.
Known side effect: circular-decl E39999 is reported twice and must be reduced to once.

**State 2026-10-03 ~02:08Z:** triage comment
[5964413787](https://github.com/shader-slang/slang/issues/13419#issuecomment-5964413787)
(nv-slang-bot, 4116 chars). Labels: reproduced, reflection (+ human `Dev Opened`); Type=Bug.
**NO-GO ratified by Orchestrator**, matching #13420/#13336/#13337/#13048. slang-fixer holds the
briefing and prototype.diff (HELD).

**Resume on:** a PR from the assignee, a human comment asking for a bot PR (→ release the held
fixer briefing on the canonical thread), or closure.

**2026-10-07 re-chase (`…-b8bd`):** still silent. Issue OPEN, no comments after the triage, no PR
references #13419 (the nearby bot PR #13471 on link-time symbol conflicts closes #13319, not this
one). Sibling #13420 is equally quiet. Who did the assignment is unclear: the events API shows
`actor` pdeayton-nv with `assigner` jhelferty-nv, and the timeline shows actor jhelferty-nv.
Re-armed as `rechase-13419-assignee-85b0` (2026-10-14).

**2026-10-14 re-chase: the assignee opened a PR.** pdeayton-nv opened
[#13487](https://github.com/shader-slang/slang/pull/13487) "Fold extern constant initializers after
type checking" (fork branch `fix/extern-constant-folding`, head `78297ce5d`,
`closingIssuesReferences=[13419]`) on 2026-10-07. The PR is Approach A: it extracts a shared
`tryConstantFoldInitializer`, retries it in body checking after the initializer is checked, widens
the type gate to enums via `isValidSpecializationConstantType`, and suppresses the duplicate
circularity error. The diff is +143/-17 across 7 files, adding 4 SPIR-V/reflection tests and 1
diagnostic test. State on 10-14: open, not a draft, reviews requested from dshreiner-nv,
tangent-vector and jkwak-work, no human review yet. The github-actions bot review says 🟡 "5 gaps,
0 bugs". **No CI runs at all on the head SHA** (0 workflow runs, none awaiting approval;
mergeable=UNKNOWN). No issue comment asks for a bot PR, and jkwak-work removed `Dev Opened` on
10-08. Spin-off: pdeayton-nv filed #13534 (link-time constant rejected in `vk::binding`). The held
fixer briefing is superseded, and I don't comment on a human PR. Next one-shot:
`rechase-13419-pr13487-137f` (2026-10-21). It closes the chain on merge, and goes back to the triager
only if #13487 closes unmerged.

**2026-10-21 re-chase (`…-137f`):** #13487 is still open and not a draft. It was force-pushed to
head `53035c247` on 10-16, and CI has now run: 64 success, 11 skipped, and 1 **FAILURE** on
`test-falcor / Test (Falcor)` (not triaged). mergeStateStatus=BLOCKED. tangent-vector left 5
critical inline reviews (COMMENTED) on 10-16:
1. The specialization-constant type gate is "the wrong condition".
2. The complex boolean should be a named predicate.
3. The duplicate-error suppression "sounds like hackery".
4. The PR does not explain why it folds twice.
5. The doc-comment contract is wrong.

The author had not replied by 10-21, and dshreiner-nv and jkwak-work are still requested. #13419
is open with no new comments. If #13487 closes unmerged, these objections are the "what the human
PR learned" input that the triager must use to re-validate Approach A. That matters most for
objection 1 (our prototype used the same `isValidSpecializationConstantType`-style gate) and
objection 3 (our prototype has the same duplicate-E39999 side effect). Next one-shot:
`rechase-13419-pr13487-5716` (2026-10-28).

**2026-10-22 #13534 re-chase (`rechase-13534-0ba9`):** no change. #13534 has only the bot's 10-08
triage comment, no linked PR and no ask to the bot. The operator has not answered the
`PolynomialIntVal` FILE/SKIP question (re-asked 10-15, seq 503822), so it stays unasked and unfiled.
#13487's only new activity is the 10-16 tangent-vector reviews, already reported on 10-21, so I sent
no dashboard message. Next #13534 one-shot: `rechase-13534-3487` (2026-10-29).

**2026-10-28 re-chase (`…-5716`):** no change. #13487 is open and not a draft. Head is still
`53035c247` (last push 10-16), and mergeStateStatus has moved from BLOCKED to BEHIND. CI on that
head: 61 success, 11 skipped, 1 FAILURE on `test-falcor / Test (Falcor)`. It is still not triaged.
The job logs have expired (HTTP 410), there are no annotations and no failed step is named, so the
cause can only be read after a re-run. The author has not answered tangent-vector's 5 inline
comments. dshreiner-nv and jkwak-work are still requested. #13419 is open; its only comment is the
triage. The PR has been dormant 12 days. The 3-week dormant flag applies from 2026-11-06. One
dashboard line was sent. Next one-shot: `rechase-13419-pr13487-0327` (2026-11-04).
