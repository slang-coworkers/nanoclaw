---
type: chain
title: slang#13639 — WGSL push constants as var<immediate>
description: Human-filed WGSL bug (albertrodriguezclo). Fixed by community PR #13646 (merged 10-21); closed. Parked on one operator decision (edit stale line in triage cmt). Final reminder sent 10-24, no re-arm.
tags: [wgsl, emit, community-pr]
---

# slang#13639 — `[[vk::push_constant]]` → unbound `var<uniform>` on WGSL

**Filed** 2026-10-15 13:15Z by albertrodriguezclo (author_association NONE). One of the reporter's
WGSL batch (#13631–#13643), with each issue on its own chain. Thread `gh-issue-shader-slang/slang-13639`.

## State (10-15 14:25Z)

- **Triage:** slang-triager (sess `…84qb8s`) reproduced it on master `6597ec9202` and posted
  [cmt 6193417129](https://github.com/shader-slang/slang/issues/13639#issuecomment-6193417129).
  Labelled `reproduced`, Type=Bug. Cause: `WGSLSourceEmitter::emitParameterGroupImpl`
  (`slang-emit-wgsl.cpp:103`) has no push-constant case and always writes `var<uniform>` (line 173). I checked both.
  The recommended fix is Approach A: `var<immediate>` + `requires immediate_address_space;`, plus diagnostics for more than one
  push constant per entry point and for arrays.
- **Fix:** the reporter opened **community PR #13646** (`fix/wgsl-push-constant-immediate`, head `617ce62445`,
  non-draft, 14:03Z). Shepherd is jkwak-work, reviewer dshreiner-nv. It is the emitter half of Approach A (+23 lines, plus
  `tests/wgsl/push-constant-immediate.slang`), with no diagnostics. CI was 5 pass / 1 skipping when I checked.
- **slang-fixer** (sess `sess-1792071416881-ei6xkw`) held: **no PR**. Its local branch `fix/issue-13639` holds only the
  repro test `1245ebd1f1`. Its report (its finding, not re-verified by me): with #13646 applied, `tests/wgsl` passes 62/62 and naga accepts the output once the
  `requires` line is stripped. Gaps: no diagnostics, and it breaks 2 generated tests
  (`docs/generated/tests/conformance/basics-memory-model-address-spaces/push-constant{,-attr}-spirv.slang`, which still
  check `// WGSL: var<uniform>`). I confirmed `push-constant-spirv.slang:41` on master.
- **Stale public line:** the triage comment says "A draft PR will follow". That is no longer true, and updating it is gated.

## Pending operator decision

1. May the bot post one no-ping gap comment on #13646, and/or edit the stale line in the triage comment?
2. After #13646 merges, does slang-fixer open a follow-up PR (diagnostics + generated-test regen)?

**Follow-on [#13666](https://github.com/shader-slang/slang/issues/13666)** (10-15 17:05Z, reporter): a design question to maintainers on lowering arrays and matrices in `var<immediate>` (native mat / repack / diagnose). The reporter offers to implement it. This puts the array/matrix gap in public, raised by the reporter, so Decision 1 shrinks to the >1-push-constant and generated-test gaps, and the array/matrix part of Decision 2 is the reporter's while they own it. Routed to slang-triager on `gh-issue-shader-slang/slang-13666` (facts only, no choice on maintainers' behalf); I folded it into the re-chase task. **Triaged 17:52Z** ([cmt 6198651539](https://github.com/shader-slang/slang/issues/13666#issuecomment-6198651539)): Tint confirms both members fail. `bool` members fail too, and every float matrix shape is wrapped, because `shouldLowerMatrixType` (`slang-ir-lower-buffer-element-type.cpp:2613`) keeps matrices native only under `Natural` and the WGSL policy (`:3267`) doesn't override it. I verified both. Col-major needs `transpose()`. The comment asks maintainers Q1, Q2 and Q3, sets no labels, and also makes the >1-immediate gap public. **Decision 1 now covers only the generated-test gap.** **GPU re-verified 10-16 08:02Z** (L40S, Dawn Vulkan): no conclusion changed. Added evidence: native-matrix layouts and repacked arrays read back correctly, and the 80 B block fails pipeline creation (limit 64). `half` was not run (no `shader-f16`). The comment was edited in place; I checked `updated_at`. The triager holds its own re-check `t-4fcb40` for 10-22, plus `wt-13666` and `scratch-13666/`.

**10-21 01:51Z:** #13646 head is now `ef73fc8174`, a master merge from 10-18 with no change to the fix commit `617ce62445`. CI shows 60 pass and 1 fail: `check-pr-label`, because the PR has no `pr:` label. The `pr_ready_for_review` synchronize was NOT forwarded because slang-pr-approver is paused. It is queued in `data/approver-pause-queue.md`.

Re-check task: `rechase-13639-pr13646-cdc2`, one-shot 10-17 14:00Z. A webhook on #13646 or #13639 is the primary resume.

## Side finding: `__constref P` + `ConstantBuffer<P>` segfault (filing via triager)

`float f(__constref P c)` called as `f(cb)` with `ConstantBuffer<P> cb` gives a slangc segfault (exit 139) on every target.
My first attempt didn't reproduce because I declared the param as `__constref ConstantBuffer<P>`, which is the wrong shape and
exits 0. **With the fixer's shape I reproduced it 10-15 14:3xZ** on local Release slangc (the older `a916653b70` build) on wgsl and spirv.
The fixer also reproduced it on Debug at master `6597ec9202`. Crash site (fixer's gdb): `TypeFlowSpecializationContext::analyzeCall`,
`slang-ir-typeflow-specialize.cpp:4762`, BorrowIn case `as<IRPtrTypeBase>(argInfo)->getValueType()` with a null cast. I read that line on
master. Dedup: no matching issue. Possibly related open PRs on parameter-passing modes: #12575, #13406, #13213.
Precedent #13617 side ICE: a reproduced crash with no dup gets an orchestrator GO, the triager files it, and it stays unrouted.
**Filed as [#13656](https://github.com/shader-slang/slang/issues/13656)** by slang-triager, 10-15 14:34Z. It is Type=Bug with the `reproduced` label.
The triager re-reproduced it on Debug `6597ec9202`. Its controls all exit 0: a `__constref ConstantBuffer<P>` param, a by-value `P`, and a
local copy. Nearest neighbour is #8002 (`__constref ParameterBlock<T>`, open, an emit-time error and not a dup). **Unrouted**, following the
#13620 precedent: the fix-layer choice (front-end reject / coerce / typeflow) belongs to maintainers, and fixer dispatch is an operator GO.
Its issue_opened webhook is a self-echo owned by the triager session on this thread; dispatch nothing from it.

## 10-22 16:20Z — #13646 merged; #13639 closed

- **Checked on GitHub:** #13646 merged 10-21 05:12:05Z (`1299e871`, approved by jkwak-work). #13639 auto-closed COMPLETED at 05:12:07Z. #13715 merged 10-21 04:06Z (the triager wrote "10-20", which is wrong). The newest #13666 comment is still ours (6198651539). Generated-test regen is in our draft #13810.
- **#13666:** told slang-triager (msg 15, thread `…-13666`) to PATCH 6198651539 in place with its refresh draft, with #13715's date fixed and `gpuweb#5555` as inline code. I checked the draft's line refs against `0bd71cd70`.
- **#13639:** Decisions 1 and 2 are now mostly moot. The one open question, sent to the dashboard: may the bot edit the stale "A draft PR will follow" line in 6193417129? If yes, the fixer also deletes local `fix/issue-13639`, `wt-slang-13639` and `scratch-13639`. The fixer has no active-work sentinel. The triager's sentinel `active-work/shader-slang-slang-13639` stays until the operator answers.
- One-shot re-check `rechase-13639-stale-comm-d4d7` is set for 10-24 12:00Z.
- **10-22 16:32:33Z:** the triager PATCHed #13666 comment 6198651539. I checked it live: `updated_at` matches, there are 0 `@` mentions and no new comment, #13715 now reads "merged 2026-10-21", and both `gpuweb/gpuweb#5555` references are in backticks. Part (2) of the 10-24 re-check is already satisfied. Only the operator's #13639 decision is still open.

## 10-24 12:00Z: re-check `rechase-13639-stale-comm-d4d7` (the last one)

- **Operator decision:** I read the dashboard session's `--reverse --json --limit 300` rows (back to 10-22 12:49Z). There is no "go 13639" or "leave it", and no row after my 10-22 16:23Z ask (seq 507340) mentions 13639. I sent **one reminder** to orchestrator-dashboard (thread `gh-issue-shader-slang/slang-13639`, msg id 5) and **set no re-check**, as the task said. A dashboard reply is the only thing that resumes this chain.
- **Live GitHub check:** cmt 6193417129 is unchanged (`updated_at` 10-15 13:37:43Z), and line 4 still says "A draft PR will follow". #13639 is closed (completed) with 1 comment. #13666 is open, its only comment is 6198651539 (`updated_at` 10-22 16:32:33Z, so part (2) is satisfied and I sent no nudge), and maintainers haven't answered. Draft #13810 (generated-test regen) is open.
- **Still left behind:** the triager's sentinel `active-work/shader-slang-slang-13639`, and the fixer's local `fix/issue-13639`, `wt-slang-13639` and `scratch-13639`. All of them wait on the operator's go or leave-it.
- **When the operator answers:** for go, send the triager (thread `gh-issue-shader-slang/slang-13639`) the in-place edit of line 4 to *"Fixed by #13646 (merged 2026-10-21). Array, matrix and bool members in var<immediate> are tracked in #13666"*, with no mention, and tell it to drop its sentinel. Send the fixer (same thread) the cleanup. For leave it, tell the triager to drop the sentinel and make no GitHub write.
