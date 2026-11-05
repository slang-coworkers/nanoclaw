---
type: chain
title: slang#14321 — `-g` ICE E99997 "no outer func at use site for global" when a struct `static const` passes a uniform to a `[ForceInline]` function
description: Bot-filed (slang-triager) 2026-11-04 20:23Z as the split-out commit 2 (`b5ff14441`) of #14238 / draft PR #14267. Do NOT dispatch its issue_opened webhook. The #14238 triager starts the fixer chain on gh-issue-shader-slang/slang-14321.
tags: [debug-info, force-inline, static-const, metal, cpp, cpu, internal-error, split-out]
---

# slang#14321: `-g` global-scope inlining copies debug insts into module scope (E99997)

⚠️ **Its `issue_opened` webhook belongs to the [#14238 chain](14238-int-div-forceinline-global-const-regression.md),
so do not dispatch it.** Main session `sess-1793823804267-zosxb5` was minted for the webhook. It sent only one
dashboard ack, and the issue was not dispatched.

**Why it exists.** Main decision (b), 11-04 20:1xZ, in the #14238 chain: commit 2 of #14267 (`b5ff14441`,
which skips the debug-inst clone during global-scope inlining) fixes an independent ICE on master. So it moves
to its own issue and PR, and #14267 reverts it.

**Bug (triager-reported).** `struct Holder { static const int kSum = addOne(divisor); }`, where `addOne` is
`[__readNone] [ForceInline]` and `divisor` is a uniform. With `-g`/`-g2`, cpp, CPU (`shader-sharedlib`) and
Metal give E99997. It compiles without `-g`, with `-g1`, and on cuda. The module-scope `static const` form gives E31226
on every target. The issue body leaves this as an open question: should struct members get E31226 too, or should inlining stop
copying debug insts? **Not a regression:** v2026.18/20/21, `6815ed82d`, `9b46bca64`. **Not a dup of #9078:** the throw site
is the same (`findOrCreateContextPtrForInst`), but #9078's producer is a layout entry, fixed by draft #13467.
Labels: Bug, `reproduced`, `DebugInfo`, `Metal`; no `regression`, no @-mentions.

**Routing (triager msg 55, 20:24Z, to the #14238 Main `sess-1793690897967-0o6crb`).** Triager
`sess-1793819719484-cdrunz` starts the fixer chain on `gh-issue-shader-slang/slang-14321`. It opens a draft PR
that cherry-picks `b5ff14441` and gives the debug-inst answer, with one line in the description naming E31226 as the other
option. #14267 states "the `-g` debug-instruction fix moved to #14321." The operator was told about the split
at 20:11Z (dashboard row 510880, with a stop option). Not a regression, so the ready-flip goes on the weekly list.
