---
type: chain
title: slang#14103 — IGlobalSession::parseCommandLineArguments returns SLANG_OK for invalid arguments
description: "Human bug (pdeayton-nv, `bot-ok`) 10-30 20:32Z: `-target` with no value → parseCommandLineArguments still succeeds. Dispatched to slang-triager 10-30 on gh-issue-shader-slang/slang-14103."
tags: [slang, api, command-line]
---

# slang#14103

**2026-10-30 20:32Z, webhook `issue_opened`.** Human-filed by pdeayton-nv, label `bot-ok` → R6
hold exempt (the triager may comment now). Repro: `parseCommandLineArguments(1, {"-target"}, …)`
prints `accepted`; expected `rejected`. Env: Slang v2026.20.

Pre-dispatch checks: `grep -rl 14103 memory/` → no hits; the only session on
`gh-issue-shader-slang/slang-14103` was this Main webhook session. `gh` search: related but not
duplicates — #8453 (OPEN, matrix layout not set) and #8963 (CLOSED, multiple targets mis-parsed).

Orchestrator pointer (unverified, master d34a5eb54d): `Session::parseCommandLineArguments`
(`source/slang/slang-global-session.cpp:1153`) calls `tempReq->processCommandLineArguments(argv, argc)`
at :1163 and discards its `SlangResult`; the function then always returns `SLANG_OK`. The
diagnostics also go to the temp request's sink, so the caller cannot see them.

Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-14103` (10-30).

**Triage (10-30 20:42Z, slang-triager).** I checked comment 6533041941: nv-slang-bot, 20:41:57Z, Type=Bug,
labels `reproduced` + `bot-ok`. Bug/medium/P2, not a regression (since #3598). Reproduced on d34a5eb54.
- Rec A: `SLANG_RETURN_ON_FAIL` at :1163, null `*outAllocation`, doc note in slang.h, plus unit-test cases.
- Option B (return diagnostic text) needs new API surface. That is a maintainer question, asked in the comment.
- The triager reports these become FAIL: `-target`, `-bogus-option`, `-target bogus`, `-profile`, and also
  `-stage compute` without `-entry` (E00033) and a non-adjacent duplicate `-target` (E00050).
- #8963's argv stays OK.
- `gh search code` found no caller in slangpy or slang-rhi.
- Memo: inbox `a2a-1793392964572-qg96ni/triage-14103.md`.

**Routing (mine, 10-30 ~20:50Z).** pdeayton-nv self-assigned at 20:32:36Z. Same rule as #14101: no fixer without
the reporter's go-ahead. I told the triager to:
- edit its comment in place: ask the assignee "bot draft PR (A) or self-implement?", and add the
  E00033/E00050 rows to the table, because they are behavior changes;
- schedule a one-shot re-check for 11-03 16:00Z.

On a go-ahead, the fixer brief (Approach A) goes to slang-fixer through the triager.
PARKED on the reporter.

**Parked (10-30 20:49Z).** I checked the edit myself:
- cmt 6533041941 was edited 20:48:12Z. It has the E00033/E00050 rows and the assignee question.
- The issue still has 1 comment.

Triager one-shot **`recheck-14103-assignee-79b9`** runs 2026-11-03T16:00Z (its session is on `system:tasks:recheck-14103-assignee-79b9`).
- The edit's @-mention sends no notification.
- My ruling: no fresh ping now. The reporter is the author and the assignee, so they got a notification for the 20:41Z comment.
- At the re-check, if there is no reply, the triager posts ONE short fresh comment with the question. After that it does not re-ping.

**GO (10-30 21:20:58Z).** pdeayton-nv (reporter and assignee) wrote in [cmt 6533708092](https://github.com/shader-slang/slang/issues/14103#issuecomment-6533708092):
"@nv-slang-bot , please generate a draft PR / Let's not worry about a new API for the diagnostic text at this point."
- This is a real bot mention, so GitHub posting is authorized.
- Option B is out of scope by the reporter's direction.
- I routed the go-ahead through the triager, which holds the brief and owns the fixer handoff.
- The triager sends Approach A to slang-fixer on `gh-issue-shader-slang/slang-14103`, as a draft PR on branch `fix/issue-14103`, and cancels `recheck-14103-assignee-79b9`.

**Fixer started (10-30 21:23Z).** slang-fixer sent me an ack directly, not through the triager. Its worktree is `wt-slang-14103` on `fix/issue-14103`, base e638298fe. It writes the repro unit test first, then makes the fix.

**Handoff (10-30 21:26Z, triager).** The brief went to slang-fixer. The triager cancelled `recheck-14103-assignee-79b9`.
- I checked that the triager posted a fresh delta [cmt 6533791303](https://github.com/shader-slang/slang/issues/14103#issuecomment-6533791303) (21:25:45Z). The issue now has 3 comments.
- My instruction said to "update in place". That was wrong, because the reporter had commented since. The standing rule is: when someone else has commented, post a fresh delta. The triager was right to override me.
- Next: the triager reports when the draft PR opens.

**Cascade (10-30 22:26Z, the fixer's finding).** Fix A regresses three in-tree tests:
- (1) `tests/compute/mutating-methods.slang` passes `-xslang -serial-ir`, which is a removed option (E00017).
  This is a test bug that #14103 had masked, so the arg is dropped.
- (2), (3) `numeric-extrema-nan.slang` and `min-max-builtin-arithmetic-shaped-nan.slang` use
  `-Xslang -floating-point-mode precise` with no target, which gives the zero-target "ignored" diagnostic
  (`TargetFlagsIgnoredBecauseNoTargets`; the profile analog is `ProfileSpecificationIgnoredBecauseNoTargets`,
  slang-options.cpp ~4640-4672).

I checked the code myself (master d34a5eb54d):
- The parser already saves the default-target options for a later `addCodeGenTarget()`. See
  slang-options.cpp:5066-5072, consumed at slang-end-to-end-request.cpp:1342 (`_completeTargetRequest`).
- `parseCommandLineArguments` serializes the same options (slang-global-session.cpp:1177).
- So the premise "ignored" is false outside slangc. The existing signal is `m_isCommandLineCompile`, set by
  `setCommandLineCompilerMode()`, which slangc main.cpp:25 calls.

My ruling 22:3xZ:
- The fixer's plan (gate those diagnostics on command-line mode) is principled.
- Use the existing flag; don't add a new one.
- State the side effect on the deprecated `ICompileRequest` path.
- Present it as a review question, not a merge blocker.
- Fixer status goes to its parent (the triager), which sent the handoff.

Fixer session: `sess-1793395338785-cyyd6y` (its parent edge is the triager).

**Draft PR #14111 (10-30 23:4xZ).** https://github.com/shader-slang/slang/pull/14111. I checked it live:
- OPEN, draft, author app/nv-slang-bot, `fix/issue-14103`, head 8c2926caea, `pr: non-breaking`, 7 files.
- The review request to pdeayton-nv came from github-actions[bot] (auto), not from the fixer.
- CI on the draft: 3 pass, 53 skipping (draft priority yield).

Five commits:
1. repro test;
2. 5ed82ade5, render-test device cache keyed by global session;
3. drop `-serial-ir`;
4. zero-target "ignored" checks only when `m_isCommandLineCompile` is set;
5. return the parse result.

Commit 2 is justified in its message. A cache hit reused a device built on the shared session, so a test
with `-load-core-module` failed (`tests/serialization/std-lib-serialize.slang.4`, llvm). #14103 had hidden
that failure. It is a third cascade, fixed at the producer, so it is in scope.

Fixer suite result: 11333/11336. The 3 fp8-cuda failures also fail on the base.
Explanation comment: 6535595823. Issue cmt 6533791303 was edited in place → "fix in draft PR #14111".
The triager admits its "no change" table missed all three breaks; it has recorded the lesson.

Next:
- Peer review (slang-reviewer).
- pdeayton-nv reviews the draft and flips it to ready. That step belongs to a human: fixers cannot flip drafts.
- PR webhooks route to the fixer via `report_pr_created`.

The reviewer question is the side effect on the deprecated ICompileRequest path.

**R1 peer review (10-31 00:26Z, slang-reviewer): REQUEST_CHANGES (small) @ 8c2926cae.** The review is in inbox
`a2a-1793406367305-cyzghb/combined-review.md`. It was sent to the fixer and to me, and was not posted to GitHub.

- **B1 🔴:** gating E00042 (the profile "ignored, no targets" check) hides two cases:
  - conflicting default-target profiles (`-profile sm_5_0 -profile glsl_450` → OK, last one wins silently);
  - a lone non-inferring profile (`-profile spirv_1_6`), which `Linkage::addTarget` overwrites unconditionally.
    I verified this at slang-session.cpp:201 `optionSet.setProfile(Profile(desc.profile))`. FP mode is overridden
    only when it is not the default, so the premise holds for E00044 only.
  - ⚠️ **My 22:3xZ ruling caused this:** I told the fixer to "cover both" diagnostics. That was wrong for profiles,
    and I retracted it 10-31.
- **Remedy:** keep E00042 ungated; gate only E00044 (`>1 targets || m_isCommandLineCompile`).
- **Tests:** G1 adds slangc test `target-flags-ignored.slang`. G2 adds 4 end-of-parse API rows.
- **Nits:** N1–N4.
- **Results:** remedy full suite 11116/11119 (only fp8-cuda fails); drills justify every change.
  Devin's `-xslang` flag is refuted.

**Lesson:** before telling a fixer to widen a gate to a sibling diagnostic, trace that option's consumer through
the API path, here `Linkage::addTarget`. A matching diagnostic name does not mean the semantics match.

**R1 fixes pushed (10-31 00:59Z).** I checked: head 27a627a073, 7 commits, a fast-forward with no force-push, still a draft.
- E00042 is ungated again (base behavior). Only E00044 is gated on `m_isCommandLineCompile`.
- New test `target-flags-ignored.slang`.
- Fixer full suite 11335/11338 (the fp8-cuda failures are pre-existing).
- Issue cmt 6533791303 edited in place 00:59:09Z.
- slang-reviewer R2 is pending, then the `[Fix Report]`, then `[Triage Resolution]`.
- After that, HELD on pdeayton-nv to review and flip the draft to ready.

**R2 peer review (10-31 01:06Z): APPROVE @ 27a627a07.** 0 findings; the code matches the tested remedy; not posted to GitHub.
Next: the fixer sends its `[Fix Report]` and the triager sends `[Triage Resolution]`. Then HELD on pdeayton-nv (review + ready flip; this is a human step).
TODO on the Resolution: make sure the park has a timer, either a one-shot re-check or the supervise register.

**Triage Resolution (10-31 01:12Z).** The triage side is closed. Draft PR #14111 is at head 27a627a07, 8 files, +167/−11.
The issue comment (cmt 6533791303) says "held for review".
- Fixer: all 182 render-test `-Xslang` arg sets are accepted; clang-format is clean.
- PR CI: the build/test jobs have not run (draft priority-yield).

**PARKED on pdeayton-nv.** They need to:
- review #14111;
- answer the E00044 deprecated-API question;
- confirm `pr: non-breaking`;
- un-draft the PR. Un-drafting is human-only.

Timer: Main one-shot **`recheck-14111-ready-af0a`**, 2026-11-04T01:15Z (read back via `ncl tasks list`).
I sent the decision to orchestrator-dashboard on 10-31.
