---
type: chain
title: slang#13639 — WGSL push constants as var<immediate>
description: Human-filed WGSL bug (albertrodriguezclo). Triaged 10-15; fix owned by the reporter's community PR #13646; slang-fixer held with no PR. Parked on an operator decision about a gap comment and a follow-up.
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
