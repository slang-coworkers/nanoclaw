---
type: chain
title: slang#14432 — slangc -E returns exit code 0 when the preprocessor reports an error
description: Maintainer (jkwak-work) self-filed and self-assigned, 2026-11-10 02:44Z. 11-10 02:50Z jkwak-work asked @nv-slang-bot to triage and make a PR -> RESUMED: slang-triager dispatched on gh-issue-shader-slang/slang-14432 (post-authorized), fixer handoff via the triager.
tags: [slangc, preprocessor, exit-code, maintainer-owned, dispatched]
---

# slang#14432 — `slangc -E` exits 0 after a preprocessor error

**11-10 02:44Z, `issue_opened`.** Live read (11-10): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned`, 02:44:32Z), 0 labels, 0 comments.

**Ask.** In `-E` mode the `PreprocessorOutput` branches in `slang-end-to-end-request.cpp` and
`slang-compile-request.cpp` return `SLANG_OK` before the sink error-count check, so E15405 / E15408 still exit 0.
When fixed, `tests/preprocessor/preproc-pound-pound-1.slang` and `preproc-detail-2.slang` must move from
`exit-code=0` to `-1`. Open question for a maintainer: is exit 0 intentional for tools that read `-E` output.
Follow-up of [#14266](14266-diag-tests-exit-code.md) (same author, same exit-code class as
[#14292](14292-slang-test-exit-code-all-test-types.md)).

**Disposition: held, nothing dispatched or posted.** Rung 4: a maintainer filed and self-assigned the work and
asked the bot for nothing. Mentions arrive as webhooks, so no re-check timer.

**11-10 02:50Z — RESUMED.** jkwak-work [comment 6757575242](https://github.com/shader-slang/slang/issues/14432#issuecomment-6757575242)
(MEMBER, verified via API): "@nv-slang-bot triage and make a pr". Dispatched slang-triager on
`gh-issue-shader-slang/slang-14432` with `<github-post-authorized />`; the ask covers the PR, so the triager hands
off to slang-fixer (draft PR; flip the two `exit-code=0` tests to `-1`; the issue's open question on intentional
exit 0 goes in the PR/triage post for jkwak-work). No prior triager/fixer session on this thread (only my Main
issue_opened session).

**11-10 02:58Z — triaged.** Triager report (receipts verified: bot comment
[6757698268](https://github.com/shader-slang/slang/issues/14432#issuecomment-6757698268), label `reproduced`,
Type=Bug). Bug / P2 / frontend. Reproduced on 72170828a. E15405, E15408, `#error` and `-warnings-as-errors` all
exit 0 under `-E`. Root cause: `slang-compile-request.cpp:827-831` returns `SLANG_OK` before the sink check at
:833. Approach A, the producer fix, moves the error check above the `-E` return. The behavior chosen for
jkwak-work to confirm: "-E output is kept; exit -1 on any error" (gcc/clang behave the same way). Scope beyond the
issue text: line 2 of both tests (`filecheck=`) also needs `exit-code=-1`, and
`tests/bugs/preproc-lex-failure-2.slang.expected` is a third affected test. **Overlap:** open PR #14422
(jkwak-work, non-draft, "slang-test: check the exit code of diag= and .expected tests") edits line 1 of the same
two tests, so the PR that lands second must merge master. Handed to slang-fixer on the canonical thread. Raw:
[raw/triage-14432.md](raw/triage-14432.md).
