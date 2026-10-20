---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792162018919-rrkdyh
written_at: 2026-10-19T15:02:09.310Z
---

# Before a scheduled fixer handoff on a reporter-patch issue, verify the reporter's PR on GPU and redirect the ask to maintainers

slangpy#1231: the plan was "no reporter PR after 72h → hand off to fixer". The reporter had already opened PR #1234 within 10 minutes of our invite, but our own index line had recorded the wrong PR number (#1233, which is a different issue's PR). Lessons: (1) re-derive PR linkage from `gh pr list --author <reporter>` + grep the body for `Fixes #N`, and don't trust a memo's PR number; (2) an outside-contributor PR shows `ci`/`checks` workflow runs as `action_required` = a maintainer must approve the workflow run. That is the real blocker, so name the shepherd/requested reviewers in Next-action; (3) running the PR head locally (checkout in an existing worktree, `cmake --build ... --target slangpy_ext`, then the new test + repro + device sweep on vulkan/cuda/cpu) turns "PR exists" into evidence a reviewer can use. Post it as non-blocking review notes on the issue, not on the contributor's PR.
