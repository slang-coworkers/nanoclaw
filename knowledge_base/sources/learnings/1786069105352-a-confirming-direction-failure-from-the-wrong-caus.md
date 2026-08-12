# A confirming-direction failure from the wrong cause — read the artifact carrying the property, not the harness verdict

## The nastiest instrument error of six in one review

On shader-slang/slang#12413, reviewer and fixer between them produced **six** readings that
their predicate could not have contradicted. Five looked like *absence* (a `0`, a blank, an
empty grep). The sixth looked like **evidence**, and that makes it far more dangerous.

**The case.** A test fixture was supposed to prove a diagnostic names the *best* same-module
overload rather than an order-dependent one. To show it discriminated, the author ran it against
a preserved pre-fix binary and reported:

```
swapped fixture vs bin.treatment  ->  FAILED   ✓ discriminates
```

FAILED was exactly what the hypothesis predicted, so it read as confirmation. But the actual
failure was:

```
Exhaustive check failed: Found 2 diagnostic(s) without annotations
```

— an artifact of his own edit having moved a `//CHECK` annotation. **The instrument did fail; it
just failed for a reason unrelated to the property under test.** Asking what the binary actually
*named* gave the opposite answer:

```
swapped fixture vs bin.treatment  ->  names 'func f(float)'    # the CORRECT answer
```

So the fixture did **not** discriminate, and the proposed change would have made the test
vacuous. The reviewer caught it only by deriving the pre-fix mechanism from the author's own two
data points (both fit *last*-applicable-wins, not first) and asking for a re-run.

## The rule

**When the claim is about a specific property, read the artifact that carries that property —
never the aggregate status of a process that also checks twenty other things.**

- claim: "which candidate does it name?" → read the **diagnostic text**
- claim: "does this test discriminate defect X?" → read what it *reports*, not pass/fail
- claim: "did CI pass?" → `gh run conclusion` is empty for **both** in-flight and no-result

A pass/fail is a conjunction over many properties. Reading it as evidence about one of them is
only valid if you've excluded the other conjuncts — which is exactly what you skip when the
verdict already agrees with you.

## Why it beats the "absence" shapes

| shape | reads as | invites the question? |
|---|---|---|
| `0` from a predicate that can't match | absence | sometimes ("could this fire?") |
| blank from a broken pattern | absence | sometimes |
| **failure from an unrelated cause** | **evidence** | **no — it looks like the finding** |

An absence at least prompts "could this have returned anything else?". A confirming-direction
failure short-circuits that reflex entirely.

## Two social amplifiers, symmetric

Both participants nearly accepted the other's wrong result:
- the author deferred to the reviewer's **track record** (right repeatedly all session)
- the reviewer nearly deferred to the author's **neatly formatted table** with a clean
  pass/fail column

Formatting confers unearned credibility exactly like a track record does. Note also the
reviewer's own error in the same exchange: reasoning about what a hypothetical implementation
*would* do, and asserting a binary "doesn't exist" on someone else's filesystem. It existed, and
behaved oppositely.

## The load-bearing habit

**All six errors were caught by measurement; none by argument.** In no case did either party
talk the other out of a wrong belief — every resolution came from running a command against a
cheap local artifact (a preserved pre-fix binary; a worktree build at the PR head). Keep those
artifacts; they are worth their disk cost, and they are the only thing that reliably settles a
disagreement between two confident readers.

## Test-design payoff

The fixture that survived: **three declarations with the best match neither first nor last**,
proven on three binaries (fixed → passes; last-seen → fails; feature-absent → fails). That
excludes first-seen, last-seen and feature-absent simultaneously, and its validity is checkable
by *reading* — no preserved binary required, so it outlives the disposable one.

Verify the load-bearing precondition explicitly (that the third overload is genuinely
*applicable* to the call's argument — if it isn't, it never occupies the "last applicable" slot
and the fixture silently degenerates into the vacuous case), and **record that fact in the
file**. Otherwise a future editor "tidying" the declaration order or dropping the third overload
restores the vacuous case with every arm still green — a failure with no detector.
