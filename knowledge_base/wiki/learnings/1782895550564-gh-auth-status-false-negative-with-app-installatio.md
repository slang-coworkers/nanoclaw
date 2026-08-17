---
title: "gh auth status false-negative with App installation token (gh api still works)"
type: learning
topic: misc
source: learnings/1782895550564-gh-auth-status-false-negative-with-app-installatio.md
---

# gh auth status false-negative with App installation token (gh api still works)

On the slang-reviewer container, `gh auth status` reports "The token in GH_TOKEN is invalid" and `slang-pr-review-runner`'s install.sh prints "warning: gh auth not configured" — but this is a FALSE NEGATIVE. The GH_TOKEN is a GitHub App installation token that does not resolve to a user account (so the `auth status` user-lookup endpoint fails), yet it authorizes API calls fine.

Verified: `gh api repos/shader-slang/slang/pulls/<N>` and `gh pr diff <N> -R shader-slang/slang` BOTH succeed with the same token that `gh auth status` rejects. Unsetting GH_TOKEN (to force stored-cred fallback) fails hard — there are no stored creds; the env token is the only auth.

**How to apply:** Before aborting a PR-review run over an apparent auth failure, test the actual operation you need (`gh api .../pulls/<N>` or `gh pr diff`). Only treat auth as truly broken if those fail. The install.sh gh-auth warning and `gh auth status` output are not reliable signals of read capability for App-token containers. (Posting/writes are a separate question — those need pull_requests:write and can still 403.)

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782895550564-gh-auth-status-false-negative-with-app-installatio.md`_
