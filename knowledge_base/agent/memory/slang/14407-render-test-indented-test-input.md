---
type: chain
title: slang#14407 — render-test ignores indented `//TEST_INPUT:` lines
description: Human-filed (albertrodriguezclo, CONTRIBUTOR) tooling bug 2026-11-08 10:07:39Z. `shader-input-layout.cpp` parse() tests `line.startsWith("//")` before trimming, so an indented TEST_INPUT is silently skipped; the param is unbound (vk/mtl read 0, -cpu segfaults slang-test). Dispatched to slang-triager 11-08 ~10:10Z.
tags: [render-test, test-tooling, test-input, metal, vulkan, cpu]
---

# slang#14407 — render-test skips indented `//TEST_INPUT:`

**Ask.** render-test's `ShaderInputLayout::parse()` (`tools/render-test/shader-input-layout.cpp`) only reads
`//TEST_INPUT:` at column 0; slang-test's `//TEST` scan (`slang-test-main.cpp`) calls `skipHorizontalSpace` first and
also accepts `///` and `// TEST`. An indented input (e.g. next to an entry-point param) is dropped with no diagnostic:
`-vk`/`-mtl` read 0, `-cpu` segfaults slang-test. Reporter: no indented TEST_INPUT in `tests/` on master today. Expected:
honour the indent, or error out. Found while writing a Metal test for [#14154](14154-metal-readonly-buffer-const-device.md).

**Dispatch (11-08 ~10:10Z, Orchestrator).** Memory grep 14407: no hits. Assignees none, /events empty, labels none,
0 comments. Only session on `gh-issue-shader-slang/slang-14407` was my own webhook session. Dup search
("TEST_INPUT indented", "shader-input-layout"): none; #14347 is render-test but a different bug. R6 does not hold
(no waiting period). Reporter has a record of filing own PRs (#14176 for #14152, PR offer on #14154) — triager told to
check for a PR offer before any fixer handoff, and to cover the `-cpu` segfault (the unbound-param path should fail loudly).

**Repro (slang-triager, 11-08 10:11Z, master ae4e5795; triager's finding, not re-verified by me).** `-vk` reads 0.0;
`-cpu` segfaults slang-test (exit 139); **new: `-cuda` aborts slang-test too** (CUDA assert, exit 134). The column-0
form passes on all three. Full 5-bullet report pending.

**[Triage] 11-08 10:16Z (slang-triager, memo [raw/triage-14407.md](raw/triage-14407.md)).** Posted cmt
[6720243701](https://github.com/shader-slang/slang/issues/14407#issuecomment-6720243701) (nv-slang-bot 10:15:39Z,
verified), `reproduced` + Type=Bug (verified). Bug / low / test harness / P3; not a regression (check dates to 2020).
`-cuda` result: CUDA_ERROR_ILLEGAL_ADDRESS, then an assert (exit 134). Under `-use-test-server` the crash stays in the
server, so CI mostly sees a failed test. Cause: `shader-input-layout.cpp:1047`. **Rec A:** normalize the line like
slang-test does, plus a cpu/vk/cuda regression test (no tracked test changes). Alt B: an error for indented lines.
**Triager handed off to slang-fixer directly (its msg 9)**; fixer session `sess-1794132916394-9erno5` claimed it 10:15Z
(worktree wt-slang-14407 @ ae4e5795). No PR offer, PR or assignee as of 10:14Z; the fixer re-checks before opening a PR.

**Follow-up [#14409](https://github.com/shader-slang/slang/issues/14409)** ([record](14409-render-test-unbound-param-check.md)) (bot-filed by the triager 10:14:52Z, Bug +
`reproduced`): render-test runs with unbound resource params, and `-cpu`/`-cuda` then crash slang-test in-process
(render-test-main.cpp:947-960 never checks that every param is bound). **Owned by this chain, so its issue_opened needs
NO dispatch.** It is split out because of its larger blast radius: some tests may rely on vk reading 0 from an unbound
buffer, so it needs a full-suite run. Fixer chain for #14409: **offered to the operator 11-08**, not opened. Re-check: one-shot `recheck-14409-operator-chain` 11-11 10:20Z.
**Draft PR [#14411](https://github.com/shader-slang/slang/pull/14411) (11-08 ~10:48Z, verified).** "render-test: accept
indented and /// TEST_INPUT directives", branch `fix/issue-14407`, head `8f77b57`, draft, body has "Fixes #14407".
pr-mapping → fixer session `sess-1794132916394-9erno5`. Fixer status comment 6720572160 (10:51:52Z). Triager relays the
fixer's results: new test 0/3 before the fix, 3/3 after (cpu/vk/cuda); `tests/compute/` 639/639, `tests/render/` 6/6 with
the test server. Now in peer review.
**Fixer [Report] 11-08 10:56Z.** Review requested from slang-reviewer; CI run 42472992584; jkwak-work auto-assigned as
shepherd. Judgment calls: the fix is local to render-test (no helper shared with slang-test); `////TEST_INPUT:` now also
parses, matching `////TEST`; unbound-param diagnostics stay in #14409.
**Review r1 11-08 11:22Z (slang-reviewer, [raw/review-14411-r1.md](raw/review-14411-r1.md)): APPROVE_WITH_NITS**, 0 bugs,
0 gaps. Mutation drills d1–d4 each fail the new test 0/3. Full suite on head 11678/11681; the 3 failures
(`tests/cooperative-matrix/fp8-cuda*`) fail on master too. Nits N1–N3 are comments plus a rename, given as
`pr14411-r1-nits.patch`, apply without another round. Merge condition: the macOS `-metal` lane, i.e. let CI 42472992584
finish. The verdict reached the fixer (its row 18); I received CC copies of the two files only.
**[Fix Report] 11-08 11:29Z (slang-fixer): fixed.** Nits applied, head **`6daf450`** (verified: draft, 3 files +49/−3,
`pr: non-breaking`, assignee jkwak-work). Changes: `shader-input-layout.cpp` parse() uses the slang-test prefix rule;
a back-pointer comment in `slang-test-main.cpp`; new test `tests/compute/entry-point-uniform-params-indented-test-input.slang`.
CI run **42475701068** on 6daf450 (`waiting` at 11:30Z; only macOS CI runs the metal lane). Explanation comment updated.
**Ready-flip pending** (weekly operator list, no per-PR ask); a maintainer review is needed; jkwak-work is shepherd.
⇒ **NEXT:** CI 42475701068; a maintainer review on #14411. Then the triager's `[Triage Resolution]`. Ready-flip pending: weekly list, no
per-PR ask. The operator's ruling on a #14409 chain (re-check 11-11).
