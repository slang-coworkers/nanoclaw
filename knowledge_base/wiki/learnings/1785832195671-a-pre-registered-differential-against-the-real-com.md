---
title: "A pre-registered differential against the real comparator caught a regression that every other green signal missed"
type: learning
topic: misc
source: learnings/1785832195671-a-pre-registered-differential-against-the-real-com.md
---

# A pre-registered differential against the real comparator caught a regression that every other green signal missed

**slang#12150, 2026-08-04 — the payoff case for pre-registration, worth recording as a concrete precedent.**

A fix for SPIR-V `DebugFunction` scoping was ready to ship with: **566/566** spirv tests, **15/15** serialization, **three** independently negative-controlled discriminating tests, and a clean automated CODE_REVIEW round. The author had also claimed, and reported twice, that the change was *"strictly better, never worse"* than master.

A pre-registered A/B against **pristine master** (not branch-minus-one-commit) falsified it:

```
MASTER: variantFn2 scope=%17 → CU %17 wraps DebugSource %15 → f2.slang   CORRECT
MINE:   variantFn2 scope=%13 → CU %13 wraps DebugSource %7  → f1.slang   WRONG
```

`variantFn2` is declared by f2's conditional expansion of a shared header; the new occurrence-resolution bound it to f1's CU because f1's occurrence was registered first. **A regression, in the worse-than-master direction** — master emitted a generic fallback that happened to be right, the change emitted a specific real file that is wrong and plausibly looks right.

**Every green signal available was consistent with shipping the regression.** No test suite, no review round, and no revert/byte-identity drill could see this case. Only the differential could — and getting a *valid* differential took two rebuilds and three invalid attempts (absent inputs · wrong comparator · incomplete target set missing `slang-glslang`).

**Rules confirmed:**
1. **For a ship decision, the comparator is pristine master** — the claim names it. Branch-minus-one-commit answers "did my last commit regress," a different question.
2. **Pre-register both readings AND their ship decisions, hashed, before the measurement.** Here it meant the bad result could not be reinterpreted as acceptable after the fact; the author reported "the bad branch" and stopped.
3. **Coincidentally-correct beats confidently-wrong for a human-facing artifact.** Master's answer was right *by coincidence* (module-global fallback pinned to the entry point's CU, which happened to be the declaring file). It still beats a wrong specific file: a fallback's errors are uniform and learnable, while a plausible-looking wrong answer carries no signal of doubt. Do not let "their correctness is accidental" argue for shipping a real error.
4. **Correct-or-fallback is the right default for debug info / diagnostics.** Resolution: enumerate qualifying occurrences; bind iff exactly one qualifies, otherwise bind nothing and preserve the pre-existing fallback. Converts *sometimes confidently wrong* into *correct or unchanged*.

**Two implementation guards for a deliberate bail-out** (both learned from earlier failures the same day):
- **The ambiguity test must assert the fallback is PRESERVED**, and be negative-controlled — gate removed ⇒ red, gate present ⇒ green. Otherwise "the gate fired" is indistinguishable from "the case never arose."
- **Make the silence deliberate in the code comment**, naming the measured regression case. A future reader will otherwise "finish" the bail-out by picking the first occurrence — reintroducing exactly the measured regression. An unexplained conservative bail-out reads as incompleteness.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785832195671-a-pre-registered-differential-against-the-real-com.md`_
