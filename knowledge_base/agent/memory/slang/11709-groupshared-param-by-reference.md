---
type: chain
title: slang PR #11709 — groupshared parameters by reference (fix for #10641)
description: MAINTAINER-DRIVEN since 10-28 — jhelferty-nv pushed her own rework (head 18be59a493, 64 commits, on top of the merged #13406) after the operator never answered the rebase question; the bot stands down (no push/rerun/post) unless a maintainer asks it directly. Earlier HELD-until-#13406 history below. Owned (mapping) by slang-fixer; jhelferty-nv CHANGES_REQUESTED still sticky.
tags: [slang, frontend, param-passing-mode, groupshared, maintainer-driven]
resource: /workspace/extra/ephemeral/prod-groups/slang-fixer/reports/comments/11709-vs-13339-plan-report.md
---

# slang PR #11709: groupshared parameters by reference

Owner: `slang-fixer`, thread `gh-issue-shader-slang/slang-11709`. The original owner session
`sess-1785902924001-jylfb4` ran out of budget on 2026-10-09 03:46Z. Head `cddb935c48` (09-30), non-draft,
CHANGES_REQUESTED by jhelferty-nv (review 5354344993). Companion issue
[#13339](https://github.com/shader-slang/slang/issues/13339) (a `const __ref` interface-conformance gap) was filed
by slang-fixer and is fixed by PR **#13406**. Older history lives in the imported leaf
[[imported/project_11709_groupshared_byref.md]].

## Current state (2026-10-28): maintainer-driven, bot stands down

- 10-28 16:15Z: jhelferty-nv pushed her own rework to #11709. The new head is `18be59a493`, with 64 commits and
  `mergeable_state=behind`. Her last three commits are "Report the HLSL groupshared parameter error from an IR
  check", "Warn on partial groupshared writes in differentiated code" and "Drop the explicit groupshared inlining
  passes for WGSL and GLSL". So the rebase-or-stand-down question I asked the operator on 10-22 and 10-24, which
  was never answered, is moot.
- CI on run 40726217239 is red on `test-slang` (linux gcc debug/release, windows gpu debug/release). A `ci_failed`
  webhook reached slang-fixer on `…-11709/13406-resume`. The fixer judged it not actionable because the head is
  maintainer-driven, and did not push, rerun or post.
- **The rule from here:** the bot makes no push, rerun or post on #11709 unless a maintainer asks it directly.
  The unpushed P1 autodiff fix and the open items below are hers to take or leave. The pr-mapping still points at
  the exhausted `sess-1785902924001-jylfb4`, which doesn't matter while the bot stands down.

## Earlier state (2026-10-11)

- **The hold.** jhelferty-nv decided on 10-01 to implement the split on #13339
  ([5932748637](https://github.com/shader-slang/slang/issues/13339#issuecomment-5932748637)). On 10-02 she said to
  keep the `const groupshared` change in #11709
  ([5957659185](https://github.com/shader-slang/slang/issues/13339#issuecomment-5957659185)). So #11709 waits
  for #13406 to merge.
- **#13406.** On 10-09 02:33Z jhelferty-nv answered every open question (review 5465076473): A
  (`Access.WriteOnly = 3`), `r_`/`ro_`/`wo_` mangling, and E30119 checked in `coerce()`. The implementation is 7 local
  commits on `797b7e096f`, ending `d2891fd3ca` + `4c7b17dcf2`, in `wt-slang-13339`.
  - The work resumed in a fresh session, `sess-1791517792695-dth1ak`, on sub-thread `…-11709/13406-resume`
    (msg 2239). It got her review verbatim and a 9-item checklist; items 1, 7 and 8 are still open (module version,
    commit order, `const` reflection).
  - `pr-mappings remap` for #13406 (`appr-1791517835370-iwgn54`) was **approved and executed 10-15 10:00Z**. It changed nothing, because the mapping already pointed at `dth1ak`. **#11709 itself still maps to `jylfb4`**, the old session that ran out of budget.
  - **r5 PUSHED 10-09 08:49Z**, head `4e2603652e`. Verified on GitHub:
    - A fast-forward of 5 commits on `797b7e096f`, with no force-push and every commit under App identity `274397474`. The 7 local commits were rewritten into 5 before the push.
    - All checklist items are resolved: module v35, reflection `const`, commit order, and the R19 read gaps (swizzles, `switch`, receivers, the `__subscript` getter).
    - Suite 7744/7745 (gfx-smoke env), unit 629/629 (adds `irBlobRejectsVersion34`). Reply [6077629359](https://github.com/shader-slang/slang/pull/13406#issuecomment-6077629359) with no pings; explain-diff 6002932281. slang-reviewer peer review requested.
    - Five questions back to her:
      1. the GLSL `writeonly` param as a location, and `writeonly` buffer reads now E30119 where master accepted them;
      2. E30119 on `inout`;
      3. E30035 vs E30034;
      4. a write-only argument to a `__ref_readonly` param;
      5. the `t.Load()` gap.
    - Her CHANGES_REQUESTED still stands. The branch is BEHIND master, and CI is running.
- **10-11 state.** Round 3 (`7e683a211b`) is pushed, and the GCC flag is split out to draft **#13570**. #13406 head `2781df933e` reverts the flag, so SlangPy is red there **by design** until #13570 merges and the owner merges master. #13570 has slang-reviewer APPROVE_WITH_NITS (nits applied, `bffd07cc1b`). **Un-drafting #13570 is the operator's call** (named 10-11, dashboard msg 19). The remap `iwgn54` is still pending. Detail is in the review-rounds file.
- **10-14 state (verified with gh at 09:00Z).**
  - The operator decision went away on its own: jhelferty-nv merged master into #13570, readied it 10-13 19:47Z, and merged it at 22:16Z (`7d7ad3bbfe`); jkwak-work APPROVED (5509318075).
  - Within a minute the Orchestrator dashboard session dispatched a **sibling** slang-fixer session, `sess-1791929861310-3xpxb6` (thread `gh-issue-shader-slang/slang-13406`, not `dth1ak`'s), to merge master. It pushed **`7c962f27a7`** at 22:18Z: a fast-forward, App identity, no conflicts.
  - At that head: SlangPy Tests green, all ci.yml jobs green, `check-ci` rerun green at 23:30Z, mergeState BLOCKED only on her CHANGES_REQUESTED, 2 behind master.
  - 4 open threads (4168522180, 4168540023, 4198094764, 4198335992), all with our reply last. No maintainer review or comment since 10-11 00:26Z apart from one thread resolve on 10-13.
  - `dth1ak` is cost-escalated ($160.75 / cap 150 / ceiling 300). I told it (pinned, msg 59) the merge was done and to fast-forward its worktree without pushing.
  - ⇒ **#13406 now waits only on jhelferty-nv's re-review.**
- **Since 10-15 jhelferty-nv owns #13406, and on 10-16 she told the bot to stand down there.** Detail is in the review-rounds file.
- **10-19: jhelferty-nv filed follow-ups #13747–#13749** (self-assigned; #13749 is the HLSL `inout` emit for a `[noRefInline]` `__ref` param, citing #13406/#13728). The bot holds: no dispatch, no post. 10-23 20:45Z: on #13749 jhelferty-nv chose "restrict `[noRefInline]` to intrinsic declarations" (the current behavior is by design); labeled Typesystem, no bot mention, still held.
- **Timer: none is scheduled.** `rechase-13406-r7-c566` fired 10-17 09:00Z. Live gh showed #13406 OPEN at head `c5511be7a1` (her commit 10-15 20:31Z, "Require -experimental-feature for __ref_readonly in user code"), DIRTY, still CHANGES_REQUESTED, and not merged. Under the stand-down that means no dispatch, no report and no reschedule. **No timer re-checks it now.** Its merge is noticed only through an event (the #13406 pr-mapping still points at `dth1ak`) or a supervisor tick. Before any bot action on #11709, ask the operator whether her stand-down covers #11709 too, then rebase onto her final spellings.

## What #11709 does when the hold lifts

1. **Push the unpushed P1 fix:** `9230f147c1` (fix + `tests/autodiff/groupshared-param-no-diff-direct-diff.slang`)
   and `50c003155a` (nits), suite 7185/7187. Disclosed in
   [5918943205](https://github.com/shader-slang/slang/pull/11709#issuecomment-5918943205).
   - The regression came from round-3 peer review at `cddb935` (09-30): REQUEST_CHANGES with one 🔴 regression
     against master. Applying `fwd_diff`/`bwd_diff` to a function with a `no_diff [const] groupshared float a[4]`
     parameter fails spirv-val ("OpLoad Pointer … is not a logical pointer"), and CUDA emits `(**&s_0)[_S1]`.
   - The verified producers: `populateParams` had no `RefParamType` branch, so fwd lowered the argument as an
     r-value load. The other was the PR's own bwd `Ref`→by-value `no_diff T` mapping.
2. **Rework onto the split modes** (the fixer's plan):
   - drop the `isReadOnlyGroupSharedParam` matching and lowering in favor of the mode;
   - use `IRBuilder::getRefParamType(…, access, …)` and `ParameterDirectionInfo.accessQualifier`;
   - keep `HLSLGroupSharedModifier` in the synthesis clone list;
   - map `const groupshared` → `RefReadOnly` here, because on master `getExplicitlyDeclaredParamPassingMode` has
     no groupshared branch;
   - add `const groupshared`/`groupshared` matching tests in both directions;
   - rebase over `transposeDirection`'s Ref case, and over #13232, which is now on master.
3. **Test expectation flips.** `tests/diagnostics/groupshared-param-requirement-qualifiers.slang` accepts
   `ReadsOnly : ISharedWrite` today: a `const groupshared` method satisfies a `groupshared` requirement because
   it asks for less. Exact mode matching turns that into E38108 (verified at `cddb935c48`, disclosed in
   [5934711587](https://github.com/shader-slang/slang/issues/13339#issuecomment-5934711587)).
4. **Ask, don't assume:** should `__ref_readonly` have a groupshared analogue? After her 10-08 reversal, `readonly`
   is GLSL-only again.
5. The PR description lists one known limitation: the whole-array load and bwd checkpoint are valid but
   copy-heavy. There is no baseline to compare against, because master ICEs here.
6. Then one delta-only slang-reviewer review.

## Open #11709 maintainer items

| Item | State |
|---|---|
| [r4141296596](https://github.com/shader-slang/slang/pull/11709#discussion_r4141296596): release assert (a)/(b) for pre-PR `.slang-module`s | open |
| [r4139502685](https://github.com/shader-slang/slang/pull/11709#discussion_r4139502685): E30709 warning vs error | open |
| jhelferty-nv CHANGES_REQUESTED (5354344993) | sticky until she re-reviews |
| `__constref groupshared` A/B (r4137802265) | **closed**: "(A)" at r4138118657, implemented in `c18511b5ef` (E30712) |

## Design background (09-30)

tangent-vector set the direction on #13339
([5916124244](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916124244),
[5916469853](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916469853)). `const` on a parameter is
a binding modifier, and `__ref` is a passing mode, not a type. Near term, `ParameterPassingMode::Ref` splits into
`RefReadWrite`/`RefReadOnly`/`RefWriteOnly`. #11709's commit 84fa791 compares read-only-ness as a side predicate,
and only for `groupshared` params (`slang-check-decl.cpp:5437-5445`), so the split subsumes it. The rework-or-hold
call belonged to the maintainers, not the operator.

## Lessons

- A re-chase timer's premise can be overtaken by another Orchestrator session. On 10-13 the dashboard session handled
  #13570's merge and the #13406 master merge live, three days before `r6` fired. Before acting on a timer's case, check
  the head's commit log and find which session pushed it (`ncl sessions list --agent-group-id <fixer>` around the
  commit time). Don't redo the work.

- My earlier "no other session holds the reversal" was wrong. `ncl sessions list --limit 2000` truncated away the
  owner, which was created 2026-08-05. Look up a known owner with `ncl sessions get <sid>`, and check that a reply
  landed with `ncl sessions messages <owner> --reverse --limit 3`.
- An `in_reply_to` reply to a session whose reports carry a different thread than its own gets rejected by the D1
  cross-thread guard, and the fall-through mints a phantom session. Send to the owner pinned, on its own thread.
  The 10-09 incident is in the review-rounds file.
- An SDK budget exhaustion can leave cost-cap at `escalated` and never `stopped`. A watcher gated only on `stopped`
  never fires.
- My dispatch note said the A/B question was open when it had been answered a day earlier. The fixer caught it.
  Re-check a thread's state live before carrying it forward in a note or a timer.
