---
title: "Resolving a self-contradictory review finding: measure a third quantity, don't adjudicate the prose"
type: learning
topic: review-process
source: learnings/1785891049289-resolving-a-self-contradictory-review-finding-meas.md
---

# Resolving a self-contradictory review finding: measure a third quantity, don't adjudicate the prose

When one review artifact contains two contradictory claims (e.g. a measured table saying "works before, breaks after" and a summary saying "broken both ways"), **do not pick a side, and do not accept a forced binary** — go find the third quantity that actually decides, and prefer *rerunning the instrument* over weighing the sentences.

**Concrete case — slang-rhi#810.** Reviewer A's top finding claimed a push-constant-only descriptor set at a *lower* space than a real set made the fix shift that real set's `pSetLayouts` index. Its table annotated pre-fix as matching SPIR-V (⇒ a regression); its own summary said both states were broken. The reviewer above it had endorsed the summary.

Both were wrong. The deciding fact was one function away and in neither report:

- `BindingDataBuilder::allocateDescriptorSets` opens with `SLANG_RHI_ASSERT(specializedLayout->getOwnDescriptorSets().size() <= 1)` (`src/vulkan/vk-shader-object.cpp:673`).
- **`SLANG_RHI_ASSERT` is NOT debug-gated in slang-rhi** — zero `NDEBUG`/`_DEBUG` occurrences in `src/core/assert.h`; it expands to `handleAssert()` which `fprintf`s then calls **`std::abort()`** (`src/core/assert.cpp:21-30`), suppressible only inside a `ScopedDisableAssert` (unused anywhere in `src/vulkan/`). **It aborts in release builds too.**
- Measured root own-set counts: the two disputed shapes were **2 → 1**; the PR's own shape was **1 → 0** (its ParameterBlock set is a *child* set, which is why it passed the assert pre-fix and the others didn't).

So those shapes **abort before binding pre-fix** — pre-fix `pSetLayouts` ordering is unobservable, the "accidental padding made the mapping correct" story is false (the padding made the *count* violate the assert), and the fix **strictly improves** them by satisfying the assert. Finding stayed a documentation gap; verdict unchanged.

**Three reusable rules:**

1. **Ordering vs cardinality.** Everyone was reasoning about *order* of a vector; the gate was its *size*. When a conclusion depends on a data structure, enumerate every predicate anything asserts about it — not just the property under discussion.
2. **A forced binary is itself a framing, and framings can be wrong about the option set.** "Which of these two do you stand behind?" was correctly aimed and wrongly optioned. Being right that something is wrong doesn't make you right about the alternatives.
3. **Keep subagent instruments on disk.** A's probe/simulator survived in `/tmp`, so the contradiction was re-measurable instead of arbitrable. Also: check a tool's argv convention before reading a crash as a result — a segfault from passing 1 arg to a 4-arg simulator looks exactly like a broken instrument.

**Corollary on assert-based reasoning:** before claiming "this shape works today", check whether an assert on the path is debug-gated. A `SLANG_RHI_ASSERT`-style macro that is unconditional (no `NDEBUG` guard) means the shape crashes in *all* configurations — which can convert an apparent regression into an improvement. That single check was the point where the whole adjudication could have collapsed.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785891049289-resolving-a-self-contradictory-review-finding-meas.md`_
