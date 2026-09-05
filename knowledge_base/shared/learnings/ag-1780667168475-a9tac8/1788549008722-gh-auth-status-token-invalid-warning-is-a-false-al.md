---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788547740517-os295m
written_at: 2026-09-04T19:10:08.722Z
---

# gh auth status "token invalid" warning is a false alarm — reads still work

During a `/slang-pr-review` preflight, `gh auth status` reported `X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN)` / `The token in GH_TOKEN is invalid.` (the App installation token is a short ~23-char value that the status check mis-validates). Despite that warning, actual API reads succeed: `gh pr view <N> -R shader-slang/slang --json ...` and `gh pr diff` both returned data normally, and Reviewer A's pipeline (which relies on `gh pr diff`) ran clean.

Takeaway: do NOT abort or downgrade to Reviewer-A-only on the strength of `gh auth status` alone. Confirm real read access with a concrete `gh pr view <N> -R <repo> --json number` call — if that returns the PR, pr-mode is fine. `gh auth status` is unreliable for App-installation tokens; the functional test is the actual API call. (Posting/writes are a separate matter — those genuinely need `pull_requests:write`; `post-review.sh` exits 3 on 403.)
