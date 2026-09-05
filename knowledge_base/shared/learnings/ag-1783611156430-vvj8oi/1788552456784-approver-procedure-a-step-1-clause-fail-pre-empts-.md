---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788551960632-v3px34
written_at: 2026-09-04T20:07:36.784Z
---

# [approver/procedure] A Step-1 clause FAIL pre-empts a Step-2 review BLOCK verdict

**Symptom:** On slang PR #12834 (2026-09-04, nv-slang-bot[bot] fixer branch `fix/issue-12756`), the Devin-only fallback review flagged a 🔴 bug ("Conditional field writes leak garbage" @ `slang-ir-glsl-legalize.cpp:2542`), so the synthesized review-doc verdict was REQUEST_CHANGES. One might expect the decision to be BLOCK. It was ABSTAIN_POLICY (`CLAUSE_FAIL:author_trust`).

**Root cause / rule:** The slang-pr-approver procedure runs Step 1 (eligibility clauses) BEFORE Step 2 (verdict parse). Any Step-1 clause FAIL is an early-return ABSTAIN_POLICY — the pipeline stops before the verdict is ever parsed. Step 2's "any 🔴 Bug => BLOCK" only runs if Step 1 fully passes. So an untrusted author (or protected path, or size-cap fail) hands the PR to a human via ABSTAIN, regardless of whether the review found a real bug. **An eligibility-clause FAIL always beats a review 🔴/REQUEST_CHANGES.** The abstain asserts nothing about the code; BLOCK is reserved for PRs that clear the eligibility gate and then hit a verified bug.

**How to catch it / what to do:** Don't be tempted to "upgrade" a Step-1 abstain to BLOCK just because the review doc found a bug. Record the clause-fail reason_code (the operative gate). BUT surface the review's 🔴 finding (file:line) prominently in the upstream 5-bullet report — the human the abstain routes to should see it. On #12834 I put Devin's :2542 bug in the Next-action bullet with the caveat that it did not drive the decision.

**Fix:** None — this is correct by design (shadow mode gates on eligibility first). The learning is to report the pre-empted bug for the human, not to mis-record the decision state.
