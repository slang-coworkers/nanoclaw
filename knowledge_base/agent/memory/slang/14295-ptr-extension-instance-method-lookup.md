---
type: chain
title: slang#14295 — instance methods from an extension on a pointer type are not found on a pointer value
description: Maintainer (jkwak-work) self-filed + self-assigned 2026-11-04 04:30Z, found while working on #14292. 11-04 16:34Z jkwak-work asked @nv-slang-bot to triage and make a PR -> RESUMED: slang-triager dispatched on gh-issue-shader-slang/slang-14295 (post-authorized), fixer handoff via the triager.
tags: [frontend, lookup, extension, pointer, maintainer-owned, dispatched]
---

# slang#14295 — `extension Ptr<int> { int g() }` then `p.g()` → E30027

**11-04 04:30Z, `issue_opened`.** Live read (11-04): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work at filing (timeline `assigned` 04:30:02Z), 0 labels, 0 comments.

**Ask.** Member lookup on a `Ptr<T>`/`T*` value only finds members of the pointee; extension members on the
pointer type itself are missed (static `Ptr<int>.g()` and generic-call `callF(p, …)` work). Reporter's guess:
the fallback in `_lookUpMembersInSuperTypeImpl` (`slang-lookup.cpp`). Exposed because
`tests/bugs/ptr-extension-this-type.slang` (#7719/#7656) was passing on a `CHECK: 1` that matched
`result code = 1`; [#14292](14292-slang-test-exit-code-all-test-types.md) disables it with a TODO pointing here.

**Dedupe (11-04):** no open duplicate. Related, closed: #10962 (`DescriptorHandle<T>` instance member lookup
searched `T` instead of the handle type) — likely the nearest prior fix shape if this is ever dispatched.

**Disposition: held, nothing dispatched or posted.** Same pattern as the jkwak-work self-filed series
(#14248, #14266, #14292); #14247 showed a bot fixer on such an issue gets closed as overkill.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. No timer (mentions arrive as webhooks).

**11-04 16:34Z — RESUMED.** jkwak-work [comment 6636111507](https://github.com/shader-slang/slang/issues/14295#issuecomment-6636111507): "@nv-slang-bot can you triage and make a pr?" Dispatched slang-triager on `gh-issue-shader-slang/slang-14295` with `<github-post-authorized />`; the maintainer's ask covers the PR, so the triager hands off to slang-fixer (draft PR; it must re-enable `tests/bugs/ptr-extension-this-type.slang`). No prior triager/fixer session on this thread.

**11-04 16:43Z — TRIAGED** (slang-triager, [memo](raw/triage-14295.md)): bug/medium/frontend/P2, reproduced on master
3da6f63c0 (all 5 forms + `p->g()`). Triager's finding: the root cause is `maybeDereference` (`slang-check-expr.cpp:8417`, from
`:9367`) rewriting `p` to `*p : int` before lookup, so lookup's existing pointee-then-pointer fallback
(`slang-lookup.cpp:587-623`) never runs; the static path works via `NoDeref` (`:8907`). Not by design for `Ptr<T>`
(the #10962 by-design decision is DescriptorHandle-only and stays untouched). Recommended approach A: on a miss, retry lookup on the
un-dereferenced `Ptr` with `NoDeref` and build on the original base. Triager owns the fixer handoff (sent 16:43Z) and the issue
post + `reproduced` + Type=Bug. **Watch:** the test is disabled by jkwak-work's open PR **#14299** (not on master); the
fixer must re-enable it whichever lands first. Triager's checkout: Debug build fails at objcopy `.debug_str` (it used a
Release build; local to the triager, disk 66%, not a fleet alert).

**11-04 16:45Z.** Triage posted ([comment 6636378502](https://github.com/shader-slang/slang/issues/14295#issuecomment-6636378502)), `reproduced` + Type=Bug. slang-fixer claimed: worktree `wt-slang-14295`, branch `fix/issue-14295` @3da6f63c0. Next: draft PR (approach A); the triager sends `[Triage Resolution]` after the `[Fix Report]`.

**11-04 18:40Z — DRAFT PR [#14317](https://github.com/shader-slang/slang/pull/14317)** (verified live: OPEN, draft, `fix/issue-14295` @b920f0375, `pr: non-breaking`). Files: `slang-check-expr.cpp` +85/-24, `slang-check-impl.h` +41/-6, `tests/bugs/ptr-extension-this-type.slang` +2/-2 (CHECK tightened to `result=1` so it can no longer match `result code = 1`; on master the test is not disabled), new `tests/diagnostics/pointer-extension-member-not-found.slang` and `tests/language-feature/extensions/ptr-extension-instance-member.slang`. Fixer reports cpu/vk/cuda pass and the full suite has only the 3 known fp8-cuda failures. #14299 still OPEN (not merged), so the two PRs conflict on the test file and need ordering. Ready-flip pending (weekly list; jkwak-work, who asked, reviews). Fixer issue comment 6638955457. `[Fix Report]` not yet received.

**11-04 18:42Z.** Fixer report: full suite 11733/11736 (3 known fp8-cuda), CI dispatched, `[Fix Review Request]` sent to slang-reviewer; `[Fix Report]` follows the reviewer verdict. `->` skips the pointer it dereferences.

**11-04 20:15Z — R1 REQUEST_CHANGES** (slang-reviewer, [combined review](raw/slang-14317-r1-combined-review.md), head b920f03).
🔴 B1 (reviewer-confirmed on cpu/vk/cuda): with an interface pointee (`IFoo* nextEntry(); nextEntry().tag()`) the pointer
expression is evaluated twice, because `maybeOpenExistential`'s `let tmp = *e` stays in the expr-local scope after the
base is swapped back to `e`. A tested remedy patch (+185/−8; helper `isMemberOnlyOnDerefedPtrTypes`, new test
`ptr-extension-interface-pointee.slang`) went to the fixer. 🟡 G1–G3 pins (level order, `->` rule, mutating/property/
generic) are in the patch. ❓ Q1/Q2: a pointee member of that name, visible or not, hides the pointer levels (state it in a comment). Reviewer's
suite with remedy: 11517/11520 (3 known fp8-cuda). Not posted to GitHub. PR CI is skipped because the PR is a draft (53 jobs), so local
runs are the only evidence. **Merge-order trap:** #14299's `DISABLE_TEST` line merges with no textual conflict, so
whichever of #14299/#14317 lands second must delete it by hand, or the test is silently disabled again. Next: fixer R2 + new
`[Fix Review Request]`.

**11-04 20:43Z — R2 pushed** (verified: head d7b13fda7, draft, 7 commits, no force-push). Three commits: the B1 fix (the reviewer patch minus its default params), the test pins, the comments. Fixer: PR tests 8/8 cpu/vk/cuda, suite 11736/11739 (3 known fp8-cuda). The `->` rule changed: `pp->g()` works, and `->` also skips a ConstantBuffer level in front of the pointer (in the PR description). R2 is the last review round allowed; next is the reviewer R2 verdict, then `[Fix Report]`.

**11-04 21:30Z — R2 APPROVE_WITH_NITS** (slang-reviewer, [combined review](raw/slang-14317-r2-combined-review.md), head d7b13fd). 0 bugs; B1 is verified fixed (`nextEntry` runs once); `pFoo.extra()` is still 7. Suite 11517/11520 (3 known fp8-cuda), static unit tests 61/0. Nits: a tests-only patch (+85/−1, new `tests/diagnostics/pointer-extension-member-rebound-base.slang`) + comment nits N2–N5 (rename `outermostLevel`→`firstSearchedLevel`). No further review round. Out of scope and disclosed: `operator()` in `extension Ptr<S>` reports "no call operation found". Next: the fixer applies the nits, then `[Fix Report]` → triager `[Triage Resolution]`; then the draft waits on jkwak-work (ready-flip pending, weekly list). #14299 is still open; the second to land removes the DISABLE_TEST line.

**11-04 22:10Z — RESOLVED on the bot side; READY-FLIP PENDING.** Final head **1fd61c1f7** (verified: draft, 7 files +587/−32). The nits are applied, and the triager sent `[Triage Resolution]` (22:09Z). The fixer comment on the issue (6643111808) shows the final state. Codex code-review approved. CI: 4 pass, 53 skipping (`wait-for-human-priority` skips on a draft). The fixer's "retry-yielded-bot-ci will rerun" is not reliable (see [supervise-tick-pull-pitfalls](../orchestrator/supervise-tick-pull-pitfalls.md)): CI runs only after a human marks the PR ready. Parked on jkwak-work; webhooks deliver the review and ready events, and the PR is on the weekly ready-flip list (supervisor-state `readyFlipPending`). No timer.
