---
title: "A refutation can be over-stated the same way a mechanism can — and it is more dangerous, because it licenses closing"
type: learning
topic: misc
source: learnings/1785776242563-a-refutation-can-be-over-stated-the-same-way-a-mec.md
---

# A refutation can be over-stated the same way a mechanism can — and it is more dangerous, because it licenses closing

Observed on slangpy#1089 across a three-tier chain. I'd built a root-cause mechanism, had it undercut, then over-corrected in the other direction — and the over-correction was the more dangerous error.

**The asymmetry.** An over-stated *mechanism* gets caught: someone tries to fix it and the fix doesn't work. An over-stated *refutation* licenses a decision — "that branch is impossible, so we can close it / drop it from the rationale / ship the other fix." Nothing downstream tests it. It fails silently.

**Concretely:** having shown a null-function-pointer story required a driver to report a feature bit true while omitting the corresponding extension, I called that "self-contradictory". A reviewer corrected it to **"driver-self-inconsistent"** — a strong claim about a *conforming* driver, not an impossibility. The population in play was driver 610.43.02 on Blackwell: a prototype stack, which is exactly where feature-vs-extension inconsistency shows up. One notch of overstatement would have retired a live hypothesis on a spec-conformance assumption that the actual hardware had no obligation to honor.

**Rules:**
- Grade your refutations on the same scale as your claims. "Impossible" needs proof that the state cannot be constructed; "would require a conforming implementation to misbehave" is the honest phrasing and it is *much* weaker.
- Watch for asymmetric hedging: I'd hedged the public comment ("close to self-contradictory", named the likelier branch) but sent the *unhedged* version to the coworker acting on it. Check the wording in the artifact that drives action, not just the one that's publicly visible. The handoff is often less carefully worded than the post, and it's the one that gets executed.
- When a latent defect is found while chasing a bug, it is frequently real *and* not the bug. Ship it on its own merits, never with a `Fixes #N`, and don't let either an over-stated mechanism or an over-stated refutation collapse the two — both roads end at "fixed a different bug, declared a live crash resolved."

**Chain lesson:** two tiers above the implementer each passed along an unchecked cite (a reviewer authorizing framing without fact-checking supporting dates; me relaying a critique tool's line cite without re-deriving). Both were caught *only* because the implementer refused to inherit a cite and re-derived it. Re-derivation downstream is not redundant work — it was the single control that kept a confident wrong answer from shipping. Treat any cite from a subagent, critique tool, or reviewer as a lead, especially when it is about to enter a public artifact or a handoff.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785776242563-a-refutation-can-be-over-stated-the-same-way-a-mec.md`_
