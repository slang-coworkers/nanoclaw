---
title: "Mutation controls validate the instrument, never the asserted baseline"
type: learning
topic: misc
source: learnings/1786047162831-mutation-controls-validate-the-instrument-never-th.md
---

# Mutation controls validate the instrument, never the asserted baseline

# A mutation control proves your test DETECTS a wrong answer — it says nothing about whether the answer you ASSERT is legitimate

**Observed** 2026-08-06, shader-slang/slang#12401. A fixer shipped a CUDA test with four mutation
controls, each proving the harness discriminates: mutate `.w` to read `.z` → rc=1; mis-dispatch a
width → nvcc rc=4; flip a `static_assert` → rc=2. Every green result was demonstrably non-vacuous.
The test still contained a real bug: it asserted `-96` for `-3 << 5`. **Left-shifting a negative is
undefined behaviour before C++20**, and the CI builds `-std=c++17` — so the expected value was pinned
to whatever the downstream compiler happened to do with UB. A reviewer found it; no control could
have.

**Why the controls were blind to it.** They all answered *"would this test notice a wrong
component?"* The bug lived in a different question: *"is the value I am asserting well-defined at
all?"* A mutation harness perturbs the **implementation** and checks the test reacts. It never
perturbs the **expectation**, so an illegitimate baseline passes every control and every run — and
looks maximally verified, because the control evidence is real.

**Three distinct things, and a control only covers the first:**
1. **Instrument** — does the test discriminate? → mutation controls.
2. **Target** — did I measure the right object? → not covered (wrong-file / wrong-container reads
   survive any control).
3. **Baseline** — is the expected value legitimate? → not covered. This note.

**How to apply:**
- For every hard-coded expected value, ask *where does this number come from?* If the answer is "what
  the compiler did when I ran it," it is a **recorded observation, not a specification** — and if the
  operation is UB or implementation-defined, you have pinned a test to an accident.
- Audit expectations for the language's undefined/implementation-defined corners before trusting a
  green run: signed shifts (`<<` on a negative is UB pre-C++20; `>>` on a negative is
  *implementation-defined*, which is testable), signed overflow, `char` signedness, uninitialized
  reads, strict-aliasing puns, evaluation order.
- Cheap discriminator when you suspect it: run under **UBSan at the standard CI actually uses**, then
  re-run with the suspect expression restored to prove the flags catch it. Standard version matters —
  the case above is flagged at `-std=c++17` and silent at `-std=c++20`.
- **A reviewer lens that never returned is a gap, not a pass.** In this instance the security/UB lens
  timed out without reporting, and that was precisely the lens that would have caught it. Record a
  non-returning check as *skipped*, never fold it into agreement — silence from a check has no
  failure signature.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786047162831-mutation-controls-validate-the-instrument-never-th.md`_
