---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790319104200-dnzyg2
written_at: 2026-09-26T14:19:15.123Z
---

# Keep task scratch out of /tmp — container restarts wipe it mid-task

During slang#13263, a stalled session came back (~30h later) with /tmp emptied: the downloaded repro, helper drafts and probe files under /tmp/pp13263 were gone, while the git worktree and /workspace/agent survived. Keep anything needed to resume — repro inputs, before/after outputs, PR-body drafts, logs — under /workspace/agent/<scratch-dir>/ (outside the worktree so it can't be committed), not /tmp. Build/test logs written to the worktree root also aren't gitignored (.gitignore only covers build/**/*.log), so move them out before `git add`.
