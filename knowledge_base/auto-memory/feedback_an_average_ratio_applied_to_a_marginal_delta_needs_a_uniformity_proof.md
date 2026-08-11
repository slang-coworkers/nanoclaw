---
name: feedback_an_average_ratio_applied_to_a_marginal_delta_needs_a_uniformity_proof
description: "A ratio of two TOTALS cannot be applied to a DELTA without a uniformity assumption — and the assumption is invisible because the arithmetic is valid; 4.56 x 3.10 = 14.1 is correct multiplication and a false prediction"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e8e0b387-afc1-4d91-ab15-dd8e100744b7
---

**TRIGGER: you are about to multiply a measured ratio by a measured delta.** Ask whether the ratio
was derived from **totals** (A_total ÷ B_total) and whether you are applying it to a **margin**
(the slice added between two points). If both, you have silently assumed the quantity expands
**uniformly across content** — and nobody measured that.

**⭐ The reason this survives review: the arithmetic is valid.** `4.56 × 3.10 = 14.1` is correct
multiplication. There is no computational error to spot, no range check that fires, no absurdity
detector that trips (cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]], where
absurdity beat agreement). The defect is in the *domain* of the ratio, which the number itself
does not carry.

**Instance (2026-08-10, slang#12113/#12447).** ⛔**ATTRIBUTION, corrected by slang-triager against
its own credit: CODEX named this; the triager verified the mechanism at source and INVERTED the
draft rather than softening it. Not a self-catch, and not mine either.** Codex's round-1 MUST-FIX
worded it precisely: *"3.10× is the average expansion of the current full 20.5 MiB core-module
serialization, not a measured expansion factor for the marginal 4.56 MiB."* Their pre-critique
draft contained `76 MiB` ×1 and `16%` ×1 with **no** refusal paragraph; the post-critique version
has both at 0 and the refusal at ×1.
We were retracting a `~20x` IR-expansion factor after jvepsalainen-nv measured the real one at
`3.10x`. The first draft of the retraction reasoned: at 3.10x, the `+4.56 MiB` of blob added
in-window predicts only `+14 MiB` of RSS against `+90.4 MiB` measured, therefore *"~76 MiB
unexplained."* Refused, correctly: his `3.10x` is a **whole-module average** (in-memory total ÷
serialized total, from *"~64 MiB minus the serialized 20.5 MiB"*), and the `+4.56 MiB` is the
**marginal** content added between v2026.5 and v2026.7. Applying one to the other is licensed only
if that specific added content expands at the module average — unmeasured, and the leading
in-window contributor was explicitly *unproven in isolation*.

**⛔ The recursion is the lesson.** That draft would have bridged two real numbers with unverified
glue **inside a correction of a bridge between two real numbers**. The published version
(#12113 cmt `5237924529`) names the `~14 MiB` calculation as a trap, refuses it, and leaves the
residue **explicitly open** rather than substituting a second unverified factor.

**How to apply.**
1. Before multiplying, say out loud what the ratio's **numerator and denominator range over**. If
   they range over *everything* and your other operand ranges over *a slice*, stop.
2. The honest output is **"open"**, not a smaller number. A quantified-but-wrong residue reads as
   progress; "how much is blob-proportional remains open" reads as ignorance and is correct.
3. **A correction earns an ADVERSARIAL PASS — not merely extra care.** I first wrote this as "a
   correction is the highest-risk place for this, because the corrective frame supplies its own
   credibility." The triager refuted the *sufficiency* of that: they were **maximally careful on
   that draft and still shipped it into review with the defect intact.** Carefulness demonstrably
   did not cover this class, because there is no absurdity to trip on. ⇒ the operative remedy is a
   reviewer who is trying to break it, not vigilance. (The corrective frame's credibility is still
   a real hazard for the *reader*; it is just not a control on the *author*.)
4. Kin rule from the same exchange: **the glue between two real numbers is the part nobody
   audits.** Both the ×1.96 blob and ×1.93 RSS measurements were sound; only the factor joining
   them was invented. When a factor is withdrawn, **any inference leaning on it dies too** — it
   does not survive merely because its two inputs were measured (that cost the "ratios track ⇒
   blob growth accounts for RSS growth" causal reading, demoted to observation).

⛔**How the attribution error happened, since it is the same chain's other half.** Their report to
me said *"codex killed it, correctly, and I verified why myself"* — accurate. I relayed it upward
as *"the thing you caught in your own draft"*, promoting a verified-a-reviewer's-finding into a
self-catch **inside a compliment**, where it draws no pushback (cf.
[[feedback_a_fabrication_inside_a_compliment_survives_unchecked]]). Their objection is the
load-bearing part: ⭐⭐⭐**"their finding was right" and "they found it" are two claims, and the
second one changes how much checking the next reader thinks is needed.** A filed rule crediting an
unaided catch would license trusting their unreviewed arithmetic on precisely the failure mode with
no absurdity signal. ⇒ **when relaying, carry the DETECTOR, not just the finding** — and note the
polarity: they corrected credit *away* from themselves, which is the direction nobody audits.

Kin: [[feedback_check_a_quoted_claims_author_before_deciding_your_obligation]] (same chain — the
provenance half), [[feedback_audit_credit_as_hard_as_blame]], [[project_12113_minimal_compile_peak_rss_doubled]],
[[project_12447_on_demand_ir_loading_builtin_modules]],
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]] (withdrawing a factor
returns you to *unknown*, not to a fallback estimate).
