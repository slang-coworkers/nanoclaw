---
type: chain
description: slang#13489 — CLOSED 2026-10-16 (COMPLETED). Two PRs from one issue, both merged by skiminki-nv. #13502 (Case 1, accessor error escape) merged 10-09; #13514 (Case 2, a throwing call nested in a try operand, A3) merged 10-16 after a merge-queue stack-overflow fix. Only open item: the operator's call on an optional nits follow-up PR.
---

# slang#13489: accessor errors, and throwing calls nested in a `try` operand

- **Reporter:** skiminki-nv, the same person who filed #13488 and #13490. The chain runs on thread
  `gh-issue-shader-slang/slang-13489` through slang-triager (session `sess-1791394833851-gewv4z`).
  Both PRs are owned by slang-fixer session `sess-1791396610056-rbcjnl`.
- **PR 1, #13502 (Case 1):** branch `fix/issue-13489-accessor-error-type`, head `299ab675f5`,
  labelled `pr: non-breaking`. skiminki-nv approved it 2026-10-08 08:12Z. At 18:20Z its CI was
  64 pass / 0 fail and it was MERGEABLE but BLOCKED, with dshreiner-nv's review request still
  pending. It had not been queued.
- **PR 2, #13514 (Case 2), draft:** branch `fix/issue-13489-nested-try`. The maintainer ruled
  **A3** in cmt 6059079948 (10-08 11:41Z): identity conversions (`try int(f())`, `try (int)f()`)
  keep compiling, and the label goes back to `pr: non-breaking`. They tied the rest of `try`
  coverage to #13491.
- **Stall, 2026-10-08:** the fixer received the triager's A3 handoff (11:43Z) and slang-reviewer's
  REQUEST_CHANGES on `0e511df1c6` (12:48Z: 0 bugs, 1 test gap, a test conflict with #13503). It
  then emitted nothing, while not cost-stopped. At 18:20Z the head was still `0e511df1c6`,
  labelled `pr: breaking change` and BEHIND master. I nudged the triager once (msg 27, pinned).
- **Body form:** both PRs say "Part of #13489". #13514 switches to `Fixes #13489` only after
  #13502 merges.
- **Next:** task `rechase-13489-a3-push-7be1` at 2026-10-08 22:30Z. If #13514 still hasn't
  moved, escalate to the operator instead of nudging again.
- **2026-10-09 14:38:31Z: PR 1, #13502, MERGED** (skiminki-nv, `19c885a5fd`). Its 11:23Z group run 37923422416 had failed `check-ci` at 13:30Z on the zstd tarball, yet it merged at 14:38Z. It got past that failure because #13481's group run 37933324356, stacked on `19c885a5fd`, passed at 14:38:03Z, and the queue merged both PRs together at 14:38:31Z. #13481's merge commit `ae6d699352` has parent `19c885a5fd`. The babysitter found this and I checked the shas; the queue rule itself is inferred (the required-check config is 403). The next group run on top of it (#13503's, `08d419cbf2`) was all green, so master is fine. PR 2, #13514, is the open item: waiting on spec#63 and the stopped reviewer. Tracked by `rechase-13489-gates-ddd2` (10-11 13:30Z).
- **2026-10-15: #13514 evicted from the merge queue on a real merged-tree failure (checked live).** skiminki-nv enqueued it at 12:09Z. Group run 38732512843 failed all four Windows **debug** `test-slang` legs with test-server exit `-1073741571` (0xC00000FD, stack overflow) on 13 tests in `intrinsic-texture.slang` and `intrinsic-texture-ignore-capability.slang`, and it was removed with `failed_checks` at 13:21Z. skiminki-nv re-enqueued it at 13:26Z (run 38742775510). The branch's merge base `f6a839924a` predates #13537 (`a5a87a1236`), which rewrote both test files, so PR CI never ran them. The babysitter's hypothesis, not reproduced: #13514's per-level `SemanticsVisitor` copies grow the debug stack frame. Sent to owner `rbcjnl` (msg 2663): merge master, reproduce on Debug, fix the frame growth at the root (no stack-size bump, no test skip), push once.
- **10-15 14:37Z: second eviction** (run 38742775510), same stack overflow, as predicted. **15:32Z: fix pushed, head `5f037faedd`** (checked live). The owner merged master (base `6597ec9202`, so it includes #13537) and made 2 commits: `OperandTryCoverageRAII` sets and restores the try state in place instead of copying the context per frame, and `SemanticsContext` bool fields are packed back to 168 B. No stack-size or test change. The fixer measured on Linux Debug: 896 B per `&&` level on master, 1440 B before the fix, 928 B after. The minimum stack for `intrinsic-texture.slang.0` is 399 KB on master, 559 KB before, 415 KB after. Windows is not verified locally. Cause comment posted 15:53Z. CI on `5f037faedd` was in progress at 16:10Z (40 success, 14 pending), with the falcor gate waiting. A maintainer has to re-enqueue once it's green.
- **2026-10-16: CLOSED (checked live).** skiminki-nv re-approved `5f037faedd` at 08:48Z (review 5545254185) and re-enqueued at 08:49Z. Group run 38876244118 passed; it skips `test-falcor`. The PR-event `test-falcor` failure on run 38762064336 is external: unrelated #13510 failed the same job. **#13514 MERGED 10:04:11Z (`ec39d3af67`); #13489 auto-closed 10:04:13Z, COMPLETED.** The fixer's L40S GPU re-run after the operator's GPU notice: 131/131 (57 vk, 66 cuda). The fixer removed its worktree and sentinel. Re-chase task `rechase-13489-mq-8835` cancelled.
- **Left open, the operator's call (named on orchestrator-dashboard 10-15 and 10-16):** an optional follow-up PR for slang-reviewer's 5 R2 nits on #13514: skip the follow-on E30094 when the outer call already failed, turn the dead settle calls into asserts, add nested-list and lambda-argument rows, pin E30091 in the conversion-operand test. Cleanup only, no correctness gap. Don't start it without the operator's go.
- **Lessons:** (1) A PR's own CI can miss a merged-tree failure when master rewrites a test after the branch's base. The merge queue caught it here (debug-only Windows stack overflow). (2) A maintainer's short answer ("No" / "Correct") is narrower than the rule we generalize from it. The A2 extension (making `try int(f())` an error) had to go back to them as a question, and they chose A3, the non-breaking option.

- **TERMINAL 2026-10-16 10:04Z (checked live).** skiminki-nv merged #13514, and #13489 auto-closed at 10:04:13Z. The merge-group run 38876244118 succeeded, including the Windows Debug `test-slang` legs, so the `5f037fa` in-place try-coverage fix is confirmed against the stack overflow. Both PRs of this issue are merged (#13502 on 10-09, #13514 now). The bot posts and closes nothing.
