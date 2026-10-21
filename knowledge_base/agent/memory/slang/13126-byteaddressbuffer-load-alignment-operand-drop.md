---
type: chain
title: slang#13126 — ByteAddressBuffer.Load<S>() passed to a call segfaults (alignment operand dropped)
description: "specializeFuncsForBufferLoadArgs rebuilt ByteAddressBufferLoad with 2 operands, dropping alignment → OOB getOperand(2) in byte-address legalize → SIGSEGV. Regression (#8547 drop, #11595 made it fatal). DRAFT PR #13130, parked on maintainer review."
tags: [slang, byteaddressbuffer, specialization, ir, crash, regression]
resource: https://github.com/shader-slang/slang/issues/13126
---

# slang#13126 — ByteAddressBuffer.Load<S>() into a call segfaults

**State 2026-10-20 18:0xZ: fixer asked to merge master + re-dispatch CI (old run never auto-retried). Earlier: 2026-10-17 20:0xZ PARKED on humans (`falcor-ci` gate approval, then review). Peer review: final APPROVE.** DRAFT PR
[#13130](https://github.com/shader-slang/slang/pull/13130), head `a616bd3805` (round-3 nits), 0 behind / 6 ahead of
master (I checked with the compare API), `Fixes #13126`, labels `regression` + `reproduced` on the issue,
`pr: non-breaking` on the PR. Review requested from jhelferty-nv (CODEOWNERS); 0 human reviews.
CI: run `39056859021` was cancelled. Run `39063429240` (head a616bd3805) is `waiting`: `wait-for-human-priority`
and `check-ci` failed (the bot priority yield), and 44 jobs were skipped (I checked). Approving the `falcor-ci` gate does not
restart skipped jobs. **The repo needs green CI before ready-for-review, so the matrix must run while the PR is a draft.**
`gh pr ready` does not release it.

## Owners

- PR mapping → slang-fixer `sess-1789563539753-y5343h`, thread `gh-issue-shader-slang/slang-13126`.
- Triager session `sess-1789562643352-erls9c`. Issue artifact: triager comment `6237522353`
  (per-variant table, PATCHed 10-17 18:26Z, it is the newest comment).

## Mechanism (the triager's finding; I read the memo, I did not re-run it)

`input.Load<S>(0)` lowers to a 3-operand `byteAddressBufferLoad` (buffer, offset, alignment=0).
Passing the loaded struct to a call (a method, a free function, a generic `T:I`, an interface parameter,
`[noinline]`) runs `specializeFuncsForBufferLoadArgs`. Its rebuild in `slang-ir-specialize-function-call.cpp`
(about :911 and :933) hardcoded 2 operands. `slang-ir-byte-address-legalize.cpp:140` then reads `getOperand(2)`
out of bounds → SIGSEGV. The pass only runs when the struct is more than 16 bytes and contains an array
(`isTypePreferrableToDeferLoad`), which is why `float[5]` crashes and `float[4]` does not.
Bisect: #8547 introduced the drop; #11595's explicit-alignment check made it fatal.

## Fix (PR #13130)

The fixer keeps all trailing operands in the rebuild and keys the specializations on them too, which also
stops a `LoadAligned` miscompile that depended on source order. A `SLANG_RELEASE_ASSERT(operandCount==3)` in
the legalizer makes the failure loud instead of hiding it. 6 files, +267/−3. The fixer reports these tests:
the `.get()` repro, a call-argument test covering all 5 call paths plus 3 more layouts (cpu + vk + cuda on the
L40S + spirv -O0), and 2 tests for the LoadAligned key and natural alignment. A/B: every crash row fails
10/10 on master and passes 10/10 on the PR. 6 negative controls give byte-identical output to master.

## Timeline

- 09-16 12:43Z issue_opened (Rexagon, external) → triager; 12:58Z [Triage] Bug/high/IR/P2. GO on Approach A.
- 09-16 16:59Z draft PR #13130 opened; regression bisected and labeled; the triager suggested P2→P1 (a
  project-board field, which we do not set).
- 10-17 17:18Z albertrodriguezclo (external) comment `6237446868`: the crash happens for any call that takes
  the struct as an argument, plus a layout table → routed to the triager (msg 19).
- 10-17 18:26Z [Triage Resolution]: the PR head fixes every variant, and the fix needed no change. The
  generic and interface paths go through the same specialization.
  The fixer **merged origin/master instead of rebasing** to avoid a force-push (jhelferty-nv asked for
  merge-from-master over force-push on #12194). I accepted that.
- 10-17 19:4xZ round-3 review APPROVE_WITH_NITS (0 bugs), nits in a616bd3805. A new shape was found: any struct
  >128 B with no array is also specialized (size rule in `isTypePreferrableToDeferLoad`). The triager reproduced
  a 144 B all-`uint4` crash on unfixed Release; it was added to the call-arg test. Affected set: >16 B with an
  array, OR any struct >128 B. Issue comment 6237522353 PATCHed.
- 10-17 19:57Z slang-reviewer final APPROVE @a616bd3805: #13126 tests 12/12, sweep 1662/1662; every alignment shape
  that passes the front end compiles on the head and crashes master (reviewer's claims, I did not re-run them). One >100-col nit was left on purpose.
  My 19:5xZ dashboard ask for a human CI re-run was wrong; I corrected it at 20:0xZ.

## Waiting on

- ~~CI re-run is automatic~~ **WRONG (found 10-20):** `retry-yielded-bot-ci.py` lists only `status=completed`
  workflow_dispatch runs with `--lookback-hours 16`. A run stuck `waiting` on the `falcor-ci` env gate is never
  completed, so it is never a candidate. 39063429240 sat `waiting` 70 h (44 skipped). ⇒ **A bot draft run that is
  `waiting` needs a fresh dispatch, not the hourly retry.**
- Human: a `ci-approvers` member approves the `falcor-ci` gate. Neither we nor the fixer can do this.
- Then green CI → ready-for-review → maintainer review (jhelferty-nv).
- Operator: the P2→P1 priority bump (project board).
- Re-check: one-shot task `rechase-13126-pr13130-*` at 10-23 18:00Z.

## 10-20 18:0xZ re-chase

Still draft, head `a616bd3805`, 7 behind / 6 ahead, 0 human reviews, no human comments since 10-17 19:55Z. Operator
did not answer the two 10-17 asks (falcor-ci approval, P2→P1); not re-asked. I asked the fixer (pinned session,
canonical thread) to merge origin/master (merge commit), dispatch a fresh draft CI run, and mark ready when green.
Dashboard told, with a correction of the auto-retry claim.
