---
title: "[approver/challenger-miss] A narrowing predicate's blast radius = shapes that DIDN'T already error — find the pre-existing rejection path before scoring an over-rejection flag"
type: learning
topic: review-approval
source: learnings/1785837275081-approver-challenger-miss-a-narrowing-predicate-s-b.md
---

# [approver/challenger-miss] A narrowing predicate's blast radius = shapes that DIDN'T already error — find the pre-existing rejection path before scoring an over-rejection flag

## Symptom

Reviewing shader-slang/slang#12246 (`pr: breaking change` — reject a
non-integer `switch` condition in the semantic checker), Devin flagged a
plausible over-rejection:

> "Switch inside a generic body over a value of a bare generic type parameter
> would now be rejected" — `slang-check-stmt.cpp:410-417`, severity Investigate

The mechanism was real and easy to confirm by reading: the new guard calls
`isValidCompileTimeConstantType` = `isScalarIntegerType(type) || isEnumType(type)`,
where `isScalarIntegerType` needs a `BasicExpressionType` and `isEnumType` needs
an `EnumDecl`. A bare generic param `T` (or an associated type, **or a plain
struct**) is a `DeclRefType`, so the predicate is false and the error fires while
checking the generic *definition* — before specialization could resolve `T=int`.
Even `T : IInteger`, which is *always* an integer, is rejected.

Read that far, it looks like a serious breaking over-rejection: a constrained
generic integer switch, killed at the definition site. The tempting calls are
BLOCK, or ABSTAIN(OPEN_GAP).

## Root cause of the near-miss

**"The new predicate rejects shape X" is not the same claim as "the PR newly
breaks shape X."** X may *already* be rejected today, by a different path, for a
different reason. I nearly scored the flag on the first claim.

Measured against the pre-PR compiler (the control that settles it):

| shape | pre-PR result |
|---|---|
| bare generic `T`, **with `case 1:`** | **already ERROR E30019** |
| bare generic `T`, `case T(1):` | **already ERROR E30019** |
| **constrained** assoc type `Tag : IInteger`, with `case 1:` | **already ERROR E30019** |
| bare generic `T`, **`default:` only** | CLEAN |
| assoc-type value, `default:` only | CLEAN |
| bare generic `T`, **empty body** | CLEAN |
| plain **struct**, `default:` only | CLEAN |
| `switch (t.code())` — method returns concrete `int` | CLEAN (and still accepted) |

The pre-existing rejection path is `visitCaseStmt`: it coerces each `case` label
to the condition's type (`slang-check-stmt.cpp:434`), which already fails with
E30019 for any non-integer condition. So **every generic switch carrying an
integer case label already errors today.** The shapes the PR *newly* rejects are
exactly those with **no case label to coerce** — `default:`-only or empty-body —
which are semantic no-ops: a switch with no cases selects `default`
unconditionally regardless of the selector's value. Degenerate code, not a
working pattern anyone depends on.

That collapsed the flag from "breaks constrained generic integer switches"
(serious) to "breaks no-op switches over non-integer values" (advisory).

## How to catch it

For any PR that **narrows** what the front end accepts (new rejection, new
diagnostic, tightened predicate):

1. **Build/keep the pre-PR compiler and measure the baseline.** Reading the
   predicate tells you what it rejects; only running the old binary tells you
   what *changed*. The delta is the blast radius — nothing else is.
2. **Hunt for the pre-existing rejection path before scoring the flag.** Ask:
   "if this shape is really newly-broken, why did nobody hit it?" Usually a
   neighbouring check already rejected it. Here it was `visitCaseStmt`'s
   `coerce`, two functions down from the diff.
3. **Then find the residue** — the sub-shape that slips past the old path and
   into the new one. Construct it explicitly (drop the case label). That residue,
   not the flag's stated scope, is what you judge severity on.
4. **Extend the flag's scope while you're there.** Devin said "generic"; the real
   class was any `DeclRefType`, including a non-generic struct. A tool's stated
   scope is often a subset — probe the predicate's actual boundary.
5. **Check the corpora that aren't construction-guaranteed.** In-repo `tests/**`
   pass by construction on a breaking PR (the author migrates them). Verify what
   the integration jobs actually compile: slang's `test-compile-regression` copies
   **`/c/slang_compile_test_suite_a`** (`.github/workflows/ci-slang-regression-test.yml:35-39`)
   — a runner-local, **out-of-tree** 866-shader suite the author does not touch.
   866/866 compiled clean with zero occurrences of the new code. That is real
   negative evidence.

## Fix / rule

**A narrowing change's blast radius is `{shapes the new predicate rejects}`
MINUS `{shapes something already rejected}` — compute the difference, don't
score the first set.** The first set is what you get by reading the diff; the
difference is what you get by running the old compiler. Scoring the first set
over-abstains on exactly the changes that are safest, because a mature compiler
usually already rejected the dangerous cases by another route.

Corollary, and the reason this is a *challenger-miss* note rather than a
calibration one: the same discipline applies in the reassuring direction. Once
the residue is degenerate, don't round the flag back up to OPEN_GAP for
comfort — and don't round it away either. Name the residue, show it's a no-op,
and say so.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785837275081-approver-challenger-miss-a-narrowing-predicate-s-b.md`_
