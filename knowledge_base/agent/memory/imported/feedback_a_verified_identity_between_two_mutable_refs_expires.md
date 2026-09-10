---
name: feedback_a_verified_identity_between_two_mutable_refs_expires
description: "An equality/identity claim spanning two open PRs is true only at the shas measured. A force-push on the OTHER side made my correct finding false ~35min later with nothing changing on mine. Re-measure at every redelivery; pin both shas."
metadata:
  node_type: memory
  type: feedback
---

**Instance (2026-08-10, nanoclaw#1177 vs #1176).** I verified that a CI `python:` job block was **byte-identical** across two open PRs — `sha256 60e48e57…`, 62 lines, both sides — and reported it as the evidence closing an ownership caveat ("two copies that agree cannot drift"). It was a good measurement, correctly scoped (see [[feedback_compare_the_unit_the_claim_is_about]]).

**~35 minutes later it was false, and nothing on my side had changed.** The other PR was **force-pushed** (`beba52bd` → `20af817f`) and redesigned; its `ci.yml` no longer contained that job at all. My finding did not become *wrong* — it **expired**.

⭐⭐⭐**An equality claim spanning two mutable refs is a claim about a moment, not a property.** One-sided facts (a file's content at a sha, a test result on a commit) are pinned by the sha you measured. A *relation between two branches* has two moving premises, and either one moving voids it — including the one you are not working on and have no reason to re-check.

⇒ **Re-measure any cross-ref identity at every redelivery/webhook, and pin BOTH shas in the report.** Pinning both is what made my retraction clean: I could say *"correct at `beba52bd`, void at `20af817f`"* — dated, provable, not a vague reversal. Had I written "identical to #1176", the claim would have been unfalsifiable and the correction would have read as me changing my mind.

⚠️**The tell arrived disguised as my own bug.** My extractor returned **0 lines / 0 bytes** for the other side while the fetched file was a healthy 15,085 B. The instinct is *"my awk pattern broke"* — and that instinct would have hidden the finding. ⭐**A zero from an extractor is ambiguous between "the pattern broke" and "the thing is genuinely gone"**; resolve it against the RAW artifact (grep the marker → 0 matches; `head -5` → valid file) before believing either. Cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — identical shape, opposite resolution: there the zero was false, here it was true. **The shape does not tell you which; only the raw check does.**

✅**The expiry was not a nuisance — it carried the real finding.** The other PR's redesign meant the job it was supposed to preserve would vanish on deploy, inverting the reviewed PR's central rationale (two checks silently stop running). ⇒ **When a cross-ref claim expires, do not just strike it — ask what the OTHER side's change now implies.** A stale relation usually means one side moved for a reason, and the reason is often the thing worth reporting. Per [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]], voiding it returns the question to *unknown*: I had to re-derive what nv-main's copy would now do, not assume the old conclusion held or that its negation did.
