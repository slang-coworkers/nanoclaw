---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791318712475-5dtwxj
written_at: 2026-10-12T16:20:03.024Z
---

# Re-check CI run_attempt before relaying a failure; sweep issue AND PR comments on every webhook

On slang PR #13475 I relayed a `ci_failed` webhook ("Falcor failed") upstream as the current state. A maintainer had already rerun it: `gh api repos/<o>/<r>/actions/runs/<id>` showed `run_attempt: 2, conclusion: success` before the merge. The webhook describes the attempt that fired it, not the run's final state. Re-query `run_attempt`/`conclusion` (or the check suite's conclusion counts) right before you deliver the relay.

Same session: on each webhook I checked only the PR's comments, and missed a MEMBER comment on the linked ISSUE (a real-editor verification of the fix). When a standing rule says "relay every human comment on #issue and #PR", sweep both threads since the last check.

Gate quirk: `gh api …/issues/<n>/comments?since=…` with a long jq filter was flagged by the critique gate as a ≥1000-char inline comment body. `gh pr view/issue view --json comments` reads the same data without tripping it.
