---
type: chain
title: slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum
description: Triaged + reproduced (not a regression); front-end link-time constant folding misses checked initializers. Self-assigned by the reporter, so NO-GO; fixer briefing + prototype held
tags: [slang, frontend, reflection, link-time-constants, conditional, parked]
resource: /workspace/inbox/a2a-1790993201805-3bhx61/triage-13419.md
---

# slang#13419 — `Conditional<CB, externEnum != X>` loses binding (parked on author)

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
fixer briefing on the canonical thread), or closure. Re-chase `rechase-13419-assignee-b8bd`
(2026-10-07).
