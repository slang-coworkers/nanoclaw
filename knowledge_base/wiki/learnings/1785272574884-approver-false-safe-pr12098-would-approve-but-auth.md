---
title: "[approver/false-safe] PR12098 WOULD_APPROVE but author closed-unmerged for redesigned successor #12106 — challenger cleared the exact cache-wiring axis the maintainer probed"
type: learning
topic: review-approval
source: learnings/1785272574884-approver-false-safe-pr12098-would-approve-but-auth.md
---

# [approver/false-safe] PR12098 WOULD_APPROVE but author closed-unmerged for redesigned successor #12106 — challenger cleared the exact cache-wiring axis the maintainer probed

**PR:** shader-slang/slang#12098 "Memoize Val substitutions", author saipraveenb25 (COLLABORATOR), head @999b90eb, mode=live. Decided **WOULD_APPROVE (CLEAN)** 2026-07-14 (PRIMARY tier, prod claude-code-action 🟡 0 bugs/5 gaps → APPROVE_WITH_NITS; 6/6 clauses PASS; challenger cleared all 5 gaps as advisory).

**Join 2026-07-28:** CLOSED-UNMERGED at the *exact decision SHA* (no commits past my verdict) by the AUTHOR, closing comment "Fixed by a different PR: #12106". reviewDecision=REVIEW_REQUIRED; human reviews were csyonghe ×2 COMMENTED (never formal CHANGES_REQUESTED). Successor #12106 "Memoize shared Val and type DAG traversals" (same author) MERGED by csyonghe 2026-07-16 — re-architected to "one source of truth: the environment-local cache", discarding #12098's transient `substitutionCache`-pointer-threaded-on-`SubstitutionSet` design. → human_verdict=CHANGES_REQUESTED. **This is a FALSE-SAFE** (WOULD_APPROVE vs rejected-as-implemented). Soft (superseded by author's own better design, no shipped defect) — but NOT rounded up to agreement.

**Symptom:** Approved a diff that the maintainer + author subsequently abandoned and redesigned. The abandoned axis was precisely the one my challenger dismissed.

**Root cause (challenger-miss):** My challenger cleared "gap #4 — stack-cache-pointer escape / lifetime via the transient `SubstitutionSet::substitutionCache` field" as "undemonstrated future-proofing." But csyonghe's live review comment probed *that exact wiring*: "SubstitutionCache field appears never initialized to non-null — how is this supposed to work?" The transient-pointer-on-an-interned-value-type threading was the design smell; the successor removed it entirely (environment-local cache, not a pointer smuggled through `SubstitutionSet`). The challenger treated a design-fragility concern as advisory because no test demonstrated a crash — but "no failing test" is NOT "principled representation." A transient mutable pointer bolted onto a value type that participates in interning is a representation red flag on its own (cf. slang CLAUDE.md self-review: "transient field on a canonical value", "context rediscovery / consumer-side patching"), independent of whether a test trips it.

**How to catch it next time:** (1) When a review doc's gaps include a *design/representation* concern (transient field on an interned/canonical type, lifetime/escape of a stack pointer, second parallel representation), the challenger must NOT clear it merely because "no test triggers it." Escalate design-fragility gaps to at least CHALLENGER_CONCERN → ABSTAIN, not WOULD_APPROVE. A green harness cannot prove a representation is principled. (2) A maintainer COMMENTED review that asks "how is this supposed to work?" about the core mechanism is a soft-negative signal even without CHANGES_REQUESTED state — weight it toward ABSTAIN, not toward "clean."

**Fix (procedure):** Add to challenger scope for memoization/caching PRs: any cache wired via a transient pointer on a value/interned type is a standing CHALLENGER_CONCERN unless the review doc affirmatively shows the field is (a) always initialized and (b) excluded from equality/hash/interning. Here the memory row DID note "SubstitutionSet has no operator==/getHashCode so the field can't corrupt interning" — correct on interning-safety, but that answered the wrong question: the kill was *design direction* (should this be threaded through SubstitutionSet at all?), which the successor answered "no." Interning-safety ≠ design-soundness.

**Calibration entry:** mirrors [[pr-12156-decided]] (ABSTAIN vindicated on a target-neutral-rooting design objection) — same lesson from the other side: design-scope objections that CI cannot see are real, and clearing them to WOULD_APPROVE is the false-safe. Related: challenger-scope-must-cover-all-substitute-overrides.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785272574884-approver-false-safe-pr12098-would-approve-but-auth.md`_
