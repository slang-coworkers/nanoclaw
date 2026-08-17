---
title: "Five instances of one coincidence trap in a day: an entry point sharing a file with the construct under test makes the fallback indistinguishable from the answer"
type: learning
topic: ci-tooling
source: learnings/1785833361770-five-instances-of-one-coincidence-trap-in-a-day-an.md
---

# Five instances of one coincidence trap in a day: an entry point sharing a file with the construct under test makes the fallback indistinguishable from the answer

**slang#12150, 2026-08-04 — one mechanism, five separate failures, including inside the test built to catch it.**

SPIR-V `DebugFunction` scoping falls back to a module-global CU that is **pinned to the entry point's compilation unit**. So whenever a test fixture puts the entry point in the *same file* as the construct under test, the broken fallback's answer **coincides** with the correct answer, and the fixture cannot discriminate. Every occurrence looked like a pass or a valid result:

1. **Three "tests-before-fix" fixtures were inert** — passed before any fix existed. The pre-registered baseline caught it; per-fixture review had not, because the reviewer's model carried the defect (see the common-mode-defect lesson).
2. **A "multi-CU" fixture believed to escape the trap did not** — two CUs was *necessary but not sufficient*; the entry point still lived in the file doing the `#include`.
3. **A severity A/B was invalid** — "fell back to the entry CU" and "resolved to the wrong includer" were byte-identical in the output because the wrong includer *was* the entry file. This nearly shipped a regression as "pre-existing limitation."
4. **The regression itself** — only visible once the entry point was moved to a third file: master `variantFn2 → f2.slang` (correct), branch `→ f1.slang` (wrong).
5. **The ambiguity test built to catch all of the above** — passed *without* the gate, because its author again put the entry point in the same file as the first includer.

**Standing rule for this codebase:** for any SPIR-V debug-scope fixture, **the entry point must live in a file distinct from every construct under test.** Otherwise the entry-CU fallback aliases the expected answer. Put it in a comment on the fixtures — a future editor "simplifying" a fixture by merging files silently destroys its discriminating power with all tests still green.

**Generalizes past this codebase:** whenever a system has a **default/fallback value**, a test whose expected value equals that default cannot distinguish "computed correctly" from "fell back." Enumerate where the fallback's value coincides with the expected value, and build fixtures outside that set. This is the fixture-design counterpart of "a control must be able to fail."

**Why five times rather than one:** it is invisible until you construct the case that separates the two outcomes. Recognizing the trap in the abstract did not prevent instances 4 and 5 — what caught each one was a *constructed counterfactual* (pre-registered baseline; entry point moved; gate removed and the test required to go red). **Knowing a trap exists does not protect you from it; only a discriminating construction does.**

**Adjacent finding, same task — two apparently-equivalent counters behaved differently.** A gate counting "qualifying walk candidates" was dead code because the walk `break`s on the first qualifying view, structurally pinning the count at 1. Counting "distinct includers" requires visiting every view. ⇒ **Before writing a gate that keys on a counter, MEASURE that counter's value on a known-positive case.** Measure-then-implement cost one instrumented run; implement-then-negative-control cost a full cycle. And record the `break` reasoning next to the gate, or a future reader "simplifies" the loop and silently restores the dead-gate behavior.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785833361770-five-instances-of-one-coincidence-trap-in-a-day-an.md`_
