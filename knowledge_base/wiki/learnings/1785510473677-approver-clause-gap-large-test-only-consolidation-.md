---
title: "[approver/clause-gap] Large test-only consolidation PRs abstain on tier_eligible size cap"
type: learning
topic: review-approval
source: learnings/1785510473677-approver-clause-gap-large-test-only-consolidation-.md
---

# [approver/clause-gap] Large test-only consolidation PRs abstain on tier_eligible size cap

**Symptom:** slangpy#1085 ("Consolidate test coverage from #761 and #928") — a clean, purely test-only PR (24 files all under `slangpy/tests/slangpy_tests/`, +3141/−59 ≈ 3200 lines, no runtime/SGL/binding changes) resolved to ABSTAIN_POLICY on `CLAUSE_FAIL:tier_eligible` (3200 > 2000-line cap in v0-shadow-relaxed). The other 5 clauses passed and the review signal was clean (Devin empty Flags; no github-actions[bot] review on slangpy; CodeRabbit timed out pending).

**Root cause:** `eval-clauses.py` computes `tier_eligible` from raw `additions+deletions` churn with no carve-out for change *class*. Test-coverage-import/consolidation PRs are inherently large (they paste many new test bodies) yet low-risk — they touch no shipped code. The size cap treats a 3200-line test import identically to a 3200-line compiler-core rewrite.

**How to catch it:** When a PR is test-only (all changed paths under a `tests/` tree, zero runtime/binding/build files) AND the ONLY failing clause is `tier_eligible`, recognize this as the expected, benign abstain — the decision is correct (a human should eyeball a 3200-line diff) but it is NOT a code concern. Don't spend challenger effort; Step-1 FAIL is dispositive and short-circuits before the challenger by design.

**Fix (procedure note, not a code change I can make):** The abstain is working as intended in shadow mode. If maintainers want large-but-test-only PRs to reach the challenger, the lever is a policy tier that scales `max_total_lines` by change class (e.g. a higher cap when 100% of changed paths match `**/tests/**`), not a challenger override — the challenger cannot upgrade a Step-1 clause FAIL. Until then, expect test-consolidation PRs above ~2000 lines to abstain here. Related false-safe priors for test PRs still apply *when they do reach the challenger*: tests-only revisions can turn CI green without fixing code; whole-TEST_CASE skips can silently drop deterministic coverage. On #1085 those were checked and clean (skips reworded to cite slang #940 but preserved; silent `return`→explicit `pytest.skip`; tautological asserts strengthened).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785510473677-approver-clause-gap-large-test-only-consolidation-.md`_
