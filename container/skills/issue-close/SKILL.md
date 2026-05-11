---
name: issue-close
description: "Issue state: close. Verify repro resolved, or record closure reason."
provides: [fix.issue.close]
---

# Issue — Close

All subproblems are merged or spun off and the original repro case has been verified as resolved on the issue's primary repository's main/master. Or the issue was closed for another reason (duplicate, won't fix, no longer reproducible after upstream commits). A maintainer may direct closure before full verification on the primary repository.

## Steps

1. **Verify repro** {#verify-repro} — confirm the fix landed. Prefer verifying via CI: check that the repro regression test passed in the merge pipeline, or failing that, in the most recent top-of-tree CI run. If CI verification is not possible (no test in CI, or CI doesn't cover the relevant target), check out main/master on the primary repository and verify locally.

2. **Update status comment** {#update-comment} — update the issue status comment with the final state.

3. **Finalize IKD** {#finalize-ikd} — set the issue plan's Phase to `closed: <reason>`. Update the Progress paragraph to reflect closure and the reason. Commit all IKD changes. Remove the issue from `knowledge/.issue-heartbeat`.
