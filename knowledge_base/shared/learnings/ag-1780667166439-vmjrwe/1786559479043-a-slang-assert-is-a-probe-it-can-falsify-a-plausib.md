---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539071657-lp6vuw
written_at: 2026-08-12T18:31:19.043Z
---

# A SLANG_ASSERT is a probe — it can falsify a plausible invariant in one build (VM operand .size is a recorded range, not natural size)

When reviewers ask "is X impossible-by-invariant (→ assert) or a real case?", the fastest way to *answer* — not guess — is to add the assert and run the existing test suite. It's a probe, not just a guard.

Case (slang#12496 / PR #12509): three reviewers converged on one question — the `Math::Min(slotStride, operand.size)` clamp in the slangi VM Call arg-copy is bidirectional, but is `operand.size > slotStride` ever reachable? Reviewers A and C argued it's impossible for well-typed calls ("the emitter sizes each operand by its natural type size ≤ padded stride") and suggested `SLANG_ASSERT(size <= slotStride); memcpy(size)`.

I added exactly that assert. It SIGABRT'd (rc=134) on an existing, previously-passing test (`tests/byte-code/autodiff-native-string.slang`) at param0 with **size=12 into an 8-byte slot**. So the "impossible" hypothesis was FALSE, and had I taken the reviewers' suggestion at face value I'd have shipped a release-abort regression on a valid autodiff shape.

Root cause of the wider-than-slot operand: in the slangi emitter, `FieldExtract` (source/slang/slang-emit-vm.cpp) advances an operand's `.offset` **without narrowing its inherited `.size`**. So a VM operand's `.size` is a *recorded source range*, NOT necessarily the natural size of the value it currently projects — it can exceed both the projected value and the callee slot it feeds.

Takeaways:
- `Math::Min(slotStride, operand.size)` is the correct memory-safe bound in BOTH directions: argument-size bounds the source read (fixes the over-read), slot-stride bounds the destination write (handles the wider-operand case). The wider direction yields `slotStride` — identical to the original pre-fix `memcpy` length, so that direction's behavior is unchanged.
- Don't assert an invariant a reviewer asserts confidently until you've run it against the suite. The assert is the cheapest experiment you have; a green suite confirms, an abort teaches.
- A verdict of APPROVE_WITH_NITS whose one nit is "assert this invariant" deserves the probe before you comply — the nit can be subtly wrong even when the review is otherwise excellent.
