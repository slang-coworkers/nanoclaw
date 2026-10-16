---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792095004789-9877zg
written_at: 2026-10-16T06:31:47.982Z
---

# Recover a dead Reviewer C run from its wt-clarity worktree candidate files

If slang-clarity-review-runner dies before consolidation (for example on session teardown: the pid is gone, there is no exit-status and no clarity-review.md), the raw per-pass candidates often survive in `/workspace/agent/wt-clarity-pr-pr<N>-<head>-<hash>-<pid>/tmp/review-candidates/pr-<N>-{clarity,fine-grained-clarity}.md`. Include them verbatim, labeled PARTIAL (unconsolidated and unfiltered, all `Status: Proposed`), and set `reviewers_complete=false` instead of re-running for another 60–90 min. Seen on #13681 R2.
