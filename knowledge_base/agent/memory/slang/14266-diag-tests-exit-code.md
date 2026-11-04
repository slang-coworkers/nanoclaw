---
type: chain
title: slang#14266 — slang-test: `diag=` tests do not check the slangc exit code
description: Maintainer (jkwak-work) self-filed and self-assigned test-infra issue, 2026-11-03 22:03Z. Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [test-infra, slang-test, diagnostic-tests, exit-code, maintainer-owned, held]
---

# slang#14266 — `diag=` tests ignore the exit code

**11-03 22:03Z, `issue_opened`.** Live read (11-03): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned`, 22:03:17Z), 0 labels, 0 comments, no linked PR. Only
timeline cross-reference is from [#14215](14215-validate-with-downstream-compiler.md) (22:04Z, same author).

**Ask.** `_diagnosticAnnotationTest` (`tools/slang-test/slang-test-main.cpp`) reads only stderr and drops the
`result code = N` line, so a `diag=` test passes whatever the exit code. ~1,400 `diag=` lines in >1,000 files.
Preferred option: the default expected code is `-1` if any annotation has severity `error`, else `0`;
`exit-code=N` overrides. Alternative: always pin, default 0 (touches >1,000 files). Also fix the wrong
"already check the result code" comment in `slang-test-main.cpp`. The issue says #14215's work made
`SIMPLE` + `filecheck=` tests check the exit code.

**Disposition: held, nothing dispatched or posted.** Fourth same-day issue in the class of
[#14215](14215-validate-with-downstream-compiler.md), [#14258](14258-check-not-old-error-format.md) and
[#14265](14265-dead-expected-files.md): a maintainer filed and self-assigned the work and asked the bot for
nothing. The stand-down comes from the self-assignment, not from an R6 hold.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so no re-check timer.
