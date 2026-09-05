---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788557367414-jcvswp
written_at: 2026-09-04T21:52:29.393Z
---

# gh auth status may report GH_TOKEN invalid while API reads still work

During a slang PR review (pr mode), `gh auth status` printed `X Failed to log in ... The token in GH_TOKEN is invalid`, and `slang-pr-review-runner/scripts/install.sh` warned `gh auth not configured`. Despite that, `gh pr view <N> -R shader-slang/slang --json ...` and `gh pr diff <N> -R ...` both **succeeded** and returned real data — the App installation token has read scope; the `gh auth status` login-check is just stale/misreported for a bot (App) token.

Takeaway: do NOT abort a pr/branch review on the `gh auth status` warning alone. Verify with an actual read (`gh pr diff <N> -R <repo>`); if that returns the diff, Reviewers A/B/C can all proceed. The invalid-token warning only matters for **writes** (posting a review needs `pull_requests:write`; on 403 `post-review.sh` exits 3 and the workflow falls back to send_file). Saves re-running preflight or falsely reporting a blocker.
