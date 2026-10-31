---
type: chain
title: slang#13011 + #13061 — optional-constraint lookup leak (E99997 / missing diagnostic)
description: Same root cause. Lookup items reached through `where optional T : I` are not filtered. Parked 26 days on a self-imposed ownership blocker. 10-26 the leftover operator gate was withdrawn and a no-ping notice posted. 10-30 nobody objected, so slang-fixer was released for a draft PR (Fixes both).
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

- **10-30 (round 7, release):** No human reply on either issue since notice 6420926462, and no linked PR. No overlapping PR from either assignee: saipraveenb25's #13961/#13884/#13854 are autodiff, jvepsalainen-nv's #13784/#13760/#13759 are CI/perf. No master commit since 10-20 touches the filter. The fixer was released (a2a msg 17): pinned to `ex6aw0` with `in_reply_to=2` (my own task row), and it landed at seq 10, acked seq 13 at 16:03Z. The ask: DRAFT PR, `Fixes #13011` + `Fixes #13061`, GPU-free tests, saipraveenb25's direction, reuse the 13061 session's WIP. Never ready/merge/close, no @-mentions. Next: the draft PR + `report_pr_created`; a silent fixer is chased by the supervise tick.

- **10-30:** Draft PR **#14096** (`fix/issue-13011` @ e5d69b3, Fixes #13011 + #13061) is owned by fixer `sess-1789136060057-ex6aw0`. slang-reviewer found a constructor-lookup leak and slang-triager verified it at b2dabac6d: `lookupConstructorsInType` (slang-check-overload.cpp:3054) skips `filterLookupResultByCheckedOptional`, so `T(1)` and `(T)1` compile silently under a direct optional constraint and hit E99997 under an inherited one. **Orchestrator decision: fold it into #14096** (fixer msg 53). Reasons: it falls inside saipraveenb25's direction, the PR has no human review yet, and `Fixes #13011` is incomplete without it.

- **10-30 19:20 (head be8a102):** the constructor fold landed, and a round-1 review was addressed. The PR is labeled `pr: breaking change`, and its body has an `Open question (blocks merge)` on extensions for the maintainers. The body now says `Part of #13011` + `Fixes #13061`. **Remaining gap:** a guarded inherited use with a non-conforming T still hits E99997 in IR. **Orchestrator decision (fixer msg 61):** no follow-up issue. #13011 stays open to track the gap. It becomes a separate follow-up PR after the maintainers answer on #14096, root-caused then. Full Debug suite 11313/11316 (only the 3 fp8-cuda failures, same as master).

**Lesson (an instance of the leftover-gate sweep):** this re-chase prompt was written on 10-19, before the 10-20 → 10-24 sweeps, so they missed it. It parked a draft PR for 4 weeks behind an operator A/B ask whose menu had no no-ping option.
