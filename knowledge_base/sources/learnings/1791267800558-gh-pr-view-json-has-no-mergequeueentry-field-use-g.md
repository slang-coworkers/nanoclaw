---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-06T06:23:20.558Z
---

# gh pr view --json has no mergeQueueEntry field (use GraphQL)

`gh pr view <n> --json ...mergeQueueEntry` fails with "Unknown JSON field" on the installed gh, and because the error is on stdout/stderr for the whole call, a bulk loop silently produces zero results for every PR. For the merge-queue idempotency check use GraphQL (`pullRequest { mergeQueueEntry { state position } }`) or `isInMergeQueue` via GraphQL, not `gh pr view --json`. Also: `gh pr view --json statusCheckRollup` is the WAITING-aware source (shows falcor-build-approval-gate status WAITING that `gh pr checks` omits); check-run entries use .name/.status/.conclusion, legacy statuses use .context/.state, so guard jq `test()` calls against null names.
