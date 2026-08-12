---
title: "A consequence of a claim is not evidence for it — restatements inherit the open dependency, and 'impossible' must be a search's conclusion, never its premise"
type: learning
topic: verification
source: learnings/1785826510128-a-consequence-of-a-claim-is-not-evidence-for-it-re.md
---

# A consequence of a claim is not evidence for it — restatements inherit the open dependency, and "impossible" must be a search's conclusion, never its premise

**Context:** shader-slang/slang#11917 batch-2. I claimed three tag insts are "not covered by the tagged-union implication" (over-claim; they're co-emitted with their implier). When a downstream fixer reported a blocked codex must-fix — "can't write a test that isolates the direct scan arm" — I wrote that co-emission *"also explains the blocked test: no isolating test can exist,"* and told the fixer to document the impossibility instead of building the test.

**The error:** that explanation is not additional evidence for co-emission. It is the same claim wearing a different hat, and it inherits the same unresolved dependency. "No isolating test can exist" holds *only if* a consuming inst can never reach the governing scan without its implier — which was precisely the open question (survivability). Both statements flip together on the same fact, so neither can audit the other.

**Rule 1 — a consequence of X cannot corroborate X.** When a second statement feels like it confirms your finding, check whether it's *downstream of the same premise*. If it is, it adds zero evidential weight — it only adds apparent authority. Same shape as: agreement isn't corroboration when the peer's source is you. A real challenge owes a **different instrument**.

**Rule 2 — "impossible" must be the conclusion of an exhausted search, never its premise.** Telling an implementer "this is unsatisfiable, document it instead" can make them stop looking — and skip the exact construction that would answer the open question. Dangerous because it's self-sealing: nobody looks, so the claim never gets contradicted, so it hardens.

**The reframe that fixed it — the search for the test and the answer to the open question were the SAME TASK:** *if* you can construct a module that reaches the governing scan with the consumer present and the implier eliminated, that construction simultaneously (a) proves the guard load-bearing and (b) **is** the regression test. So the objective is "try to build it," not "prove it can't be built." Converts a dead end into the actual objective.

**Underlying shape (worth memorizing):** **co-emission at production ≠ co-presence at the governing scan.** Two insts emitted together by the same producer can be *separated* later — DCE/SCCP/simplification may kill one while the other survives to the scan that reads them. So "always emitted together" never licenses "always seen together by a later scan." This is the producer-vs-governing-scan check applied to a *pair* of insts rather than one.

**Meta:** both errors in this chain were a **wrong mechanism riding a right conclusion** — the shipped code is identical either way, so no test, review, or CI signal could ever contradict them. Only a direct re-trace can. And the wrong mechanism had been relayed twice and stored labelled "safety-critical," which is exactly where such errors hide: a repeated label reads as settled. When correcting, fix restatements **in place**; an appended retraction leaves the false claim where the reader lands first.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785826510128-a-consequence-of-a-claim-is-not-evidence-for-it-re.md`_
