# A test passing for the WRONG REASON is worse than a vacuous one — every routine check comes back green

## The failure

On shader-slang/slang#12434, a companion regression test was added to pin a *second* code path
(existential legalization) reaching a shared `legalizeInst` `default:` arm. Its header claimed:
*"an interface-typed value is lowered away by existential legalization and reaches it the same way.
This pins that second path."*

Everything you would normally check came back green:
- `slang-test` → pass.
- Direct `slangc` run → correct diagnostic `E51702`, correct line:col, caret on `==`.
- Mutation test on the message text → test fails when text is mutated, so **not vacuous**.
- Removing `non-exhaustive` → still passes, so nothing was being suppressed.

**All of that was true, and the test still did not test what it claimed.** `slang-emit.cpp:2886-2891`
clears `shouldLegalizeExistentialAndResourceTypes` for `CPP`/`C`/`CUDA`, and
`legalizeExistentialTypeLayout` is gated on that flag — so on `-target cuda`
`IRExistentialTypeLegalizationContext` is **never constructed**. The test's `struct Impl : IFoo`
had no data members, so `Impl` was itself an empty struct: it reached the arm through the *same*
empty-type context as its sibling test.

## The discriminator that settles it in one command

Vary the property the test claims is load-bearing, and see if the outcome changes:

```
Impl WITH a data member (int data), -target cuda → exit 0, kernel emitted   <- claim refuted
Impl EMPTY (as committed),          -target cuda → E51702                    <- passes via emptiness
```

If existential legalization were carrying the test, adding a field to `Impl` would not change the
outcome. It does ⇒ the test passes for a different reason than advertised.

## Why the usual instruments cannot catch this

- **Mutation testing proves the assertion is connected to the output, not that the input exercises
  the intended mechanism.** Mutating the *message* makes any test of that message fail, whichever
  path produced it.
- **Observing the outcome is not observing the mechanism.** "The diagnostic fired at the right
  line" and "the diagnostic fired *because of the thing I am testing*" are different claims
  requiring different evidence.
- A reviewer who reports "both paths verified end-to-end" after checking only the outcome has
  issued a **false all-clear** — which is worse than saying nothing, because it retires the question.

## Rule

For any test whose value depends on *which* path/pass/branch produced the result, add a
**discriminating control**: a variant that removes the claimed cause and must produce a
*different* outcome. Absent that, you have evidence the code reports something, not evidence about
why.

Corollary on repair: check the obvious fix works before proposing it. Here, retargeting to
`-target spirv` (where the pass *does* run) fails earlier with
`E31160 '__getAddress' cannot take the address of a function-local variable on this target` — so the
shape needed rethinking, not a flag change. The clause was dropped and the test deleted instead.
