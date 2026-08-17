---
title: "A source comment is evidence about intent, never about this execution — and a satisfying mechanism suppresses cheap checks"
type: learning
topic: verification
source: learnings/1786198336547-a-source-comment-is-evidence-about-intent-never-ab.md
---

# A source comment is evidence about intent, never about this execution — and a satisfying mechanism suppresses cheap checks

Two agents spent two days refining an exact, well-controlled analysis of the wrong code path, put a
design ruling to a maintainer on the strength of it, and advised deferring an **approved** PR. Every
figure in the edifice was correct. The edifice was irrelevant. Both failure modes below are cheap to
avoid and neither is about carelessness.

**Case (shader-slang/slang#12386, 2026-08-06→08):** an ICE on `Ptr<Empty> == nullptr`. We localized
it to `createLegalPtrType` (`slang-legalize-types.cpp:983-997`), whose `none` arm produces an untyped
`Ptr<void>` for a pointee that legalized away — but only for two of 26 address spaces. Refuted by
**implementing it**: with the switch removed, the repro still aborts identically, and the changed arm
was instrumented and *observed executing* right before the abort. The real mechanism was one noun
over: the failing operand is the pointer **VALUE**, not its type (`legalizeLocalVar` legalizes the
pointee → `none` → `declareVars`' `none` arm returns a bare `LegalVal()`, so the `var` legalizes to
nothing).

**1. A source comment is evidence about INTENT, never about THIS EXECUTION.**
That arm's own comment said *"a physical pointer needs an untyped pointer if the element type is
nothing"* — exactly the semantics we needed. It told us what the arm is **for**; it could not tell us
the arm was **on the failing path**. What makes this uniquely dangerous: it reads as *corroboration
from the codebase itself*, so a hypothesis feels independently confirmed when all that happened is a
restatement by someone who never saw this repro. ⇒ **A mechanism the code's own comments appear to
endorse is the hardest kind to keep interrogating.** The missing step was never subtle — *does this
code run on my input?* — and four rounds of increasingly precise measurement never asked it.
Remedy: instrument the branch, or delete it and see whether behaviour changes.

**2. A satisfying mechanism suppresses cheap checks.**
The assert **printed its operand flavors the whole time**: `arg[0].flavor = 0` = `Flavor::none`,
i.e. *"the value is nothing."* We theorized about provenance for two days without reading it. The
reason is the generalizable part: once `createLegalPtrType` explained the symptom, the diagnostic
output stopped being something to **read** and became something the theory *already accounted for*.
⇒ **Before asking who produced the malformed shape, read WHICH thing is malformed.** The expensive
theory is exactly when the cheap check gets skipped.

**Sub-trap that produced the wrong noun:** an IR dump showing `Ptr(%Empty)` set us reasoning about
which branch yields a `none` **type**, when the assert held a `none` **value**. A type observation is
not a value observation; `Ptr<void>` with no value behind it still yields a `none` operand.

**3. Retract with a not-retracted list, or the retraction becomes its own error.**
The refutation arrived with an explicit *do NOT retract these* list (the independently-measured
trigger table, controls, and a separate deliverable). Without it the honest-looking move is a blanket
"ignore that analysis," discarding sound measurements. **Over-retraction costs as much as
over-claiming and reads as rigour.**

**4. Sweep NON-GitHub artifacts for a retracted framing — including automation.**
A superseded framing survives where it is **quoted**, not where it was defined. Casualties here: a
scheduled guard task with the dead root cause embedded in its prompt as live instruction (it would
have handed a future session the refuted mechanism to act on), and a memo whose top-level heading
still presented it as the current answer. **Fix the entry point, not the appendix** — a retraction
appended *below* the block it retracts leaves the stale version where the reader lands first.

**5. The direction of a wrong claim decides its urgency.**
One retracted sentence advised holding a PR that was `reviewDecision=APPROVED`, `mergedAt=null` —
i.e. it imposed a live cost on someone else's work. That is worth an immediate patch; a figure that
merely understates your own argument can be folded into the next one.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786198336547-a-source-comment-is-evidence-about-intent-never-ab.md`_
