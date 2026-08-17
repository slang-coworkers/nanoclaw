---
title: "[approver/calibration] Large test-only consolidation abstained on size cap → human APPROVE-with-known-nits (cap vindicated)"
type: learning
topic: review-approval
source: learnings/1785514761596-approver-calibration-large-test-only-consolidation.md
---

# [approver/calibration] Large test-only consolidation abstained on size cap → human APPROVE-with-known-nits (cap vindicated)

**Signal (transferable, not PR-specific):** A large test-only consolidation PR (all changed paths under a `tests/` tree, +3000–3200 lines, no shipped-code changes) that resolves to ABSTAIN_POLICY on the deterministic `tier_eligible` size cap is very likely to be **APPROVED by a human maintainer who explicitly merges over known, non-blocking nits**. Observed on slangpy#1085: both decision rows (R1 `a1da5beac5af`, R2 `777165da48aa`) were ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible; the PR merged at exactly my R2 head with a human review reading *"I think it's fine for it to go ahead in. There's a bunch more that could be done, but I've delayed this getting in too long already... an LLM prompt about maintainability will turn up [nits]... probably better just to get it in."*

**Root cause / why this is the right behavior:** The size-cap abstain is NOT a code judgment — it's a routing decision ("a human must weigh this"). The human's call here ("enough coverage now vs. perfect-but-delayed") is exactly the trade-off a bot cannot and should not make. Abstains are excluded from agreement scoring precisely because they defer, and this merge is the abstain working as designed — a vindication, not a false-safe or a disagreement.

**How to catch / apply it (sharpens Step-0 recall):** When a future large test-only PR hits the same size-cap abstain, do NOT be tempted to "help" by rounding a clean-looking test diff toward WOULD_APPROVE, and do NOT log it as ABSTAIN_INFRA. Record the plain ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible and let the human decide — the maintainer routinely merges these over maintainability nits. The class-scaled-cap lever noted in the sibling `[approver/clause-gap]` learning is the only thing that would change the outcome; the challenger cannot.

**Secondary procedural note — CodeRabbit harvest-timing near-miss:** On this fresh PR, CodeRabbit's first `COMMENTED` review (7 actionable, then 13) landed at 15:04:52 / 15:11:28 — only ~73 s AFTER the exit-22 poll window closed at 15:03:39 (12 iterations × ~30 s ≈ 6 min). The poll timed out `pending_bot: CodeRabbit` and fell to Devin-only. It didn't change the outcome (size-cap FAIL short-circuits at Step 1, before any review verdict is parsed), but the ~6-min exit-22 poll can be marginally too short for CodeRabbit's ASSERTIVE-profile full review on a 24-file PR. If a future decision actually depends on the CodeRabbit signal (i.e. clauses pass and we reach Step 2), consider widening the exit-22 poll beyond 6 min, or note the near-miss timing when falling to Devin-only. All 20 CodeRabbit comments were nit/maintainability-level (consistent with the human's "slog" description), so no 🔴 was missed.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785514761596-approver-calibration-large-test-only-consolidation.md`_
