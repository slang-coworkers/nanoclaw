---
type: chain
title: slang#14067 — IR validation aborts on a legal `throw` terminator before error lowering
description: Human-filed by kaizhangNV (MEMBER, self-assigned) 2026-10-29 23:14:00Z; found during portable-RT work, sibling of #14066. Dispatched to slang-triager; R6 crash exemption applies (aborts + fenced repro), so a triage comment may post now. No fixer handoff without the reporter's go-ahead.
tags: [ir, ir-validation, dominator-tree, error-handling, throws, r6-exempt]
resource: https://github.com/shader-slang/slang/issues/14067
---

# slang#14067 — `-validate-ir` aborts on `IRThrow`

**Ask.** `slangc repro.slang -entry main -target hlsl -validate-ir` on a `void fail() throws uint` +
`do { try fail(); } catch (error : uint)` shader aborts with `unexpected: unhandled terminator instruction`.
Reporter's analysis: the first `validateIRModuleIfEnabled` in `generateIRForTranslationUnit` runs before
`lowerErrorHandling`; its dominator computation calls `IRBlock::getSuccessors`, which handles `IRTryCall`
but has no `kIROp_Throw` case. `IRThrow` exits the function and has no intraprocedural successor.
Reported at 6a1b585b0e, unchanged at master 1f0b33b86. Separate from [#14066](14066-result-void-error-extraction.md).

**Routing (10-29 ~23:2xZ).** Live check: open, 0 comments, no labels, no Type, assignee kaizhangNV (self),
author_association MEMBER. Memory grep for 14067: no hit. GitHub search for the error text: only this issue.
kaizhangNV's open #14051 touches `slang-ir.h` but adds no throw/successor/terminator handling, so the fix is
not already in flight. R6: the body has crash words ("aborts", "aborted") and a fenced reproducer, so the
4-day wait is exempt (`compliance_check.py::is_crash_with_repro`). Dispatched to slang-triager on
`gh-issue-shader-slang/slang-14067`. As with #14066 (self-assigned maintainer who already named the fix),
no fixer handoff or PR without the reporter's go-ahead.

**Triaged (slang-triager, 10-29 23:28Z; these are the triager's findings, and I verified only the GitHub side).** Bot comment
6510939393 was posted 23:27:39Z (verified: nv-slang-bot, the only comment). `reproduced` and Type=Bug are set (verified).
Classification: bug/medium/P2, IR CFG utilities and validation. Not a regression: `Throw` was left out in #6916.
The fix is approach A: add `case kIROp_Throw:` to the empty-successor group (`slang-ir.cpp:575`) and a `-validate-ir` test.
Approach B (move the validation) and approach C (a non-fatal default) were rejected. `Yield` is also missing, but it lives
only inside `IRExpand` (an untested hypothesis). 15 of 32 throw/try tests abort under `-validate-ir`.
PARKED: the triager asked kaizhangNV on the issue whether they want a bot PR. Nothing goes to the fixer.
The triager's one-shot re-check `t-537822` runs 2026-11-02T23:30Z (in the triager's group; it is not visible from Main).
Memo copy: `/workspace/agent/reports/triage/triage-14067.md`.
