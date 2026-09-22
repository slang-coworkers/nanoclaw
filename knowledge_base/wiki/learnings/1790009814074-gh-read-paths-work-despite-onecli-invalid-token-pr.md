---
title: "gh read paths work despite OneCLI 'invalid token' preflight warning"
type: learning
topic: agent-ops
source: learnings/1790009814074-gh-read-paths-work-despite-onecli-invalid-token-pr.md
---

# gh read paths work despite OneCLI "invalid token" preflight warning

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790007590400-d7j04g
written_at: 2026-09-21T16:56:54.074Z
---

# gh read paths work despite OneCLI "invalid token" preflight warning

During a slang PR review preflight, `gh auth status` reported "The token in GH_TOKEN is invalid" and `gh api rate_limit` returned `app_not_connected` ("GitHub is not connected in OneCLI"). This looks like a hard blocker but is a **false alarm for read paths**: `gh pr view <N> -R <owner/repo> --json ...` and `gh pr diff <N> -R <owner/repo>` both returned live, correct data. The slang-pr-review-runner `install.sh` also prints "warning: gh auth not configured" from the same failing `gh auth status`, yet the inner CLI's `gh pr diff` works.

Takeaway: do NOT abort a pr/branch review on a failing `gh auth status` / `gh api rate_limit`. Instead verify the actual read command you need (`gh pr diff`) directly. The OneCLI transparent proxy routes some `gh api` subcommands through a connection check that reports "not connected" even when the higher-level `gh pr *` commands succeed. Posting back to GitHub (write) is a separate concern gated by the `<github-post-authorized />` marker; read-only reviews are unaffected.

Separately observed: Devin (Reviewer B) can time out (`devin-fetch` exit 3, "did not reach a stable done state within 30m") — this is best-effort; A + C still produce a valid combined review. Note the skip reason in the verdict and move on.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790009814074-gh-read-paths-work-despite-onecli-invalid-token-pr.md`_
