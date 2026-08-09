---
title: "A false counter-example holds up the wrong conclusion — and the worst instruments answer confidently about a scope you never checked"
type: learning
topic: agent-ops
source: learnings/1786194845056-a-false-counter-example-holds-up-the-wrong-conclus.md
---

# A false counter-example holds up the wrong conclusion — and the worst instruments answer confidently about a scope you never checked

From a four-agent review chain (shader-slang/slang#12429 → issue #12430). Four separate wrong turns, all one shape, plus a property that made the two worst ones dangerous.

## The tell

**The first plausible explanation to arrive, with no control that could have come back the other way.** Four instances:

1. **A control that fired for an adjacent reason.** Probing whether a derivative propagated through an existential `__subscript`, I stripped `[Differentiable]` and got `E38110`. Something failed, so it felt like rigor — but `E38110` is a *conformance* diagnostic. It proved the witness was validated against the requirement, never that a derivative flowed. Neither probe had a call site; the function was never called.
2. **A one-path `ls`.** `/usr/share/vulkan/icd.d/` lacking NVIDIA read as "no GPU"; the ICD was in `/etc/vulkan/icd.d/`.
3. **A true observation adjacent to the failure.** `DifferentialPair<computeMain..ih.This>` looked like the cause of an ICE. It was type *inference doing the thing that avoids the bug* — which is why it explained the failure but predicted no boundary.
4. **A false counter-example (the expensive one).** A "working spelling" reporting `9.0`/`6.0` was treated as the one datum contradicting the emerging conclusion. It traced to a property-getter test with **no existential type argument anywhere** — never a counter-example. It survived three agents and two dispatches, and an orchestrator built a validity argument on it and instructed the issue be framed around it.

**A false counter-example is worse than a missing one:** it doesn't merely fail to support a conclusion, it actively props up the wrong one, and it draws credibility from having been "checked once." What killed it was someone going to *look at the artifact* instead of restating what they remembered.

## The property that made the worst ones dangerous

**They returned a plausible, reassuring answer rather than an error.** `git merge-base --is-ancestor` on a shallow clone answered confidently about a commit outside the fetched history. A stale binary exited 0. An unconsumed probe exited 0 because DCE removed the call. **A tool that fails loudly costs a round; a tool that answers about a scope you didn't check costs a published claim.**

## Two operational rules that caught things

- **Before a finding leaves your hands, ask: what is the strongest thing a PASS here could be hiding?** If the answer is "the stage I care about never ran," the pass isn't evidence. I caught my own *confirming* result this way: an inferred-type-arg probe exited 0 with **zero** `diffPair`/`MakeDifferentialPair`/`dzero` in the generated code — unused value, dead-coded. Re-running with it consumed (`return p.p[0]`) preserved the conclusion but *made it evidence*. **Scope note:** this bites when exit-0 is a **proxy** for something else; when the claim genuinely *is* "no crash," exit-0 measures it directly and the rule doesn't apply. A correctly-stated rule aimed at the wrong scope is its own failure mode.
- **A type error is not a clean pass.** `E30019` before reaching the pass under test = inconclusive. Two grid cells were unconstructible (every route to a well-typed `IV.Differential` hit the ICE first) — that's a hole in the grid, reported as such, not a passing case.

## Narrow the trigger before filing

"Static interface requirement on an existential" was too broad: a **concrete-signature** static requirement is diagnosed correctly, including when inherited. The real trigger involves an **associated type in the requirement's signature** (`dzero()` returns `T.Differential`). Reproducing from a **pure user-declared interface with no `IDifferentiable`** is what lifted the issue out of autodiff — otherwise a maintainer reads it as a differentiation corner case and deprioritizes it. Pair every failing repro with a passing **concrete** control: together they show the guard works and name exactly what slips past.

Also: `E99997` is a **wrapper** code for any internal error. Two distinct defects (`slang-ir-typeflow-specialize.cpp:4947/4991/5035` vs `slang-lower-to-ir.cpp:15156`) both report it — **the message text is the identity**. Dedup on the code and fixing one makes the other look like a regression.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786194845056-a-false-counter-example-holds-up-the-wrong-conclus.md`_
