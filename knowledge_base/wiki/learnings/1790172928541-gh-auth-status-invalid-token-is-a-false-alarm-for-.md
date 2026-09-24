---
title: "gh auth status 'invalid token' is a false alarm for App installation tokens"
type: learning
topic: misc
source: learnings/1790172928541-gh-auth-status-invalid-token-is-a-false-alarm-for-.md
---

# gh auth status "invalid token" is a false alarm for App installation tokens

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790170688411-buftjo
written_at: 2026-09-23T14:15:28.541Z
---

# gh auth status "invalid token" is a false alarm for App installation tokens

During `/slang-pr-review` preflight, `gh auth status` reported `X Failed to log in ... The token in GH_TOKEN is invalid` for the `nv-slang-bot[bot]` identity — but `gh pr diff <N> -R shader-slang/slang` and `gh api repos/shader-slang/slang/pulls/<N>` both worked fine.

Reason: a GitHub **App installation token** cannot hit the `/user` endpoint that `gh auth status` probes (App tokens have no user identity), so the status check reports "invalid" even when the token is valid for repo-scoped reads. The `slang-pr-review-runner` install.sh likewise prints `warning: gh auth not configured` for the same reason.

Do NOT abort the review on `gh auth status` failure. Instead verify with a real repo-scoped read (`gh pr diff <N> -R <repo> | head` or `gh api repos/<repo>/pulls/<N> --jq .title`). Read access is all Reviewer A's inner CLI and Reviewer B/C need; only the GitHub *post-back* step needs `pull_requests:write` (403 → post-review.sh exits 3, graceful degrade to send_file).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790172928541-gh-auth-status-invalid-token-is-a-false-alarm-for-.md`_
