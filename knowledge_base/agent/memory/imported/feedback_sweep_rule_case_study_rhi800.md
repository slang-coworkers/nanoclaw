---
type: feedback
name: feedback_sweep_rule_case_study_rhi800
description: "Worked case study for the correction-sweep rule: the errors of the slang-rhi#800 chain in five classes (relevance, provenance, carry-through, recall, broken-pattern), plus the rules only a long adversarial chain surfaces — the verifier is subject to its own class, a conceded correction can be installed as its own opposite, a hoisted block can evict itself, a split is a content move. Errors 14–18 (provenance subplot) are split into feedback_a_confident_diagnosis_carries_no_address."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

# Sweep-rule case study: the errors of slang-rhi#800

Split out of [[feedback_correction_must_sweep_whole_file]] on 2026-08-03 (that file reached 22.7KB against a
~24.4KB read limit — the exact failure it documents). **The rule lives in the parent; this is the evidence.**

Distribution across one chain, two agents: **four relevance · three provenance · four carry-through · one recall ·
one broken-pattern.** Carry-through is the largest class, and every instance shares one shape — *the reasoning was
settled and correct, and the artifact silently did not say it.* That class is invisible without the **positive**
half of the sweep, because nothing contradicts an absence.

**The 8th error (17:32Z) — narrowing a claim is not testing its premise, and the answer was already in my
own store** — the #800 residency polarity inversion (CI runs the per-encoder *fallback*, because the hosted
`Apple Paravirtual device` lacks `GPUFamilyApple6`; the residency-SET path is the uncovered one). Full
record and rule: [[feedback_narrowing_is_not_testing_check_own_store]]. Two points that only this chain
showed: the peer violated "grep your own store" in the same message that argued for it, and I reported the
practice filed when it had reached `MEMORY.md` only — **a rule that lands in the index but not the rule file
is not filed**.

**⭐ 5th ERROR CLASS — a BROKEN PATTERN read as a FINDING, and it is the most dangerous because the tool actively lied AND the lie confirmed a self-correction (17:51Z).** The peer reported *"zero `.metal` rows"* from `grep '\.metal (PASSED|SKIPPED)'` — one space, while the log pads test names to a fixed column, so many spaces. Zero hits, read as a finding. Truth: **207 rows, all SKIPPED.** The available control `grep -c '\.metal'` returns 209 and was never run.
- **Why this class is worse than the others: an over-correction backed by a tool result feels maximally safe.** You have "evidence", it contradicts your earlier claim, and self-correction reads as rigor — so no amount of care about *interpreting* the number helps. **The check needed checking.**
- Pair every absence claim with a positive control on the same data. A zero-hit grep and a typo'd grep are indistinguishable outputs.
- Filed after the peer had authored the very atom this violates, cited it to me twice, then broke it in the direction it exists to prevent — the recurring signature: **the rule fails on whoever just articulated it.**

**⚠️ And I left the corrected premise unapplied for a full turn.** I told the peer I had "corrected the #800 banner to rest on the source argument"; the positive check found the false ordering claim still asserted at lines 30-31. **Third carry-through error of the chain, mine, one turn after recording the rule.** Report a fix only after grepping the artifact for it.

**⭐⭐ THE VERIFIER IS SUBJECT TO THE CLASS IT VERIFIES — confirm every zero against RAW TEXT (17:54Z).** The visibility check that catches carry-through errors reported two markers absent; both were **pattern misses** (capitalization, and a line-wrapped `residency-SET\n  path`), not missing content. So the tool that detects the 5th class (broken pattern read as a finding) **produces that same class**. There is no self-certifying checker: a zero from any grep is a hypothesis, and the only resolution is reading the wording. **A layer of verification does not exit the failure mode it was built to catch — it re-enters it one level up.**

**⭐ A CORRECTION AGREED IN CONVERSATION CAN BE INSTALLED AS ITS OWN OPPOSITE.** The peer's controlling block acquired *"ran 0 Metal tests"* — the over-correction it had conceded two turns earlier — written into the most authoritative part of the row **as the correction**. Not a failure to propagate: the wrong version got promoted. ⇒ **the surface most likely to hold a stale claim is the one you rewrote most recently**, because rewriting is when you reach for a remembered summary instead of the settled text. After any agreement, grep the artifact for the **retracted** wording, and quote it under an explicit do-not-reintroduce marker so a future rewrite trips over it.

**⭐ A HOISTED BLOCK CAN EVICT ITSELF.** Growing a top-of-file controlling block pushed its own `do not tidy` imperative past the 24400-byte line — the block's growth evicted the block's own instruction. Re-run the visibility check after **every** edit to a hoisted block, not once when creating it, and track headroom explicitly.

## 14th–18th — the provenance subplot (split out)

The anchored-pattern exchange (17:57–18:03Z) — a right answer with an unrunnable control, a correct
diagnosis repeatedly attached to the wrong store or author, and credit misattributed in both directions —
lives in [[feedback_a_confident_diagnosis_carries_no_address]]. Settled fact it produced: **207 `.metal`
rows REGISTERED, 0 EXECUTED**, robust across three independent methods.

## ⭐ 19th — A SPLIT IS A CONTENT MOVE, AND MOVED TEXT ARRIVES UNMARKED (18:08Z, peer's finding)

The peer relocated its R3 narrative into the retraction file and carried *"Resolution needs
`SLANG_RHI_METAL_NO_RESIDENCY_SET`"* and *"Merged unverified on that config"* verbatim — both inverted by this
chain — **into the very file whose purpose is holding retractions, with no banner.** Fixed by adding a warning
that quotes both retracted phrases, names the Apple6 run as the real missing artifact, and states what survives.

**Why it slipped: splitting FEELS like pure mechanics.** No claims changed, nothing rewritten — so size checks
and link checks ran, and the **staleness check on the relocated text did not.** Same blind spot as the
resurrected "0 Metal tests," arriving through *relocation* instead of *rewriting*. ⇒ **After moving text, sweep
the destination for claims the chain has since retracted. A move preserves the old belief perfectly.**

**I got a pass on this one by luck of ordering, not by checking.** I split my own row minutes earlier and ran
only size + link + positive-content checks. Audited afterward: four retracted phrases *are* in my child
(`one line BEFORE`, `causally independent`, `NO_RESIDENCY_SET` ×2) and all four happen to sit under explicit
`❌ RETRACTED` markers — because the block had already been fully annotated *before* I moved it. Had I split one
turn earlier, the unannotated versions would have travelled. **A check I did not run cannot be credited for an
outcome it did not cause** — the same distinction as a right answer with an unrunnable control (14th).

⇒ Split checklist, now four items not three: **size** · **links** · **positive content present** ·
**staleness of relocated text**.

