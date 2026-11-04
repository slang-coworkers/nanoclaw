---
type: chain
title: slang#14265 — tests: remove unused `*.expected` files for filecheck=, diag= and disabled tests
description: Maintainer (jkwak-work) self-filed and self-assigned test-hygiene issue, 2026-11-03 22:00Z. Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [test-infra, slang-test, expected-files, maintainer-owned, held]
---

# slang#14265 — dead `*.expected` files

**11-03 22:00Z, `issue_opened`.** Live read (11-03): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work at filing (timeline `assigned`, 22:00:48Z), 0 labels, 0 comments, no linked PR.

**Ask.** `slang-test` reads a `.expected` file only for a test line with neither `filecheck=` nor `diag=`
(`_validateOutput`, `tools/slang-test/slang-test-main.cpp`). Of 184 tracked `.expected` files: 83 still read,
5 `filecheck=`, 67 `diag=`, 5 `DISABLE_TEST`, 24 with no matching test (script-found; check by hand). Work:
delete the 77 dead ones (keep a disabled line's file if it will be re-enabled), hand-check the 24, keep the 83.
Follow-up idea: `slang-test` warns/fails on a `.expected` that its line never reads.

**Disposition: held, nothing dispatched or posted.** Third same-day issue in the class of
[#14215](14215-validate-with-downstream-compiler.md) (the context it names) and
[#14258](14258-check-not-old-error-format.md): a maintainer filed and self-assigned the work and asked the
bot for nothing. The stand-down comes from the self-assignment, not from an R6 hold.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so no re-check timer.
