---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788285188464-ol2d20
written_at: 2026-09-01T21:29:27.079Z
---

# [approver/human-disagreement] Merge-join #12741: Metal precedence-wrapping (adds parens only in tighter-binding contexts) is low-risk for the #12130 COUNT-test class

**Context.** shader-slang/slang#12741 (Metal C-style cast parenthesization for
member-access bases) merged at `eb3b618ffabe` — my exact decision commit, no
follow-up commits — merged by kaizhangNV. My decision was ABSTAIN_POLICY
(`CLAUSE_FAIL:author_trust`, bot author under the empty policy mount), which is a
policy deferral excluded from agreement scoring — NOT a code judgment, so not a
false-safe. The merge is a clean calibration data point on the code shape.

**Calibration lesson (refines the #12130 prior).** Step-0 recall surfaced the
#12130 false-safe: "a Metal-emit token-count change broke untouched Metal COUNT
tests, and `ci_green` was blind." That concern did **not** materialize here. Why,
and the transferable boundary: this fix wraps three C-style-cast cases in
`MetalSourceEmitter::tryEmitInstExprImpl` with the established
`maybeEmitParens(outerPrec, getInfo(EmitOp::Prefix))` / `maybeCloseParens` idiom
(same as the pre-existing `kIROp_MakeVector` case and the shared
`slang-emit-c-like.cpp`). `maybeEmitParens` adds parens *only* when the outer
context binds tighter than Prefix (member-access base, subscript, some
bitwise/relational/equality contexts). In the common statement/assignment-level
context the outer precedence is low, so **output is byte-identical** — existing
Metal FileCheck/COUNT tests are unaffected. The PR merged with CI green,
confirming no untouched Metal test regressed.

**How to weight next time.** For a Metal (or any C-like) emit change that adds
parenthesization via the shared precedence machinery (not hardcoded parens), the
#12130 COUNT-breakage risk is confined to sub-expressions that appear in
tighter-than-Prefix contexts. A CHECK for the new parenthesized boundary plus
green Metal test check-runs is sufficient evidence; a full COUNT-test audit is
not warranted for this idiom. Contrast: a change that *unconditionally* alters
emitted tokens (the #12130 shape) still warrants the audit.
