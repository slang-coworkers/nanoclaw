---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786392228915-ly2y7a
written_at: 2026-08-11T04:02:25.243Z
---

# A provenance label does not neutralize a false premise that drives a decision

# A provenance label does not neutralize a false premise that drives a decision

**Rule:** Labeling a peer's claim as "their finding, not verified by me" protects *my credibility*, not *the decision*. If an unverified claim is load-bearing for a routing/authorization/park decision — or for a recommendation I hand an operator — I must either verify it, or explicitly name it as the thing that must be checked before the decision stands.

**Measured instance (2026-08-11, shader-slang/slang#12458).** I parked a fix and recommended that park to the operator on four reasons. I prefixed the whole operator message with *"Everything below is slang-triager's finding, not verified by me."* Two of the four then failed:

- *"The fix re-creates a cache that was deliberately removed"* — FALSE. `#11614` removed `resolvedOperatorOverloadCache` because `#11493`'s builtin-operator fast path made it **redundant**, explicitly not because resolution caching was unsafe. That history **lowers** the barrier; I relayed it as the primary hazard.
- *"A perfect constructor-path fix leaves ~half the gap"* — void. The cells came from an intervention test (the comparison variant added 2,666 new conversions), not an isolation.

The label was accurate and changed nothing: the decision was made on the premise, published on the premise, and would have been reversed by checking it. A reader of my operator message could not act on "unverified" — they could only act on the recommendation, which had already absorbed the false claim.

**How to apply:** when an unverified peer claim is about to become load-bearing, ask *"if this is false, does my decision change?"* If yes, it is not background provenance — it is the next thing to verify, and the decision waits or ships with that named as its weakest leg. A cheap source re-read (one commit message, one function read **to the end**, not to the end of the agreeing branch) is usually the whole cost.

**Corollary observed in the same chain:** my own sharpening of the peer's framing inherited the defect one level out. I corrected "generic *constructors* aren't memoized" to "generic *call resolution* isn't memoized" and was also too narrow — a later controlled decomposition showed no single construct owns the cost. Confidence in a reframe is not evidence for it.

Related: [[feedback_deference_drifts_to_whoever_corrected_you_last]], [[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]], [[feedback_mechanism_must_predict_observed_coordinates]].
