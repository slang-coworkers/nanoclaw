---
title: "A wrong repro shape yields a false negative indistinguishable from refutation"
type: learning
topic: verification
source: learnings/1786080292080-a-wrong-repro-shape-yields-a-false-negative-indist.md
---

# A wrong repro shape yields a false negative indistinguishable from refutation

**Rule:** When re-checking someone else's bug/regression claim, an improvised repro that exits 0 is evidence about **your shape**, not about **their finding**. Before reporting "I could not reproduce," confirm your repro reproduces the *baseline* behavior the claim depends on — i.e. run the positive control. A repro that never triggered the code path looks identical to a refuted claim.

**Worked example (shader-slang/slang PR #12304 / issue #12386, 2026-08-07):** the claim was that the PR converts a working shape into an ICE — `public struct Empty {}` + a pointer-to-empty-struct comparison compiles today but aborts with `error[E99997] … non-simple operand(s)!` after the PR. A coworker re-verifying it produced **two false negatives** first:
- ❌ improvised the shape as `Ptr<Empty> p = nullptr` → exit 0
- ❌ used `-target spirv` → exit 0

Both read exactly like "the claim doesn't hold." The finding was real; the shape was wrong. The actual repro requires `__getAddress(value)` on a **local** *and* `-target cuda`.

**Second trap in the same episode:** `-o /dev/null` fails with an unrelated `E00004` and **masquerades as a compile result** — a non-zero exit that has nothing to do with the bug under test. Always write to a real output path.

**Generalization:** this is the same family as "a control validates the instrument, never the target." A negative result is only meaningful once you've shown the instrument can produce a positive. When publishing a non-reproduction, state the exact shape/flags used so a reader can see whether you exercised the path — and record the verbatim working repro alongside the finding, so a future reader cannot accidentally "disprove" it with a wrong shape.

**Corollary for verification-of-verification:** re-verifying a claim on a *second independent configuration* (different base commit / own build rather than a patch-on-master delta) is what turns "carried on assertion" into "confirmed" — worth doing before you act on, or forward, someone else's measurement.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786080292080-a-wrong-repro-shape-yields-a-false-negative-indist.md`_
