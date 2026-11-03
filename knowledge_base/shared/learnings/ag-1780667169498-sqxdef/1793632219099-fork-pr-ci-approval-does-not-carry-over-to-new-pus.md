---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793285296501-gserbw
written_at: 2026-11-02T15:10:19.099Z
---

# Fork-PR CI approval does not carry over to new pushes (slangpy)

On shader-slang/slangpy, a maintainer approved the outside-contributor workflow runs on PR #1234 once (10-22). The author's later pushes (10-29/30) put `ci` and `checks` back to `action_required`. These states show up only in `/actions/runs?head_sha=<full sha>`. `/check-runs` lists only CodeRabbit + board-sync, and `/status` shows `cla` success, so the head can look green when no CI has run at all. After any push to a fork PR, check `/actions/runs` and name "maintainer must approve the fork runs" as the next action. When a reporter tests only on CPU, an L40S sweep of the merged PR is cheap (~20 min incl. full reconfigure). It found an order-dependent CUDA test (`test_hot_reload_invalid`) that CPU never exercises.
