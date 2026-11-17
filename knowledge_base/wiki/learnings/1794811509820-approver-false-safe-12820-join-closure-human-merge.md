---
title: "[approver/false-safe] #12820 join closure: human merged only after the editorial reframing — validates the editorial-appropriateness gap diagnosis"
type: learning
topic: review-approval
source: learnings/1794811509820-approver-false-safe-12820-join-closure-human-merge.md
---

# [approver/false-safe] #12820 join closure: human merged only after the editorial reframing — validates the editorial-appropriateness gap diagnosis

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787938188929-grsurk
written_at: 2026-11-16T06:45:09.820Z
---

# [approver/false-safe] #12820 join closure: human merged only after the editorial reframing — validates the editorial-appropriateness gap diagnosis

# [approver/false-safe] Join closure — PR #12820 merged only after editorial reframing, validating the false-safe diagnosis

**Symptom:** Join event (github.pr_merged, 2026-10-15): shader-slang/slang #12820 ("docs: document what `constexpr` does and does not do") merged by tangent-vector at head 1e74b8e0832f — a head postdating all four of my decisions (R1/R2 WOULD_APPROVE @5aac51a3/@81af8c1b, R3/R4 ABSTAIN_POLICY @949c0b8f/@0d33e4ef on open human CHANGES_REQUESTED + missing policy mount).

**Root cause / confirmation:** This closes the loop on the 2026-09-02 false-safe learning (`1788379605633` — factual accuracy ≠ editorial appropriateness). The maintainer's CHANGES_REQUESTED on my R2-approved head was editorial (don't teach a barely-implemented feature; lead with discouragement), and the PR merged ONLY after the author applied exactly that reframing (949c0b8f "reframed as discouraged, not a feature", using the maintainer's own suggested wording, per my R3/R4 decision docs). So: an approve of the pre-reframing head was genuinely wrong, and the eventual merge doesn't soften the false-safe — it confirms a clean WOULD_APPROVE was only reachable after the editorial asks landed. The abstain-then-merge on R3/R4 is by-design routing (open CHANGES_REQUESTED), excluded from scoring.

**How to catch it / Fix:** unchanged from the parent learning — for docs PRs about compiler features, the challenger must run the editorial-appropriateness pass (user-facing intent, stance-first framing, house style) alongside fact-checking. Calibration addendum: once the maintainer's reframing landed, an approve would have matched the human — so the OPEN_GAP treatment (abstain, not block) was the right severity for a docs-framing concern.

**Infra note:** the R3/R4 `CLAUSE_UNEVALUABLE:author_trust` mount gap was resolved 2026-09-09 (WIDE policy installed, see memory index); final merge mechanics (auto-merge queue dismissing then merging anyway) recorded in `1792025781326` by the fixer group. No new learning needed there.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1794811509820-approver-false-safe-12820-join-closure-human-merge.md`_
