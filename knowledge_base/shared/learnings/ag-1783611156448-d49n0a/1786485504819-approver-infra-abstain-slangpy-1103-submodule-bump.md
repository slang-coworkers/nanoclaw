---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786483526984-2isdpd
written_at: 2026-08-11T21:58:24.819Z
---

# [approver/infra-abstain] slangpy#1103 — submodule-bump PRs are a review-harness blind spot → NO_REVIEW_SIGNAL

**Decision:** shader-slang/slangpy#1103 "Update slang-rhi" @bf203803e37a → ABSTAIN_INFRA (NO_REVIEW_SIGNAL), 2026-08-11.

**Symptom.** A 1-line submodule pointer bump (`external/slang-rhi` f4b8d6e5→632b0aee) produced ZERO review signal from every source the approver harness consumes, forcing an infra-abstain even though the change is almost certainly safe.

**Root cause — this PR class is blind to the review harness by construction:**
- **CodeRabbit** explicitly *skips* it: its config path-filters `!external/**`, so the only changed path (`external/slang-rhi`) is ignored. It posts a "Review skipped due to path filters" issue comment and a green `CodeRabbit` commit status — the green status is NOT a review. `collect-reviews.sh` correctly returns exit 20 (nothing harvestable).
- **Production `github-actions[bot]` (claude-code-action)** is not present on this PR (no review, no review check-run).
- **Devin** reviews the *PR diff*, which is only the submodule pointer — it cannot see into the slang-rhi submodule contents. Even when it completes it has near-zero signal here; on #1103 it timed out (devin-fetch.sh exit 3, 20m).
- Result: no bot review AND Devin failed → `reviewers_complete=false` → Step-2 harness-integrity fail → NO_REVIEW_SIGNAL.

**How to catch it / what actually discriminates.** For a submodule bump the real risk lives in the transitive commit range, invisible to a file-diff reviewer. The cheap head-current signals that DO discriminate (gather them for the ledger/challenger context even though they can't round an abstain up to WOULD_APPROVE — self-review is forbidden):
1. `gh api repos/<sub>/compare/<old>...<new>` — is it a clean FF? how many commits / how much churn? are the commits merged to the submodule's main via reviewed PRs?
2. Did any public `include/` header change? (ABI surface the consumer binds against). If only internal `src/**` changed, blast radius to the consumer is bounded.
3. Is `<new>` still the submodule main tip, or was there a post-merge revert/hotfix?
4. The consumer's OWN CI on the head — and check whether its "build" jobs actually run tests. slangpy's `tools/ci.py` runs C++ + Python unit tests + examples on self-hosted GPU runners, so green CI here is a genuine *positive control* (GPU work dispatched against the new dep and passed), not merely "no red flags."

**Fix (to drive this infra-abstain to ~0).** The harness has no review source that covers submodule-bump PRs. Options for a human/operator: (a) wire a reviewer that diffs the submodule commit range (not the pointer), or (b) treat consumer-CI-green as an explicit approve-eligible signal for the narrow "submodule-pointer-only diff, ABI-stable, upstream-reviewed" class via a policy clause. Until then, this PR class will keep landing as NO_REVIEW_SIGNAL. Related: [approver/human-disagreement] slang-rhi#830 (same author/area, dependency-adjacent GPU work held on missing positive control).
