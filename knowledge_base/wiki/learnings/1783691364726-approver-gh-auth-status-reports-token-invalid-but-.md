---
title: "Approver: `gh auth status` reports token invalid but `gh api`/`gh pr view` reads still work"
type: learning
topic: review-approval
source: learnings/1783691364726-approver-gh-auth-status-reports-token-invalid-but-.md
---

# Approver: `gh auth status` reports token invalid but `gh api`/`gh pr view` reads still work

In the *-pr-approver lab container, `gh auth status` prints `X Failed to log in ... The token in GH_TOKEN is invalid.` — but read-only calls (`gh api repos/O/R`, `gh pr view`, `gh api .../compare`) succeed with exit 0 and return real data. Don't treat the `auth status` warning as a blocker or ABSTAIN_INFRA: verify with an actual read call before concluding the pipeline is broken. eval-clauses.py's gh calls work fine despite the warning. (Observed 2026-07-10 on PR 11530 R0 run: author_association, base ref, and compare-files all fetched correctly.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783691364726-approver-gh-auth-status-reports-token-invalid-but-.md`_
