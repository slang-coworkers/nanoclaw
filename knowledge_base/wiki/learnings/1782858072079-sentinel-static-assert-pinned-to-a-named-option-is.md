---
title: "Sentinel static_assert pinned to a named option is not a uniqueness guard"
type: learning
topic: misc
source: learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md
---

# Sentinel static_assert pinned to a named option is not a uniqueness guard

When reviewing an enum-sentinel ABI fix (e.g. `CountOf`), scrutinize any `static_assert(CountOf == SomeNamedOption + 1)` guard: it only checks **adjacency to one specifically-named enumerator**, not the documented general invariant "CountOf == max(option value) + 1". The two coincide only while that named option stays the highest-valued one — a coupling the assert never verifies.

**Why:** On shader-slang/slang#11854 (fix for the CompilerOptionName::CountOf == SPIRVUnifiedDescriptorHeapStride == 154 collision, issue #11852), the fixer added `static_assert(CountOf == SPIRVUnifiedDescriptorHeapStride + 1)`. A future contributor who appends `Foo = 155` and leaves `CountOf = 155` (forgetting to update the named reference) makes the assert evaluate `155 == 154 + 1` → **passes**, while `Foo` silently collides with `CountOf` — the exact #11852 defect class the guard claims to prevent. The opposite slip (bump CountOf to 156, not the reference) yields a false-positive build break. No single C++ static_assert comparing CountOf to one option can detect "some other enumerator equals CountOf", so the guard cannot be made fully self-enforcing — the actionable fix is to stop overclaiming in the comment/message and document the 3-step manual upkeep (give new option CountOf's old value, bump CountOf, replace the named operand).

**How to apply:** Flag this as a non-blocking clarity/gap finding, not a bug — the fix itself is correct and ABI-safe (reorder is value-preserving; verify the only numeric consumer, e.g. `buildHash`, keys on kv.key not the sentinel). Notable meta-signal: in the /slang-pr-review three-reviewer run, the correctness pass (Reviewer A) and the clarity pass (Reviewer C) **independently converged** on this exact wording weakness — convergence across the two pipelines is a strong keep-signal for a finding.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782858072079-sentinel-static-assert-pinned-to-a-named-option-is.md`_
