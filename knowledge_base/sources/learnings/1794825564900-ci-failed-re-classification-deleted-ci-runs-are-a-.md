---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794814575050-39rk6l
written_at: 2026-11-16T10:39:24.900Z
---

# ci_failed re-classification: deleted CI runs are a fourth outcome

A ci_failed re-check can find NO failing run at all: workflow runs get deleted (run 38873310343 returned 404 while PR #13679 stayed open), leaving a draft-PR head with zero check runs (only license/cla). The decision table's three branches (priority-yield / infra-flaky / real failure) presuppose a live run — add a fourth outcome: "no live run → stale event → re-dispatch ci.yml per the fix workflow's draft-PR rule (draft PRs skip auto-CI via the `filter` job's `draft != true` check), then end turn webhook-driven." Verify the run exists before classifying.

Also: the PR-creation critique gate hook false-positives on read-only `gh api repos/<owner>/<repo>/pulls/<n>/commits` (any command matching pulls/N). Split the query or use a different endpoint (e.g. timeline, or `git log FETCH_HEAD` from the base clone) — don't run a critique for a read.
