---
title: "[approver/infra-abstain] ci_green_on_sha unevaluable on check-runs-only repos (combined-status API empty)"
type: learning
topic: review-approval
source: learnings/1788949627703-approver-infra-abstain-ci-green-on-sha-unevaluable.md
---

# [approver/infra-abstain] ci_green_on_sha unevaluable on check-runs-only repos (combined-status API empty)

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788949116007-00nu39
written_at: 2026-09-09T10:27:07.703Z
---

# [approver/infra-abstain] ci_green_on_sha unevaluable on check-runs-only repos (combined-status API empty)

## [approver/infra-abstain] `CLAUSE_UNEVALUABLE:ci_green_on_sha` on repos that use GitHub-Actions check-runs only

**Named artifact:** `slang-pr-approver/scripts/eval-clauses.py`, clause `ci_green_on_sha` (reads `gh api repos/{repo}/commits/{sha}/status`, the *legacy combined commit-status* API).
**First hit:** slang-coworkers/nanoclaw#1500 @ f2de65cc4eca (policy v0-shadow-wide-r2), 2026-09-09. Governance PR, all other clauses passed.

### Symptom
A PR whose CI is fully green infra-abstains at Step 1 with `CLAUSE_UNEVALUABLE:ci_green_on_sha`. On nanoclaw#1500 all 7 GitHub-Actions check-runs were `completed/success` (incl. both `test (22)` and `test (24)`), yet the clause reported `combined status=pending @ <sha>` → unevaluable → ABSTAIN_POLICY.

### Root cause
`ci_green_on_sha` reads the **combined commit-status** endpoint (`/commits/{sha}/status`), which aggregates only *commit statuses* (the legacy Statuses API). GitHub-Actions workflows report via the separate **check-runs** API (`/commits/{sha}/check-runs`); they do NOT post commit statuses. On a repo whose CI is check-runs only — nanoclaw is one; so is any shader-slang/slang PR that isn't also getting a commit-status from CodeRabbit/an external CI — the combined-status endpoint returns `{"state":"pending","total_count":0,"statuses":[]}` **no matter how green the check-runs are**. The clause maps `pending`/none → unevaluable, so it is *structurally* unevaluable on those repos and will never pass. (Verified empirically: with 5 check-runs already success, `total_count` was still 0.)

This bites precisely because policy v0-shadow-wide-r2 sets `require_ci_green: true` fleet-wide — the clause is now always consulted. PR #1500 is the very policy that turns that on.

### How to catch it
Before trusting an ABSTAIN on `ci_green_on_sha`, cross-check the two CI surfaces on the pinned head:
- `gh api repos/{repo}/commits/{sha}/status --jq '{state,total_count}'`  → what the clause sees.
- `gh api repos/{repo}/commits/{sha}/check-runs --jq '[.check_runs[]|{name,status,conclusion}]'`  → the real GitHub-Actions state.
If `status.total_count == 0` while check-runs exist and are green, the abstain is an eval-clauses gap, not a real CI problem. `gh pr view <pr> --json mergeStateStatus,statusCheckRollup` also exposes the check-run rollup the clause is blind to.

### Fix (for the operator / eval-clauses.py)
`ci_green_on_sha` should consider the **check-runs** conclusion (or GraphQL `statusCheckRollup`, which unifies both surfaces) — e.g. pass when combined-status is success OR (combined-status total_count==0 AND all non-skipped check-runs conclude success), fail on any failure/timed_out, unevaluable only while a required run is still in_progress/queued. Otherwise every check-runs-only repo infra-abstains on green PRs. Related but distinct from the earlier "empty policy mount → fallback to bundled v0-shadow" class (that was a mount-source gap; this is a CI-signal-source gap in the clause itself).

### Note (scope)
nanoclaw is an infra/governance repo; the approver's stated domain is shader-slang/slang + slangpy. Whether nanoclaw PRs should route to the approver at all is a separate open question flagged to the operator on #1500.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788949627703-approver-infra-abstain-ci-green-on-sha-unevaluable.md`_
