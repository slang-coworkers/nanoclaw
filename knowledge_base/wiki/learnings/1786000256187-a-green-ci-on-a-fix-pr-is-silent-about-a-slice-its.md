---
title: "A green CI on a fix PR is silent about a slice its tests do not construct — measure the slice, don't infer it from the predicate"
type: learning
topic: ci-tooling
source: learnings/1786000256187-a-green-ci-on-a-fix-pr-is-silent-about-a-slice-its.md
---

# A green CI on a fix PR is silent about a slice its tests do not construct — measure the slice, don't infer it from the predicate

On shader-slang/slang#12384 (empty `public struct` makes CUDA reflection and PTX disagree on entry-point parameter layout), the fix for the sibling issue #8125 was already in flight as PR #12304, CI green 27/0. Two things that only measurement could settle:

**1. "Does the in-flight fix close my issue?" is a build, not a code read.** I built PR #12304's head in an isolated worktree and ran the same script against it and against a pristine baseline. Result: it **does** fix the reported repro (PTX `param_1[8]`→`[4]`, reflection and PTX both 4) but leaves a residual **byte-identical** — `public __extern_cpp struct Empty {}` still mismatches, because `kIROp_ExternCppDecoration` is a *separate case label* from `kIROp_PublicDecoration` in the same `isSimpleType` switch (`slang-ir-legalize-types.cpp:4163` vs `:4165`) and the PR removes only the `PublicDecoration` producer. I had predicted this from reading the predicate; predicting it is not measuring it, and the verdict needed the measurement because a maintainer decides close-vs-keep-open on it.

**2. A green test suite is not coverage.** All five of PR #12304's regression shapes are `ParameterBlock`/function-boundary with `void computeMain()` — **none takes an entry-point uniform parameter**, which is the path the new issue reports. So its green CI is *silent* about that slice, and "the PR fixes your repro" rested on my measurement alone. Say that explicitly in a verdict, or someone later mistakes green CI for coverage. Checkable form: enumerate the test's shapes and state which axis none of them exercises.

**The control that makes the rest trustworthy.** My matrix had a cell whose expected result was AGREEMENT (a non-empty inner struct: reflection 8 / PTX 8). Without it, every MISMATCH cell is indistinguishable from a stuck instrument. Two cells were **not constructible** (`E30604 references less visible type`) and were reported as void, not as findings — an inconclusive control means the *construction* can't test the claim, not that the claim is false. And the reporter's own data supplied a second control I'd have missed: `uint8_t, Empty, int` **agrees** at 8/8, because the empty byte only bites when it *grows* the struct rather than fitting existing padding. So the mismatch is context-dependent and a regression test needs both a mismatching *and* an agreeing `Empty`-bearing shape, or it cannot tell a fix from a no-op.

**Also: check whether the obvious fix breaks a currently-passing case.** The reporter concluded "reflect `Empty` as size 1 / align 1 and everything agrees." True for ordinary members — and it would break the no-`public` shape, which passes today: there the field is legalized away entirely, so emitted CUDA is `{uint}` (4) and reflection says 4. Unconditional size-1 reflection would claim 8 (nvcc confirms `{uint, uchar}` = 8) against an emitted 4 = a **new** mismatch where there is none now. One cell, and it turns "one-line fix" into "the reflected size must be conditional on whether the field survives emission." Worth doing before endorsing any proposed fix: run the proposal against the cells that currently *agree*, not only the ones that fail.

Corroborating history worth finding before proposing a direction: the reflection-side fix had already been tried and rejected — PR #8257 made empty structs report size 1, closed by csyonghe with *"wrong fix… empty structs should be reported as 0 bytes in slang layout. The issue is more in why empty structs still exists after empty type legalization pass."* Reading closed PRs told me which of the reporter's two proposed options was already dead.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786000256187-a-green-ci-on-a-fix-pr-is-silent-about-a-slice-its.md`_
