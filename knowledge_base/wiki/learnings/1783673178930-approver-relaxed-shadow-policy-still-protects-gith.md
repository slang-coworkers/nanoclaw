---
title: "approver: relaxed shadow policy still protects .github/** — CI-touching PRs ABSTAIN_POLICY before the review verdict is even read"
type: learning
topic: review-approval
source: learnings/1783673178930-approver-relaxed-shadow-policy-still-protects-gith.md
---

# approver: relaxed shadow policy still protects .github/** — CI-touching PRs ABSTAIN_POLICY before the review verdict is even read

[approver/clause-governance] On slang PR #12023 (compile-perf sweep tooling, live mode) the decision was **ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths** even though the review was clean-with-nits (APPROVE_WITH_NITS, 0 bugs, 5 🟡 gaps).

**Non-obvious mechanics worth remembering for the next such PR:**

1. The mounted `v0-shadow-relaxed` policy (`/workspace/extra/approver-policy/APPROVAL_POLICY.json`) relaxes author_trust (NONE ∈ trusted), fork heads (`allow_fork_head:true`), and CI (`require_ci_green:false`) — but it STILL keeps `.github/**` and `**/slang-tag-version.h` in `protected_paths`. So **any PR touching a CI-workflow file fails `no_protected_paths` regardless of how good the review is.** A whole class of PRs — perf-infra / CI-tooling changes that edit `.github/workflows/*.yml` — will systematically land ABSTAIN_POLICY.

2. **Step-1 clauses are evaluated (and can short-circuit the whole decision) BEFORE the Step-2 review-verdict parse and BEFORE the Step-3 challenger.** A clean `APPROVE_WITH_NITS` from the reviewer can never reach WOULD_APPROVE if a clause fails. Don't waste a challenger pass — the challenger only runs if Steps 1–2 BOTH pass. Run `eval-clauses.py` first; if it FAILs, the reason_code is the decision.

3. Classify correctly: touching a protected path is **ABSTAIN_POLICY** ("human must look"), NOT ABSTAIN_INFRA (that's pipeline defects like a missing/unparseable review doc). Codex DECISION_REVIEW confirmed this distinction.

4. Independent diff_hash check is cheap and worth doing every time: `gh pr diff <pr> | sha256sum` should equal the review doc's recorded `diff_hash`. Guards against the concurrent-run tmp/ race (learning 1783620361461) where a reviewer's recorded hash can belong to a DIFFERENT PR. Here it matched → the doc genuinely reviewed the head diff.

5. `reviewers_complete:false` (here: Devin/Reviewer B skipped, no in-container Chrome) is an independent bar to WOULD_APPROVE — an incomplete panel never rounds up — but in this case the clause fail governed first, so it was a secondary note, not the reason_code.

**How to apply:** For any slang PR routed to the approver, glance at the changed paths for `.github/**` FIRST. If present, the outcome is ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths and the review verdict only informs the human next-action bullet, never the decision. This is the shadow policy working as intended, not a bug to route around.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783673178930-approver-relaxed-shadow-policy-still-protects-gith.md`_
