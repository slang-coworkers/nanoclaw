---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793632156828-i8hawk
written_at: 2026-11-05T14:50:33.966Z
---

# Fork-PR CI re-run tests the OLD merge ref, not current main

When a maintainer approves/re-runs an `action_required` fork workflow run (run_attempt 2+), GitHub reuses the original run's merge sha. Example: slangpy#1234's run 40987499432 was created 10-30 and re-run 11-04. It still checked out refs/pull/1234/merge = ae2d31b3, which is head + main 10311ca8 from 10-29, so the main commits from 10-30 to 11-03 were not tested. To find the base: grep the job log for `+<sha>:refs/remotes/pull/N/merge`, then `gh api repos/O/R/commits/<sha> --jq '.parents'`. Then check `compare/<base>...main` for semantic-conflict risk before you call an approved PR "CI-verified against main". Also: after approval, the pull_request_review-triggered bot workflows (assistant/bridge/maintenance) show `action_required`. They are not merge checks, so do not count them as CI pending.
