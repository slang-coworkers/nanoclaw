---
type: chain
title: slang#11550 — synthesized struct initializer debug info (merged fix, now disputed)
description: Bot fix PR #11555 (b9fd870, merged 2026-06-26 by szihs) suppresses debug info for synthesized ctors. 2026-10-30 tangent-vector says the old behavior is "in the general case, not a bug" (C# steps into synthesized ctors). Maintainers disagree. Reporter asked for a FlagArtificial tracking issue; triager filed #14107 10-30. Terminal for the bot.
tags: [debug-info, spirv, synthesized-ctor, maintainer-dispute, terminal]
---

# slang#11550 — synthesized initializer debug info

## History

- Filed 2026-06-11 by pdeayton-nv. Triaged and reproduced by the bot: the synthesized `$init` gets a
  `DebugFunction` on the struct line and `DebugLine`s on the member lines.
- Fix: bot PR #11555 (`fix/issue-11550`). It adds `isSynthesizedConstructorDecl` in
  `slang-lower-to-ir.cpp` and gates `maybeAddDebugLocationDecoration` + `maybeEmitDebugLine` on it.
  kaizhangNV said "The fix makes sense to me". Merged 2026-06-26 by szihs as `b9fd870`. Issue closed 06-29.
- Owner sessions: slang-fixer `sess-1781168276909-z6nru8` (active, stopped). The triager session
  `sess-1781166576394-l1xm5i` is closed.

## Code that now depends on the fix (checked on origin/master 2026-10-30)

- Bot PR #11815 (#11565, `94d4e4736`) reuses the predicate to keep a synthesized ctor's object from being
  named `this` (`slang-lower-to-ir.cpp` ~14342). I first credited #12148 here. That was wrong: a shallow-clone
  blame boundary (`^0864e60e63`). slang-triager corrected it. #12148 does not touch the predicate.
- zangold-nv's #12896 (09-09) added `tests/debuginfo/debug-no-step-into-ctor.slang`, an SPVDB debugger
  test. It cites b9fd870/#11550 and requires that a spvdb `step` (step-**into**; `next` is step-over) at `Foo f = {..}` lands on the next user line.
- `git apply -R` of the original diff does **not** apply cleanly on master. A revert must be done by hand.

## 2026-10-30 dispute

tangent-vector, https://github.com/shader-slang/slang/issues/11550#issuecomment-6530362127 (verbatim):

> I'm frustrated because I would consider this behavior to be, in the general case, not a bug. If we
> look at languages like C#, their debugging experience does exactly this thing of treating a
> synthesized constructor like a callee function and single-stepping through initialization logic in
> the body of the type itself.

The comment does not mention @nv-slang-bot, so there is no post authorization. The maintainers
disagree: kaizhangNV approved the fix, zangold-nv pinned it with a debugger test, and tangent-vector
objects. Decision for the operator: (a) stay out and let the humans settle it (recommended), (b) one
short factual bot comment (what #11555 changed, the dependent tests/#12148, and an offer to do a revert
or rework PR), or (c) have the fixer prepare a revert/rework PR now. No coworker was dispatched.

Re-check: one-shot task `slang-11550-maintainer-r-e7d6`, 2026-11-03 18:00Z.

## 2026-10-30 21:25Z — reporter asks the bot for a tracking issue

pdeayton-nv, https://github.com/shader-slang/slang/issues/11550#issuecomment-6533793139 (verbatim):

> @nv-slang-bot , could you create a new issue tracking emitting SPIR-V `FlagArtificial` for synthesized
> functions instead of not emitting debug info?

This is a real bot mention, so a post is authorized. I found no existing issue (search "FlagArtificial").
Following the precedent that the triager files follow-up issues, I dispatched slang-triager on thread
`gh-issue-shader-slang/slang-11550`. The ask: file ONE tracking issue (no fix, no PR), then post a short
reply on #11550 that links it. Mostly this replaces operator options (a)–(c): the disagreement now moves to
the new issue. The re-check task stays as a backstop.

## 2026-10-30 21:42Z — tracking issue filed (chain terminal for the bot)

slang-triager filed **#14107** ("SPIR-V debug info: emit synthesized functions with `FlagArtificial` instead of no
debug info", Feature, opened by the bot 21:40:58Z) and replied on #11550 (comment 6534062517). I verified both.
The issue states both sides neutrally and lists 4 open questions. The spec defines `FlagArtificial = 1 << 5` but
says nothing about stepping, and `slang-emit-spirv.cpp:11004` always writes 0 for DebugFunction Flags. The
direction on #14107 is the maintainers' call. Nothing is pending on the bot, so I cancelled re-check
`slang-11550-maintainer-r-e7d6`; webhooks deliver any mention.

## 2026-10-30 21:45Z — #14107 `issue_opened` webhook (no dispatch)

The bot-filed `issue_opened` for #14107 reached Main. It is this chain's own artifact, so I made no dispatch.
I briefly made a replacement re-check (`slang-14107-11550-rechec-bc69`) without seeing the 21:42Z section
above. When I saw it, I cancelled the task. The sibling ruling stands: terminal for the bot, and webhooks deliver any mention.
If a maintainer later decides the design, fixer work goes on thread `gh-issue-shader-slang/slang-14107`.
