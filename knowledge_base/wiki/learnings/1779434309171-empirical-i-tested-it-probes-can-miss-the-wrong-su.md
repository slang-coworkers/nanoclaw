---
title: "Empirical 'I tested it' probes can miss the wrong sub-case — Devin's persistent flags deserve scrutiny even when initial reading says misread"
type: learning
topic: review-process
source: learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md
---

# Empirical "I tested it" probes can miss the wrong sub-case — Devin's persistent flags deserve scrutiny even when initial reading says misread

# Empirical probes can test the wrong sub-case

## What happened

Slang PR #11234 (`__fwd_diff` of generic-constrained interface members). Devin Review flagged "AD functions with default arguments would hit assertion on the else-branch" persistently across rounds 2, 3, 5, 6. Fixer probed empirically in round 3 with `__fwd_diff(curve.eval)(diffPair(t, 1.0), diffPair(0.5, 0.0))` — *both* args supplied — saw clean lowering, declared resolved. I (the reviewer) accepted that empirical evidence and labeled Devin's flag as a structural concern that doesn't manifest. Reviewer A also dropped the flag in round 5.

Round 6 — Reviewer A, on a fresh look, traced the actual code path and identified that the failing case is *omitted* default args, not supplied. With `bar(float x, float y = 0.0)` and a one-arg call `__fwd_diff(foo.bar)(diffPair(t, 1.0))`, `FwdDiffFuncType::_resolveImplOverride` produces `paramCount = 3` (this+x+y), `argCount = 1`, gate `paramCount == argCount + 1` is false, falls through to `addDirectCallArgs(expr, resolvedFuncType, …)` whose precondition asserts `argCount == funcType->getParamCount()` → ICE. Same `paramCount == callArgCount`-style failure as #11004, just shifted by one.

## Why I missed it

1. **Empirical-equals-correct trap.** "I ran the test and it passed" is strong-feeling evidence, but only as good as the test design. The fixer's probe covered one of two sub-cases (supplied), not the other (omitted). Static analysis covers both; empirical testing only covers what was tested.
2. **Devin flagged "default arguments" without specifying which sub-case** — easy to read as "the supplied case" if that's what was just tested. Devin's actual concern (omitted) was the case the empirical probe missed.
3. **A 4-round trend toward fewer findings biased me toward "trust the empirical resolution."** Each round closed concerns; round 6 was assumed to converge. It actually surfaced a real correctness gap A had previously dropped under the editorial filter.

## How to apply

- **When Devin persistently flags something across multiple rounds** despite an empirical "I tested it" closure, ask: "is the test design covering all sub-cases of the structural concern Devin is naming?" Specifically — for any "X with feature Y" flag, list all combinations of usage of feature Y (supplied/omitted, default/explicit, present/absent) and verify the empirical test covers each.
- **For any gate predicate `paramCount == argCount + N`**, enumerate the cases where the underlying `FuncType` synthesizes additional params (default args, varargs, captured closures, generic specializations). The empirical probe must cover at least one OMIT case for each synthesizer, not just the supplied case.
- **Don't let convergence trend bias your judgment.** Rounds 1-5 trending green doesn't mean round N is also green. Re-read each round's findings against the diff fresh.
- **The disabled `DISABLE_DIAGNOSTIC_TEST` for the same bug is a hint.** When a fix narrows the original issue's scope by carving out a sub-case (here: "concrete-receiver shape tracked separately"), check whether other adjacent shapes are covered or also carved out. A "fixed the headline, not the class" outcome is the exact failure mode the disabled test was warning about.

## Pointer

Reviewer A round 6 final-review: `/home/node/.claude/skills/slang-pr-review-runner/transcripts/pr-20260522T070110Z/final-review.md` — the editorial filter table at the top is a good template for showing the chain of evidence (PR comment ↔ source code ↔ verification result) per finding.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779434309171-empirical-i-tested-it-probes-can-miss-the-wrong-su.md`_
