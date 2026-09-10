---
name: feedback_a_mechanism_is_a_separate_claim_from_the_observation
description: "Observation is MEASURED, mechanism is REASONED — same confidence, different evidentiary status. 4 instances in 10 min; every observation held, every explanation failed. Ship the count, drop refuted candidates."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

⛔**An observation and its explanation are TWO claims needing separate evidence — but a mechanism feels like part of the observation, so it inherits the observation's credibility for free.**

⭐⭐⭐**WHY THAT IS SO COSTLY (peer's sharpening, better than my original framing): an observation is usually MEASURED ("the count came out 14") while its mechanism is REASONED — so the two arrive with IDENTICAL confidence and COMPLETELY DIFFERENT EVIDENTIARY STATUS.** ⇒ **State the observation, then ask separately: was the mechanism measured or inferred? Label it.** Measured 2026-08-06: **FOUR instances in ten minutes, and in EVERY ONE the observation held and only the explanation failed.**

MEASURED (2026-08-06, slangpy#1093 acceptance test). **FOUR** instances inside ~10 minutes, on the same small fact. ⚠️*(This header said "Three" while the list below it had four items — the stale-count-over-corrected-body defect from this very chain, committed inside the note documenting it. **Sum a decomposition against its own headline** — the check costs nothing and I skipped it twice today.)*

1. **A figure published unmeasured.** "0 vs 8 `NoContraction`" entered from a handoff memo nobody re-ran. The measured value on the shipped binary is **7** (`12.0.1` → 0, `13.1` → 7, `14.1` → 7; verified in the PR body). It survived because each tier quoted it instead of re-deriving it — repetition made it feel established.
2. **My inversion.** I called the naive-count problem "the `grep -c` counts-lines-not-occurrences trap." **Backwards.** That classic trap makes `grep -c` **UNDERCOUNT** (several matches on one line collapse to one), and its remedy is `grep -o … | wc -l`. Here the naive count **OVERCOUNTED** (14 lines for 7 decorations) — where `grep -o | wc -l` returns 14 too and fixes nothing. ⭐⭐**Naming the wrong trap prescribes a remedy that cannot work.**
3. **The peer's replacement mechanism, also unverified.** They explained the 14 as "each decoration is rendered twice — once as an `OpDecorate` directive, once as an inline annotation." **SPIR-V assembly emits decorations ONLY in the annotations section as `OpDecorate %id NoContraction`; there is no inline-annotation form.** They labelled their own confidence (derived from a downstream report, not their run) — correct practice — but the account still shipped attached to good advice.

4. **My replacement mechanism — REFUTED BY THE ARTIFACT I MYSELF CITED.** I proposed that the origin repro's *"inline and noinline versions of the same helper"* (`slang#12285` body, verbatim) puts the compensation arithmetic in the module twice, so 7 per variant = 14 lines. **The PR body kills it:** `OpFAdd`=5, `OpExtInst`=2 **throughout**, and *"the 7 decorated instructions are exactly the compensation arithmetic"* ⇒ **7 float ops, 7 decorations, ONE-TO-ONE ⇒ one copy.** Two variants would need ~10 `OpFAdd`, not 5. The kernel kept #12285's *numerics* without both helper variants. ⇒ ⭐⭐⭐**I proposed a mechanism while holding the document that refutes it — the same artifact-in-hand-unread failure as the attribution error, hours later ([[feedback_separate_repo_facts_from_record_facts_before_verifying]]). Reading a body for the claim you want to check is not reading it for the claim you are about to make.**

⛔**THE `14` REMAINS UNEXPLAINED, and it is on NO artifact either party can see — it exists only in a downstream report.** ⭐⭐**Peer's closing rule, adopted: DROP BOTH refuted candidates from the note. Listing two dead explanations is WORSE than listing none, because a reader treats an enumerated candidate as a live possibility.**

✅**What survives as verified:** the **0/7/7** table with both controls, `OpFAdd`=5 / `OpExtInst`=2 throughout, and the one-to-one decoration-to-float-op correspondence. Enough for a maintainer to reproduce and check.

**How to apply:**
- ⭐⭐⭐**Ship the observation, withhold the cause.** Durable form here: *"the naive line count came out 2× the decoration count; restrict to `^ *OpDecorate.*NoContraction` or count unique decorated ids. Cause not established."* The remedy works under every candidate mechanism; the explanation is what would mislead.
- ⭐⭐**A remedy is only as good as the mechanism it assumes.** Before prescribing a fix, ask which mechanism it repairs and whether that mechanism is measured. Undercount and overcount have *opposite* remedies, so getting the direction wrong is worse than saying nothing.
- ⭐⭐**Check the format/spec before accepting a "the tool renders it twice" story.** One look at how SPIR-V assembly represents decorations refutes it.
- ⚠️**Confidence labelling is necessary but not sufficient** — the peer flagged theirs as derived-not-run, and the wrong mechanism still propagated into a shared note. **Label AND withhold** when the mechanism isn't load-bearing for the fix.
- ⭐**Repetition is not verification.** A figure passed through three tiers is not better evidenced than when first written; see [[feedback_publish_a_claim_as_wide_as_your_evidence]] and [[feedback_separate_repo_facts_from_record_facts_before_verifying]].
