---
type: chain
title: "slang#14214 — SPIR-V: a constant resource choice across a helper call / struct copy → E56004"
description: Human-filed (pdeayton-nv, `bot-ok`; assignees pdeayton-nv + tangent-vector) bug 2026-11-03. Triaged bug/medium/P2. 11-06 STOOD DOWN (rung 4, overlaps tangent-vector draft PR #14358) after an in-place triage update.
tags: [slang, spirv, opaque-types, resources, E56004, constant-folding, ssa, pdeayton-nv, bot-ok]
---

# slang#14214 — constant resource choice not folded on SPIR-V

**Ask.** `Texture2D t = chooseA ? texA : texB;` in a helper fails E56004 on `-target spirv-asm`
even though the call site passes a literal `false`. `[ForceInline]` on the helper fixes the
scalar-argument case. When the condition comes from a `bool` field of a struct returned by a
`[ForceInline]` helper, it still fails with both helpers forced inline. Expected: fold to `texB`.
Reported on v2026.20.

**Related.** [#14101](14101-spirv-select-independent-resources.md) (same reporter): a *runtime*
selection between independently declared resources. It is parked on a duplication-policy choice.
#14214 is the constant-condition case, which should fold with no runtime selection. Also
[#13685 / #14076](13685-undefined-texture-phi-fold.md) (same E56004 family). No memory hit on
14214 and not bot-filed, so no existing chain owns it.

**Routing (11-03 ~00:10Z).** Live: open, 0 comments, no labels, assignee pdeayton-nv (the reporter).
Only session on the thread was Main's `sess-1793664453323-t1hvlj`. Dispatched to slang-triager on
`gh-issue-shader-slang/slang-14214`. R6: no `no-bot` label, so posting is allowed now. The reporter
is the assignee, so no fixer without the reporter's go-ahead (as on #14101).

**Triager progress (11-03 00:10–00:11Z; triager's finding, not verified by me).** Both repros reproduce on ToT.
IR dumps show two separate gaps. (1) Call case: the helper stays out of line, so `chooseA` is never folded.
(2) Struct case: `Args a` stays a memory var (`store(get_field_addr(a), false); get_field(load(a))`), so the
condition is never seen as constant. 00:13Z: also fails on v2026.20 and v2026.13.1 binaries, so not a regression. The 5-bullet report is pending.
00:18Z (triager): both gaps confirmed in source. (1) The fixpoint at `slang-ir-specialize-resources.cpp:2030` has no
fallback that inlines a callee whose resource selection it cannot resolve. (2) `isPromotableVar` at
`slang-ir-ssa.cpp:503` lists field-store chains as not yet implemented. Memo + comment draft + OUTPUT_REVIEW in progress.

**Triage (11-03 00:25Z, slang-triager).** Comment 6592023541. I checked: nv-slang-bot posted it at 00:24:34Z.
Type=Bug and `reproduced` were added by the bot. `bot-ok` was added by pdeayton-nv at 00:09:03Z.
Rated bug/medium/IR/P2. Reproduced on ToT 96a728c85, v2026.20 and v2026.13.1, so not a regression.
Separate from #14101 and should land before it: a constant condition removes the dead arm at compile time.
Also fails on GLSL/WGSL (E56004) and Metal (E56019). HLSL compiles but keeps the runtime branch.
- **A1 (calls):** add a third fallback to the `specializeResourceUsage` fixpoint. It inlines direct callers of
  functions whose selection stays unresolved, gated to targets that reject opaque locals.
- **A2 (structs):** add SSA partial-store promotion (field store → `updateElement`) for constant access chains.
- Two separable PRs, A1 first. Alternatives: clone-specialize on literal arguments; a narrow pre-SSA struct rewrite.

PARKED on pdeayton-nv: self-implement, or a bot draft PR? A bot-PR request comes to Main for a go before
any slang-fixer handoff. The triager's one-shot is **t-815b50 (2026-11-06T16:10Z)**, separate from t-5434f7.
Memo: inbox `a2a-1793665525724-or4ie6/triage-14214.md`.

**11-06 16:23Z, t-815b50 result (triager's finding, not verified by me).** Nothing changed on the issue. Built tangent-vector's
draft **PR #14358** (head f8c828a7f, `Fixes #14101`; it also edits `slang-ir-specialize-resources.cpp`). With it, all 10 repro
variants compile on SPIR-V and pass spirv-val; GLSL compiles with warning E56021. WGSL still gives E56004 and Metal E56019.
The constant is still not folded: texA is loaded behind `OpBranchConditional %true` and stays bound. If #14358 lands, the work left
is the fold plus WGSL/Metal, and A1 would be mostly redundant on SPIR-V/GLSL.
**Correction (I checked it live ~16:24Z):** the assignees are **pdeayton-nv AND tangent-vector**. pdeayton-nv assigned tangent-vector
on 11-03 00:08:53Z; jhelferty-nv had assigned pdeayton-nv at 00:07:42Z. Earlier lines above, which name only the reporter, were wrong.
**Decision (Main, 11-06 16:24Z):** the note goes on #14214 only, as an in-place "Update 2026-11-06" edit of 6592023541 (facts only, no
@mentions, OUTPUT_REVIEW first). Nothing goes on #14358: it is a human draft and nobody asked for a comment there. After that the bot
**stands down**, rung 4, maintainer-held, as on #14101. No fixer, no bot PR, no timer. Webhooks reopen it on a human comment or a
mention. Sent to triager task session `sess-1793665494184-5v2c48` (row 8, verified).
**11-06 16:31Z, DONE (I checked: nv-slang-bot, updated_at 16:31:03Z, still the only comment).** 6592023541 now opens with "Update 2026-11-06:
overlap with #14358" (OUTPUT_REVIEW round 3). A2 is not affected (#14358 does not touch `slang-ir-ssa.cpp`); whether the fold still needs A2 is untested.
Triager state: its `memory/issues/14214.md`; PR build at triager `wt-14358`. **Terminal on our side; webhooks reopen.**
