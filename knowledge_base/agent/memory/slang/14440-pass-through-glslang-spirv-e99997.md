---
type: chain
title: slang#14440 — -pass-through glslang -target spirv stops with E99997 "no matching IR symbol" unless -emit-spirv-via-glsl
description: Bot-filed 2026-11-10 13:21Z by the #14432 triager while reproducing #14439. Owned by the #14432 chain, FILED-ONLY, no fixer chain. Its issue_opened webhook needs NO dispatch.
tags: [slangc, pass-through, glslang, spirv, internal-error, bot-filed, filed-only]
---

# slang#14440 — `-pass-through glslang -target spirv` gives an internal error

**Filed 11-10 13:21Z** by nv-slang-bot (verified: open, `reproduced`, Type=Bug, no assignee). Even on valid GLSL,
`-pass-through glslang -target spirv` stops with internal error E99997 "no matching IR symbol" (exit -2) unless
`-emit-spirv-via-glsl` is given. The triager's hypothesis: `slang-code-gen.cpp:1169-1175` takes direct SPIR-V emission
without checking `isPassThroughEnabled()`. A search for "no matching IR symbol" found no open duplicate.

**Owner:** the [#14432 chain](14432-slangc-E-exit-code-on-preprocessor-error.md), found while reproducing
[#14439](14439-slangc-E-pass-through-exit-code.md). Filed-only. A fixer chain starts only on a maintainer or operator ask.

**11-10 — `issue_opened` webhook received; not dispatched** (as planned). Live check at receipt: open, `reproduced`,
no assignee, no comments.

**11-11 — related maintainer direction (on #14439, not on this issue).** jhelferty-nv, relaying Tess on #14439
(comment 6803748699): pass-through mode "was for testing purposes and not a public feature" and "should go on the
chopping block". This issue is a pass-through bug, so a maintainer may close it as obsolete. Nothing was posted here;
no change to the filed-only status.

**11-11 18:19Z — maintainer ask: umbrella task.** jhelferty-nv (repo admin, verified) in
[comment 6803811759](https://github.com/shader-slang/slang/issues/14440#issuecomment-6803811759): "@nv-slang-bot Can you create an
umbrella task for getting rid of passthrough mode and editing all relevant tests so they can still be useful tests without
passthrough mode. Make all of the bugs related to passthrough mode children of that umbrella task." At 18:19:55Z jhelferty-nv also
assigned #14440 to jkwak-work. Context: jhelferty-nv's #14439 comment at 18:16Z ("Per Tess": -E + pass-through should be an error, and
pass-through mode "should go on the chopping block"). That one is a separate webhook, handled by the sibling Main session `jl1zfj`.
**18:22Z — relayed** to the triager owner `sess-1794279041264-l0dcol` (pin + `in_reply_to=2` + thread `…-14440`; landed as triager
seq 12, verified) with `<github-post-authorized />`. Scope given: file one umbrella issue (dedupe against existing tracking issues
first), attach the pass-through bugs as sub-issues (#14439, #14440 + any found), put a test inventory in the body, start no fixer
chain, change no assignees. **The umbrella's own issue_opened webhook needs no dispatch.** Next: the triager's report.

**18:39Z — umbrella filed as [#14459](14459-remove-pass-through-mode-umbrella.md)** (Type=Task; sub-issues #14439, #14440,
verified). The triager posted its report on this issue at 18:39:49Z. #14459's issue_opened was received and not dispatched.
