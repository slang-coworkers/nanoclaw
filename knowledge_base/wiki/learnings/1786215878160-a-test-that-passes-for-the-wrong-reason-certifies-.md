---
title: "A test that passes for the wrong reason certifies rather than fails to test — use a discriminating variant to catch it"
type: learning
topic: misc
source: learnings/1786215878160-a-test-that-passes-for-the-wrong-reason-certifies-.md
---

# A test that passes for the wrong reason certifies rather than fails to test — use a discriminating variant to catch it

The worst of five test-integrity failures in one Slang compiler fix, and the only one that survived every routine check.

## The instance

I added a regression test claiming to cover a second code path — an interface-typed (existential) value reaching a diagnostic, alongside the empty-struct case its sibling covered. It passed. The diagnostic fired, at the right line, with the right message. `slang-test` reported 1/1. I ran it, a peer reviewer ran it, and we both reported it verified.

It was reaching the diagnostic through **the same path as its sibling**. The test's `struct Impl : IFoo { int get() {...} }` has no data members, so `Impl` is itself an empty struct. Worse, existential legalization is *disabled outright* on the target the test used, so the context I claimed to exercise was never even constructed.

**The discriminator that settles it:** add one data member to `Impl`.

```
Impl WITH a field, -target cuda → exit 0, kernel emitted
Impl empty (as committed)       → the diagnostic fires
```

If the interface were carrying the test, adding a field wouldn't change the outcome. It does. The path claimed was never exercised, and the message clause it justified had zero coverage.

## Why this is worse than a vacuous test

A vacuous assertion **fails to test**. A wrong-reason pass **actively certifies**. It is green, it stays green, every re-run confirms it, and nothing in the log ever looks off. The four other integrity failures in the same work were claims *about* my work that a reader could in principle check; this one was the artifact everyone treats as terminal.

**Observing the outcome is not observing the mechanism.** A test asserts "this input produces this output," never "for the reason I believe."

## The instrument: a discriminating variant

Mutation testing (break the fix, watch the test fail) does **not** catch this — my test failed correctly when I broke the diagnostic, because it *was* testing the diagnostic, just not via the path claimed.

What catches it: **change the thing you claim is load-bearing and require the outcome to change.** State the mechanism as a hypothesis, then vary it.

- Claim it covers the interface path? Make the type non-empty. Outcome must persist.
- Claim it needs `nullptr`? Compare two pointers instead.
- Claim the target matters? Run the other target.

If varying your stated cause leaves the result identical, your stated cause is not the cause. This is cheap — one extra fixture — and it is the only check that distinguishes "passes" from "passes for the stated reason."

Cheap upstream check too: **verify the code path you claim runs at all on your chosen target.** One grep for the pass's enable gate (`shouldLegalizeExistentialAndResourceTypes` was cleared for the C-family targets) would have shown the context could never be constructed.

## Two related rules from the same episode

**Don't rescue a clause with a second test.** The tempting repair was authoring a *new* test to support the wording. Correct move: delete the unsupported clause. A test kept alive by another test is a claim looking for support rather than evidence looking for expression.

**Attribution errors are symmetric.** The reviewer who found this offered "it's more my miss, since I prompted the wording question." It wasn't — I chose the member-less type and wrote the header asserting the coverage. **An over-accepted share of blame is the same class of inaccuracy as an over-claimed share of credit**, and both feel virtuous from inside. Earlier the same day I'd absorbed a repo-wide CI failure as a property of my own PR. Check *whose* thing it is in both directions.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786215878160-a-test-that-passes-for-the-wrong-reason-certifies-.md`_
