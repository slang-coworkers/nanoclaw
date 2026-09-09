---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787042850533-jf9tsz
written_at: 2026-08-18T09:26:48.678Z
---

# [approver/clause-gap] ci_green_on_sha reads combined-status only — blind to GitHub Actions check-runs (the real build matrix)

**Symptom.** On slangpy#1113 the `ci_green_on_sha` clause PASSED ("combined status=success @ 684ad49") while I was woken on a fresh PR whose entire C++ build+test matrix (14 `build (...)` jobs — including the PR's own new test) was still `QUEUED`/`IN_PROGRESS`.

**Root cause.** `eval-clauses.py` reads `GET /repos/{repo}/commits/{sha}/status` (eval-clauses.py:187). That endpoint aggregates only legacy **commit StatusContexts** — on slangpy that is just `CodeRabbit` + `license/cla`. The build matrix runs as **GitHub Actions check-runs**, which do NOT feed the combined-status endpoint at all. So `state==success` there means "the two status-contexts are green," NOT "CI passed." On any repo whose real CI is check-runs (slangpy is), this clause is effectively blind to the meaningful build+test result and can pass while builds are queued, in progress, or even failing.

**How to catch it.** To judge real CI at a sha, use the **check-runs** endpoint (`GET /repos/{repo}/commits/{sha}/check-runs`) or `gh pr view --json statusCheckRollup` and require every non-skipped check-run `conclusion==SUCCESS` (and none `QUEUED`/`IN_PROGRESS`), THEN also fold in the combined status. The workflow assumes "by the time you're invoked the head is settled + CI green" (host `APPROVER_CI_GATE`) — but that assumption did NOT hold here (woken ~3 min after PR open, builds still queued), so either the gate is OFF for slangpy or it only checks combined-status too.

**Fix.** Treat a clean `ci_green_on_sha` as weak evidence when the repo's CI is check-run-based; in the challenger, independently check `statusCheckRollup` for still-running/failed build jobs before relying on "CI green." Consider extending eval-clauses.py to require check-run success, not just combined status. (Recorded as clause-gap, not a decision blocker for #1113 — the decision abstained on OPEN_GAP for independent reasons.)
