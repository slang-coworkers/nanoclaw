---
type: chain
title: slang#14292 — slang-test: check the exit code in all test types, not only SIMPLE
description: Maintainer (jkwak-work) self-filed and self-assigned test-infra umbrella, 2026-11-04 03:42Z ("Part of #14215"). Asks nothing of the bot -> held: NO dispatch, NO bot post. Resume only on an @nv-slang-bot mention or an operator ask.
tags: [test-infra, slang-test, exit-code, maintainer-owned, held]
---

# slang#14292 — exit-code check for every slang-test test type

**11-04 03:42Z, `issue_opened`.** Live read (11-04): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned`, 03:42:35Z), 0 labels, 0 comments, no linked PR.
Body says "Part of #14215" ([record](14215-validate-with-downstream-compiler.md)).

**Ask.** PR #14269 made `SIMPLE` + `filecheck=` expect exit code 0 by default (`exit-code=N` for an expected
failure). Extend that to the types that still ignore it: `diag=` (`_diagnosticAnnotationTest`, i.e.
[#14266](14266-diag-tests-exit-code.md)), `INTERPRET` (149, `runInterpreterTest` passes force-failure `false`),
`REFLECTION`/`CPU_REFLECTION` with `filecheck=` (~33), `SIMPLE_LINE` (6), `DISPATCHER` (1). Out of scope:
`LANG_SERVER`, `.expected`-file tests. Plan: one shared helper, one test type per PR (REFLECTION first, then
INTERPRET, small ones, then `diag=` with an annotation-derived default), triage every failure as real bug /
wrong expectation / environment, never `exit-code=-1` to hide an E99999, update `tools/slang-test/README.md`.

**Disposition: held, nothing dispatched or posted.** Fifth issue in the jkwak-work test-infra series
([#14215](14215-validate-with-downstream-compiler.md), [#14258](14258-check-not-old-error-format.md),
[#14265](14265-dead-expected-files.md), [#14266](14266-diag-tests-exit-code.md)): self-filed, self-assigned,
no ask of the bot. The stand-down comes from the self-assignment, not from an R6 hold.

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so no re-check timer.

**11-04 04:30Z.** Follow-up [#14295](14295-ptr-extension-instance-method-lookup.md) (same author, self-assigned): the `INTERPRET` exit-code work exposed `tests/bugs/ptr-extension-this-type.slang` as a failing compile; it is disabled with a TODO pointing at #14295. Also held.

**11-04 04:35Z.** Two more follow-ups, same author, both self-assigned and held: [#14296](14296-pack-query-in-expand-pattern.md) (`__trimFirst`/`__trimLast` on value packs in an `expand`) and [#14297](14297-countof-tuple-expand-generic-pack-size.md) (`countof(Tuple<expand Wrap<each T>>)` returns 1). Both block `variadic-pack-query-layer-shape.slang`.
