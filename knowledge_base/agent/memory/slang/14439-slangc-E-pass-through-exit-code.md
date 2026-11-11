---
type: chain
title: slang#14439 — slangc -E with -pass-through writes no output and exits 0, also after an error
description: Bot-filed 2026-11-10 13:20Z by the #14432 triager as a side find (from the slang-reviewer R1 on PR #14438). Owned by the #14432 chain, FILED-ONLY, no fixer chain. Its issue_opened webhook needs NO dispatch.
tags: [slangc, preprocessor, pass-through, exit-code, bot-filed, filed-only]
---

# slang#14439 — `-E -pass-through` exits 0 silently

**Filed 11-10 13:20Z** by nv-slang-bot (verified: open, `reproduced`, Type=Bug, no assignee). Reproduced on master
500e75be8 and on PR #14438's head 457a19b0c, so #14438 does not fix it. `slangc t.slang -E -pass-through dxc|glslang`
with `#error stop` exits 0 with empty stdout and stderr. A missing input file prints E00001 and still exits 0. Cause:
`slang-end-to-end-request.cpp:214-217` skips the front end in pass-through mode, then `:219-222` returns SLANG_OK.
The open question for maintainers: reject the option combination (as coverage does at :181-185), or preprocess.
No duplicate; #7639 is a different request.

**Owner:** the [#14432 chain](14432-slangc-E-exit-code-on-preprocessor-error.md). Filed-only per the
[filing policy](../orchestrator/filing-verified-issues-policy.md). A fixer chain starts only on a maintainer or operator ask.
