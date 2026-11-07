---
type: chain
title: slang#14151 — Metal SV_GroupIndex subscripts a scalar SV_GroupThreadID (`gtid[2]`)
description: Human-filed (albertrodriguezclo, CONTRIBUTOR, cloth-sim batch) Metal bug 2026-11-02 10:04:22Z. Invalid MSL from emitCalcGroupIndex reusing a narrowed SV_GroupThreadID param. Triaged P2, reproduced. FIXED on master by jkwak-work PR #14326 (merged 11-05 02:01Z, 6b0467fb2; replaces reporter #14169), verified by triager 11-06. Issue still OPEN (no closing keyword); Fixed-by note posted 11-06 10:23Z (cmt 6682628231), no close, no mention. TERMINAL on our side; maintainer closes.
tags: [metal, system-values, r6]
---

# slang#14151 — Metal `SV_GroupIndex` with a narrowed `SV_GroupThreadID`

**Bug (reporter's analysis; not reproduced by me).** On Metal, `SV_GroupIndex` is computed from the group thread ID
(`emitCalcGroupIndex`, `slang-ir-legalize-varying-params.cpp`). The `GroupIndex` branch reuses
`findSystemValueParam(entryPoint, GroupThreadID)` without checking its type. A user `uint gtid : SV_GroupThreadID`
is later narrowed (`gtid_1 = gtid_0.x`), and the group-index calc ends up as `gtid_1[int(2)]` → Apple metal:
"subscripted value is not an array, pointer, or vector". slangc returns 0. Existing tests that hit it:
`tests/metal/thread_position_in_threadgroup.slang` (lane `-D GROUPID`, FileCheck text-only so it passes) and
`tests/language-feature/system-value-extraction.slang` (`-mtl` lane disabled). Reported on master `6815ed82d`.

**GitHub (11-02 10:0xZ).** 0 comments, no labels, no Type. Dedupe: `gh search` for "SV_GroupIndex metal" and
`emitCalcGroupIndex` PRs → nothing. **R6:** no `bot-ok`; the fences hold MSL compile errors, not a crash word →
hold until **2026-11-06 10:04:22Z** (comments, PRs and commits naming #14151).

**Adjacent.** Same file and Metal system-value legalization as [#14034](14034-workgroupcount-cuda-metal.md) and
[#14136](14136-metal-threads-per-threadgroup.md) (same reporter); watch for edit-site overlap if fixers run.

**Dispatch (11-02).** slang-triager on `gh-issue-shader-slang/slang-14151`, with the R6 hold stated. Owner: slang-triager.

**11-02 10:08Z (triager's report; not reproduced by me).** Reproduced on master 6815ed82d, with MSL identical to the report. The triager is still checking parameter order, the other derived SVs, and the CUDA/CPU paths.

**11-02 10:20Z: triaged (triager's findings; I verified only the GitHub state).** Bug, medium, P2. Type=Bug and `reproduced`
are set and there are 0 comments (verified 10:2xZ). Not a regression; the synthesis dates from #4536 (2024-07).
- **The bug depends on parameter order.** It fires only when `SV_GroupIndex` comes before an `SV_GroupThreadID` with fewer
  than 3 components. `uint`/`int` give a hard MSL error. `uint2`/`int2` give a **silent out-of-bounds `gtid_1[2]`**, which is a
  wrong value and is not in the report. `uint3`, or gtid declared first, are correct. The live `-mtl` lane in
  `compute-system-values.slang` declares gtid first, which is why CI never hit this.
- No other target or derived SV is affected (SV_InstanceID reuse is correct). The sites are `slang-ir-legalize-varying-params.cpp:4768-4851`
  (the GroupIndex branch) and `:3040-3060` (the retype and redirect in `legalizeSystemValue`).
- **Fix options.** **A (rec.):** map to native `[[thread_index_in_threadgroup]]` and delete the ~90-line synthesis. This follows
  the dispatched size, which ties it to #14136's decision (3), so it needs a maintainer. **B2:** legalize the reused gtid before
  building the calculation. That keeps the `[numthreads]` value and has no blocker.
- **Overlap.** Reporter PR **#14148** (for #14136): its hunk at :4466 sits near A's site and may cause a trivial textual conflict.
  Our draft #13940 is near B's site.
- **No fixer dispatched.** R6 blocks a PR until 11-06, and the reporter ships their own PRs. I put the fixer go and the A/B2
  choice to the operator on 11-02. The triager's one-shot **i14151-r6-recheck-e401** runs 11-06 10:10Z: if a reporter PR
  exists, verify it and don't post; otherwise re-verify and post the held draft.
- Memo: `/workspace/inbox/a2a-1793614835371-ftd1ki/triage-14151.md`. The held draft is in the triager's group at `memory/issues/comment-14151.md`.

**Reporter PR (supervisor tick 321).** albertrodriguezclo opened [#14169](https://github.com/shader-slang/slang/pull/14169) (`Fixes #14151`) at 11-02 10:44Z. It is non-draft and BLOCKED, waiting on a maintainer review. No bot fixer: the R6 release one-shot must reconcile with this PR instead of posting a planned fix.

**11-04 (approver webhook).** #14169 is now CLOSED unmerged. jkwak-work (MEMBER) opened [#14326](https://github.com/shader-slang/slang/pull/14326) at 22:05Z as its replacement. It keeps #14169's first two commits and replaces the approach with two-pass ordering in `legalizeSystemValueParameters` (SV_GroupIndex goes last), which is the triager's option B2 in spirit. It has no `Fixes #14151` keyword, and #14151 is still OPEN. CLA pending; CI otherwise green. Its `pr_ready_for_review` was not forwarded because the approver is paused; it is queued in `data/approver-pause-queue.md`. A maintainer is driving the fix, so no bot fixer. The 11-06 recheck i14151-r6-recheck-e401 should reconcile with #14326, not post the held draft.

**11-04: a maintainer owns the fix (verified on GitHub 11-04 23:5xZ).**
- The reporter opened **#14169** ("Metal: compute SV_GroupIndex from the full uint3 SV_GroupThreadID", `Fixes #14151`) on 11-02 10:44:37Z.
  It was closed unmerged 11-04 22:08:18Z.
- **#14326** by jkwak-work (MEMBER, assigned to #14151) was opened 11-04 22:05:48Z, non-draft, head branch `review-pr-14169`:
  "Metal: legalize SV_GroupIndex after the other system values". It keeps #14169's tests (`tests/metal/group-index-narrow-group-thread-id.slang`
  and the Metal lane of `system-value-extraction.slang`), and its body calls itself "an alternative to #14169". **The body does not say
  `Fixes #14151`.**
- Triager's correction: #14326 is option **B1** (a second pass for `SV_GroupIndex` after every other SV), not B2 (only the reused gtid first).
  B1 also moves clip/cull distance, inner coverage and instance ID. `SV_InstanceID` was tested in both orders and is correct.
- **The fixer question is moot.** The operator never answered my 11-02 ask (dashboard seq 510002). I withdrew it on 11-04.
  A sibling Main session posted #14326 to the dashboard at 23:50Z (seq 510930).
- The triager re-scoped `i14151-r6-recheck-e401` (11-06 10:10Z): build #14326's head, run the 12-case order matrix, the clang check, and the
  metal, compute and mesh `SV_GroupIndex` suites; check against the memo's acceptance criteria; **post nothing**, including about the missing
  closing keyword. It sends a per-criterion `[Report]`. Whether to mention the missing `Fixes #14151` is open; decide when that report arrives.

**11-06 10:2xZ: recheck i14151-r6-recheck-e401 reported (triager's findings; I verified only the GitHub state).**
- #14326 MERGED 2026-11-05 02:01:22Z as `6b0467fb2` (verified live). `closingIssuesReferences` is empty. #14151 is OPEN, 0 comments,
  assignee jkwak-work (assigned by `github-actions[bot]` 11-02 10:44:59Z, so not self-assigned), milestone Q4 2026.
- Triager built 6b0467fb2 vs 6815ed82d: all 12 order-matrix cells give valid MSL (baseline had 4 bad); the new test's gi-first lanes fail
  pre-fix (revert drill); the re-enabled `-mtl` lane of `system-value-extraction.slang` passed on macOS CI; 885/885 in the metal/compute/mesh
  suites. Criterion (4), tightening `thread_position_in_threadgroup.slang`, was not done; the new test covers it, so it does not block.
- **Decision (mine, no operator ask):** the bot chain had no artifact on #14151, so per GitHub-as-system-of-record the triager posts ONE short
  "fixed by #14326 (6b0467fb2)" note, with no @mention and no close. Closing stays with the maintainer. No re-check timer. Sent to the triager
  as an in_reply_to reply on its report (msg 3).
- **11-06 10:23Z: posted (verified live).** nv-slang-bot comment [6682628231](https://github.com/shader-slang/slang/issues/14151#issuecomment-6682628231)
  says the fix is in #14326 (6b0467fb2), gives the order-matrix and macOS CI evidence, and says there was no closing keyword. It has the AI-disclosure footer
  and no mention. The issue is still OPEN, waiting on jkwak-work. **TERMINAL**: no timer. A human comment reopens the chain through its webhook.
