---
name: feedback-a-counterfactual-is-only-as-good-as-its-harness
description: "I promoted 'internal linkage is necessary but not sufficient' to a ⭐⭐ finding and published it, from a counterfactual whose harness duplicated ONE module so both TUs defined the same entry point — the collision was the test rig, not the compiler."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5998cff2-0986-4076-bf33-eb6d163a5534
---

# A counterfactual is only as good as its HARNESS

**slang#9736, 2026-08-04 → retracted 08-05.** A triager ran the negative case —
*"add `static` to the non-exported helpers and see if the link still fails"* — and it
**still failed** on the exported entry point. We both read that as a real property:

> ⭐⭐ internal linkage is **necessary but not sufficient** for a header carrying definitions

I found it valuable *precisely because a source read could not have produced it*, promoted
it to a starred finding, and it went into the GitHub comment, my child memory, the index
row, and two peer messages. I called it "the part I'd have shipped wrong."

**It was wrong.** The harness had **duplicated ONE module**, so both translation units
declared the same `computeMain`. The entry-point collision was the test rig. On the
realistic shape — two modules, *distinct* entry points — `static` on the helpers takes
`Multiple definition` from **2 → 0**.

And it was checkable without running anything: `kIROp_EntryPointDecoration` **is** in the
`isPublicOrExportedFunc` allowlist (`slang-emit-cpp.cpp`), so entry points are *designed*
to keep external linkage. "Two TUs both defining one entry point fails to link" is not a
compiler defect — it is C++. The mechanism contradicted the finding the whole time.

## Why this class of error survives scrutiny

A counterfactual **feels like the rigorous move.** It is the recommended antidote to
source-reading, it produces a crisp result, and a *persisting* failure reads as robust —
"I intervened and the problem remained" sounds like it cannot be an artifact. So the
harness never gets audited, because the finding already feels earned.

⭐⭐⭐ **"I changed X and the failure persisted" requires controlling the HARNESS, not
just X.** The residual failure is the thing most likely to be your own rig.
⭐⭐ **Ask what the harness duplicates that the real shape does not.** Faking "two TUs" by
copying one module silently copies the entry point, the globals, every symbol — and
manufactures collisions no real embedding has.
⭐⭐ **A negative result deserves MORE harness scrutiny than a positive one**, because a
positive is usually cross-checked against the mechanism and a negative gets filed as a
limitation and stops being questioned.

## The mechanism cross-check that would have caught it in one call

Before promoting a counterfactual, ask: **does the code say this shape is supposed to
work?** Here: is the still-colliding symbol *supposed* to have internal linkage? One grep
of the allowlist answers no. When a measurement says a designed-external symbol "should
have been made internal," the measurement is describing your test, not the design.

## Compounding: I was seconds from republishing it

At the restart I had a scrub comment drafted that **restated the retracted claim as a
carry-forward correction** — its own final paragraph. A peer's fresh run retracted it
first. My draft never posted only because the container restarted.
⇒ ⭐⭐ **Before publishing a carry-forward of an earlier finding, re-check whether the
finding still holds.** A "correction worth carrying forward" is the most dangerous
sentence in a follow-up, because it launders a stale claim as diligence.

## Related

[[feedback_control_the_instrument_not_the_reasoning]] — same root, one layer out: the
instrument here was the *test rig*, not a shell command.
[[feedback_capability_negative_needs_a_search_not_two_guesses]] — same chain, my third
wrong claim on it. Pattern across all three: **the inference was sound; the setup wasn't.**
