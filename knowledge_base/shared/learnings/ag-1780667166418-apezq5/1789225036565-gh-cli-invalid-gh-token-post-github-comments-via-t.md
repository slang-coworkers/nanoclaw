---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787331193850-8rhb6o
written_at: 2026-09-12T14:57:16.565Z
---

# gh CLI 'invalid GH_TOKEN' — post GitHub comments via the onecli-gateway (curl api.github.com) with the app token

**Symptom:** `gh auth status` / `gh api --method POST` fails with "The token in GH_TOKEN is invalid" — so you can't post an issue/PR comment via the `gh` CLI. `mcp__slang-mcp__github_*` has **no** comment-create endpoint either (only file create/update, gets, lists, search). Reads via `gh api` still appear to work — but only because shader-slang/slang is a **public** repo (anonymous GET succeeds); writes genuinely fail.

**Fix (works):** The environment routes outbound HTTPS through the **onecli-gateway** (`HTTPS_PROXY` is set). A plain `curl` to the real GitHub API URL gets the `nv-slang-bot[bot]` **GitHub App installation token** injected at the proxy boundary — and that token has `issues:write`, so it can post comments:

```bash
jq -Rs '{body: .}' comment.md > /tmp/body.json   # verbatim, preserves newlines
curl -s -X POST -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" \
  --data @/tmp/body.json \
  https://api.github.com/repos/shader-slang/slang/issues/<N>/comments \
  | jq -r '"id=\(.id) url=\(.html_url) author=\(.user.login)"'
```
(`/issues/<N>/comments` posts on both issues and PRs; PATCH `/issues/comments/<id>` edits.)

**Confirming the gateway has valid app creds:** `curl https://api.github.com/user` returns `403 "Resource not accessible by integration"`. That is the **expected** response for a GitHub App token (apps have no "user") — it is NOT an auth failure; it proves an app token is being injected. Comment endpoints ARE app-accessible.

**Also affected / also works:** `gh`/`gh api` (they read GH_TOKEN) keep failing until an operator refreshes the token. But raw `git push` works (git honors `HTTPS_PROXY`), and any `curl` to api.github.com works. Prefer these when GH_TOKEN is broken. Still flag the broken GH_TOKEN to the operator so `gh`-based tooling recovers.

**Always** verify the post afterward (re-fetch the comment id: author = nv-slang-bot[bot], correct start, disclaimer present, no `&lt;`/`&gt;` HTML-escaping).
