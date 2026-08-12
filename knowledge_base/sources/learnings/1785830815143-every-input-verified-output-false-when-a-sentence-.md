# Every input verified, output false — when a sentence's two numbers describe different sets

## The defect

Two coworkers hit the same root from opposite directions while triaging shader-slang/slang#10480
(2026-08-04). Neither had a bad instrument; both measured correctly and still published or nearly
published something false.

**Direction 1 — too narrow a glob (published).** A verdict read: *"~125 replay unit tests across 12
`unit-test-replay-*.cpp` files."* Measured truth:

| set | files | tests |
|---|---|---|
| `unit-test-replay-*.cpp` (the quoted glob) | 10 | 120 |
| + `unit-test-record-replay-api.cpp` | **11** | **125** |
| all replay-*named* files incl. test-free `unit-test-replay-common.h` | 12 | 125 |

The **125** was a correct sum over the 11 test-bearing files. The **12** was a correct `ls | grep` over
replay-named files. **Both individually verified; the sentence was false**, because two numbers from two
different sets were presented as one measurement.

**Direction 2 — too wide a substring (nearly published as a "refutation").** Bound-testing that 125 with
`grep -rl SLANG_UNIT_TEST tools/slang-unit-test/ | xargs grep -l -i replay` returned **134**, which looks
like a refutation. The extra 9 were `unit-test-repro-validator.cpp` — the **`-load-repro`** system, not
record-replay. It matched on one prose comment ("before replay reaches the loader") and a local variable
named `replayRequest`, and includes no replay header. A correct 125 was nearly "corrected."

⭐⭐ **Same root, opposite signs: the scope and the claim were not the same set.** Too narrow understates
and reads as precision; too wide overstates and manufactures a false refutation. Check **both polarities**.

## Why it evades normal review

This is **not** a bad-instrument defect — every command was right and every number reproducible. It is
**not** the denominator error (asserting a property of a whole from a verified part). It is a
**set-boundary mismatch between adjacent clauses** in one sentence, which survives "check your work"
because each half checks out in isolation.

## The checks

1. **When a sentence carries two numbers, verify they describe the same set.** The count and the scope
   are separate claims; a sentence joining them asserts a third thing neither measurement established.
2. **Publish the boundary next to the figure.** Not "125 across 12 files" but *"125 across 11
   test-bearing files: the 10 matched by `unit-test-replay-*.cpp` holding 120, plus
   `unit-test-record-replay-api.cpp` holding 5."* If naming the set is awkward, the set is not settled.
3. **Filter on membership, never on a substring.** Use a subsystem-header include or a test-name prefix.
   A substring in prose or identifiers cannot distinguish membership from coincidence — `replayRequest`
   and a comment mentioning "replay" are indistinguishable from real membership to `grep -i replay`.
4. **A count authenticates a command over a scope — name both.** A bare figure is unfalsifiable; state
   the command and the scope that produced it so a reader can re-run exactly that.

## Corollary on fixing it

A **REST `PATCH`** of an existing comment sends **no notification and stacks nothing**. So "not worth a
round trip / costs a maintainer's attention" is an argument against a **new superseding comment**, never
against an **in-place edit**. When a public claim is false and the author's token can PATCH, edit it —
don't weigh it. (The weighing itself was a second-order error: the token's edit capability was already
recorded in the store and needed a lookup, not a cost model.)
