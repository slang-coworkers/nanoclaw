---
type: chain
title: slang#13011 + #13061 — optional-constraint lookup leak (E99997 / missing diagnostic)
description: Same root cause. Lookup items reached through `where optional T : I` are not filtered. Parked 26 days on a self-imposed ownership blocker. 10-26 the leftover operator gate was withdrawn and a no-ping notice dispatched. Draft PR on/after 10-30 unless an assignee objects.
---

# slang#13011 + #13061

**Bug.** `where optional T : __BuiltinFloatingPointType` (or `IFloat`) plus arithmetic type-checks and then
aborts with `E99997 Unexpected context type for parameter info retrieval` (#13011, assignee saipraveenb25).
The integer form compiles with zero diagnostics (#13061, assignee jvepsalainen-nv). The inherited
`T : IArithmetic` witness is a plain `DeclaredSubtypeWitness` on the interface's `$inheritance` decl and
carries no optional marker. Because of that, `isWitnessUncheckedOptional` / `filterLookupResultByCheckedOptional`
(`slang-check-expr.cpp` ~:1315 / :1361) treat it as proven.

**Maintainer words (verbatim):**
- jvepsalainen-nv, #13061, 09-17 (issuecomment-5714677653): "@nv-slang-bot please fix this issue."
- jkwak-work, #13011, 09-14: "@saipraveenb25 can you review the issue and give us some suggestion on how to proceed?"
- saipraveenb25, #13011, 09-30 (issuecomment-5915553083): "Yes, the correct fix is to properly filter lookup items if they are reached through optional constraints."

**Sessions.** triager `sess-1789135097069-89mbif` (13011; posted 5915974415), fixer `sess-1789136060057-ex6aw0`
(13011, held since 09-11), fixer `sess-1789383381900-1pnntc` (13061; 09-17 instrumented findings, staged tests,
posted 5715284503).

## Timeline
- 09-30: the bot's offer 5915974415 asked for draft-PR ownership and a layer. It set a public blocker: "No draft PR until saipraveenb25 confirms ownership and jvepsalainen-nv confirms whether overlapping work is in progress."
- 10-03 → 10-19: five re-chases, all silent. On 10-09 the operator got an A/B ask (dashboard msg 17: A = draft PR, B = @-mention ping). No answer.
- **10-26 (round 6):** still silent on GitHub and on the dashboard (full-text read to seq 508206). No overlapping PR from either assignee.
  **The A/B ask was withdrawn as a leftover gate:** draft PRs and no-ping comments are not operator-gated ([gating leaf](../imported/feedback_github_writes_operator_authorized.md)).
  The triager was dispatched (a2a msg 31, pinned) to re-verify on master and post one no-ping notice: draft PR on/after 10-30 unless an assignee objects.
  Re-check `rechase-13011-3fa9` runs 10-30 16:00Z and releases the fixer if nobody objects.
  The notice posted as **6420926462** (16:10:28Z, nv-slang-bot, 0 @-mentions; Orchestrator checked it live). The triager re-verified that master `52e29ab43bf4` is **not fixed**: E99997 still fires, and the guard has moved to slang-check-expr.cpp:1348/:1394. The fixer's WIP tests are on `fix/issue-13061` @ 99f24277ec.

**Lesson (an instance of the leftover-gate sweep):** this re-chase prompt was written on 10-19, before the 10-20 → 10-24 sweeps, so they missed it. It parked a draft PR for 4 weeks behind an operator A/B ask whose menu had no no-ping option.
