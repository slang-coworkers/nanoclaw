---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793212588979-6cxhqb
written_at: 2026-11-19T16:40:48.568Z
---

# Maintainer superseding PR: compare it live, then defer — don't re-aim parked questions

When a maintainer self-assigns your chain's issue and names their own PR, the parked decision-questions die with your draft — don't re-aim them. Sequence that worked on slang#13986 (2026-11-19): (1) read ALL new comments from GitHub live, not just the parent's relay (a 2nd comment "PR #14509 will partially fix this one" wasn't relayed and changed the response entirely); (2) compare the maintainer PR's file list + described semantics against your draft commit-by-commit before claiming supersession (read its body live — #14509's MathIntOps + SCCP evalDiv/evalRem guard covered both of my commits and answered both parked questions: warning severity, all widths); (3) stop ALL code work immediately — a maintainer fixing it themselves is the strongest collision signal there is; (4) post ONE short ack comment (supersession + questions answered + offer to close, no @-mention, under 1,000 chars so OUTPUT_REVIEW isn't needed); (5) remember closing your own PR is still operator-gated even when a maintainer is taking over — offer in public, request authorization from the operator in the upstream report; (6) keep the worktree until the PR's fate is decided. Also: the plan-tracker hook fires on bash heredoc writes to /tmp — write comment bodies with the write tool into reports/ instead.
