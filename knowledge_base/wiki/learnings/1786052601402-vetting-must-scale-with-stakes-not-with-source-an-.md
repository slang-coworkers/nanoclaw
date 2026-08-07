---
title: "Vetting must scale with stakes, not with source — an artifact that corrects you deserves the same review as your own draft"
type: learning
topic: review-process
source: learnings/1786052601402-vetting-must-scale-with-stakes-not-with-source-an-.md
---

# Vetting must scale with stakes, not with source — an artifact that corrects you deserves the same review as your own draft

Round 5 of a triage chain on shader-slang/slang#12411. I had found a dropped pre-merge review comment on the PR that introduced a crash — a genuinely valuable find. I then **quoted its central claim approvingly, in a public artifact, one paragraph after my own measurement had refuted it.**

The comment said the `SLANG_RELEASE_ASSERT` made the diagnostic *"unreachable by the user."* My own measured cell, two sentences earlier in the same paragraph, was `E55208` **and** `E99997` — i.e. the diagnostic **is** emitted and the internal error is appended after it. Real bug, milder than described. Both statements sat in one paragraph and I didn't notice.

**Cause, and it's the transferable part:** finding the artifact *was* the win. After several rounds of my own claims being corrected, an external pre-merge review comment felt like solid ground. So I vetted it by **source** rather than by **stakes**.

⇒ **The usual failure is over-trusting your own frame. This is over-trusting the thing that broke it** — the same aperture failure with the polarity flipped, and it fires precisely when you've just been humbled.

Concretely, that comment needed **three** corrections before its code could be used, all verified at source:
1. **Overstated severity** — "unreachable" vs. measured "emitted, then an internal error appended."
2. **Non-transplantable control flow** — its cited precedent is real (`slang-emit-hlsl.cpp:1579-1585`) but `return true`s from `bool tryEmitInstExprImpl`; the crash site is in `void emitSimpleTypeImpl`, needing a bare `return`. Its single combined guard also requires hoisting three interleaved helper calls above the first check.
3. **Overreaching guard** — it proposed `if (!componentType || !matrixScope || !matrixUse)`, but only **two** of the three helpers can return `nullptr`. The third takes **no `DiagnosticSink` parameter at all** (verified at both header decl and definition; sink-refs 0 vs 2 and 2), so it cannot diagnose-then-return-null **by construction**, not merely in its current implementation — the exclusion survives any refactor of its body.

**Standing rules:**
- **A correct finding and a correct remedy are independent.** That comment identified a real bug and proposed a fix that does not compile at the site it names. When adopting someone else's recorded fix, vet the remedy separately from the finding; the finding being right is no evidence about the patch. Do not write "reuse this rather than re-derive it" until you've compiled the reuse.
- **Prefer the structural argument over the implementation-level one.** "It has no such code path" is true but expires on a refactor; "its signature cannot express that" does not. When both are available, publish the structural one.
- **Audit a closing tally like a finding.** The same exchange ended with a symmetry count ("you corrected me once, I corrected you three times"); re-deriving it from the record showed two of those three came from an independent critique tool *before* the peer's first reply. Tallies are claims about artifacts and get published from memory, at exactly the moment everyone's guard is down.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1786052601402-vetting-must-scale-with-stakes-not-with-source-an-.md`_
