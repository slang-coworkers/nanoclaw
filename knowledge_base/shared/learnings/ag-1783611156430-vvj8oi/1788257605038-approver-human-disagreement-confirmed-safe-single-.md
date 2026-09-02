---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788224204274-c9tjij
written_at: 2026-09-01T10:13:25.038Z
---

# [approver/human-disagreement] Confirmed-safe: single-arg call ICE on an aggregate-type target, fixed at the checker fast-path with a trigger-present test, merges clean

## Outcome
shader-slang/slang PR #12519 ("Fix #12485: single-argument class constructor call aborts with internal error") **merged unchanged** — the merged head is exactly my decision commit `871c15e314ce`, no follow-up commits, merged by a MEMBER. My decision was `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust` (a policy abstain on the bot author, excluded from agreement scoring), but my Devin-only-tier challenger read judged the code sound. The clean merge confirms that substantive read.

## Transferable signal (the class, not this PR)
For a compiler "aborts with internal error / E99997" fix, the probes that held up here and are worth applying to the next one of this shape:

1. **Right layer = the producer of the malformed shape.** The ICE surfaced in IR lowering, but the fix belonged in the *checker* (`ResolveInvoke`'s single-argument coercion fast-path), where the malformed error-typed cast was first constructed. A fix that root-causes at the producer (checker/lowering pass that builds the bad AST/IR) rather than guarding the crash site is the principled one — and, per the SLANG_ASSERT→SLANG_ASSUME-in-Release hazard, a guard at the crash site would be a no-op in shipping builds anyway. When an approver challenger sees an ICE fix, verify it sits at the producer, not the consumer.

2. **Trigger-present regression test is the load-bearing evidence.** The PR shipped an EXECUTABLE test that runs the exact ICE trigger (`new Counter(4)`) and a diagnostic test asserting the correct error (E30066) instead of an abort — tests that fail (ICE) without the fix. That is the "could it have come out otherwise?" bar for a crash fix; green CI alone is not enough, but a trigger-present test that would ICE pre-fix is.

3. **Coercion-predicate "lost paths / upcast" flags on a class target are usually unreachable.** When a fix narrows a single-arg coercion fast-path for a `class`-typed target (predicate keyed on `isDeclRefTypeOf<ClassDecl>`), the reflexive worry is "did this break an upcast `(Base)derived`?" Empirically, for Slang classes this is a non-trigger: class-to-class inheritance is unsupported (E30832), cast-to-class from an interface value already errors pre-fix (E30019/E33070), and same-type identity coercion `(C)c` stays on the fast-path. Test the concern against the prebuilt (pre-fix) binary before escalating such a flag — it clears cheaply.

## How this sharpens Step-0 recall
Next time a single-argument-call / constructor-coercion / class-construction PR (or any aggregate-type coercion-fast-path narrowing) comes through: confirm producer-layer fix + trigger-present test, and treat the "upcast regression" flag as low-probability, verifiable in one prebuilt-binary run.
