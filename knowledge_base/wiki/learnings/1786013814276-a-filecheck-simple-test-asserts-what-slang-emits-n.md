---
title: "A filecheck SIMPLE test asserts what Slang EMITS, never what DXC/MSL ACCEPT — -target dxil/metallib are the toolchain-invoking directives"
type: learning
topic: slang-compiler
source: learnings/1786013814276-a-filecheck-simple-test-asserts-what-slang-emits-n.md
---

# A filecheck SIMPLE test asserts what Slang EMITS, never what DXC/MSL ACCEPT — -target dxil/metallib are the toolchain-invoking directives

Landed slang#12298 (canonicalize `enum : bool` switch case labels to `IRBoolLit` so C-family emitters print `case true:` not `case int8_t(1):`) — merged as PR #12301 → `bbaef7d62e`. The fix was right, but a peer caught a real coverage gap worth generalizing:

**`//TEST:SIMPLE(filecheck=…):-target hlsl|cpp|cuda|metal` verifies the emitted TEXT and never hands it to a downstream compiler.** It cannot tell you DXC or the Metal front end *accepts* that output. The in-tree directives that actually invoke those toolchains are **`-target dxil`** (~123 tests) and **`-target metallib`** (~97 tests). If your PR description says "downstream acceptance routed to CI" and the Windows/macOS jobs then go green, that pair reads as a confirmation — but if every directive you added is `SIMPLE(filecheck=…)` on a *source* target, nothing was confirmed. Either add a `-target dxil` / `-target metallib` directive, or soften the wording to "unverified".

Why it mattered here: whether the old `int8_t(0)` HLSL spelling was *rejected* by DXC is the only thing separating "canonical-form cleanup" from "we were emitting invalid HLSL" — i.e. it decides how the issue is characterised, not just how it's fixed. Still unverified at merge.

**Three instrument traps from the same task (each nearly produced a wrong published claim):**
1. **A duplicate webhook is a REDRIVE, not a new event.** An identical `pr_review` (same `pullrequestreview-<id>`) arrived because the prior turn analysed but emitted no outward message. The discriminator is *does the outward artifact exist* — the owed action was the outward report, not a re-analysis.
2. **State claims expire — re-verify at the point of ACTION.** Between two turns the PR went `mergeStateStatus: BLOCKED` (37 commits behind) → `MERGED`. I was one step from escalating a rebase-authorization question that had become moot.
3. **`git diff A..B -- <my files>` renders MY additions as DELETIONS.** It reported master "deleting 116 lines" of my code; three-dot (`origin/master...HEAD`) showed the truth (+115/−18 = my change). Relatedly, `grep -iE "conflict"` over `git merge-tree` output false-positived on design-doc prose containing the word "conflict" — count real markers (`^<<<<<<< `) instead (0 = clean).

**Bonus:** a CI failure on `test-compile-regression` + `test-falcor` was proven flaky by `gh run rerun --failed` going fully green with **zero code change**. Before blaming your diff, check whether the failing corpus even contains your construct: my change was gated on `loweredType->getOp()==kIROp_BoolType`, so it was provably inert for any shader without an `enum : bool` (verified `enum : int` output unchanged). Also note compile-regression prints each file as BOTH `- PASS` and `- FAIL` (dual-config); grepping only `- FAIL` makes it look like a universal failure.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786013814276-a-filecheck-simple-test-asserts-what-slang-emits-n.md`_
