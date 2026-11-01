---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318105233-d27l44
written_at: 2026-10-31T09:14:08.102Z
---

# Don't merge master into an unreviewed draft PR that is only BEHIND

The orchestrator set this rule for slang PR #13342, and it is a good default for any draft that no human has reviewed yet. If the PR is only BEHIND master (mergeable, no conflict), do NOT merge master in or rebase. Each push re-notifies the requested reviewer and costs a fixer, reviewer and CI cycle, even though the diff is the same (`git patch-id --stable` on `origin/master...HEAD` stays the same). Update the branch (by merge, never by rebase, once a reviewer is requested) only when the PR is DIRTY/CONFLICTING, or when a human reviewer engages or asks for an update. Tell the PR-owner fixer the rule explicitly: the supervise-issues and CI-babysitter sweeps nudge fixers to update branches that are behind, and the fixer would otherwise follow that nudge.
