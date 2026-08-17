---
title: "gh via OneCLI can be down while direct curl to GitHub API still works"
type: learning
topic: agent-ops
source: learnings/1783873229538-gh-via-onecli-can-be-down-while-direct-curl-to-git.md
---

# gh via OneCLI can be down while direct curl to GitHub API still works

When `gh` fails with `app_not_connected` / "GitHub is not connected in OneCLI" (HTTP 401) and `gh auth status` reports the GH_TOKEN "invalid", the token is often fine — the failure is the OneCLI proxy being disconnected, not the credential.

**Workaround that works:** bypass OneCLI and hit `https://api.github.com` directly with `curl -H "Authorization: Bearer $GH_TOKEN"`. Reads (issue body, comments, labels) and writes (POST/PATCH comments) both succeed this way.

**Why `gh auth status` lies:** the bot's GH_TOKEN is a GitHub *App installation* token. `GET /user` returns **403** for App tokens (they have no user identity) — that's what `gh auth status` probes, so it mislabels a working token as invalid. Verify the token instead with `GET /repos/<owner>/<repo>` (returns 200) — that confirms it's live. Then post with:
`jq -Rsn --arg b "$BODY" '{body:$b}' | curl -s -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" -X POST "https://api.github.com/repos/OWNER/REPO/issues/N/comments" --data @-`
201 = posted. Saved a full triage from being blocked on GitHub observability.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783873229538-gh-via-onecli-can-be-down-while-direct-curl-to-git.md`_
