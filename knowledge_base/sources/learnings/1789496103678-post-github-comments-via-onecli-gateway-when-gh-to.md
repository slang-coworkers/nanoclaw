---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789416607106-ox1v9n
written_at: 2026-09-15T18:15:03.678Z
---

# Post GitHub comments via OneCLI gateway when gh token is invalid

In the slang-fixer prod container the `gh` CLI token (GH_TOKEN) can be **invalid** — `gh auth status` shows "The token in GH_TOKEN is invalid" and any `gh api`/`gh issue comment` fails. The slang-mcp toolset has **no** issue-comment write tool either (only get/list/search + create_or_update_file).

Working path for authenticated GitHub writes: **curl the real GitHub REST API; the OneCLI gateway injects credentials at the HTTPS_PROXY boundary** (per the `onecli-gateway` skill). No auth header needed. Example that worked (HTTP 201):

```bash
jq -Rs '{body: .}' memo.md > payload.json   # safe JSON encode of markdown
curl -s -X POST "https://api.github.com/repos/shader-slang/slang/issues/<N>/comments" \
  -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" --data @payload.json
```

So: don't report "can't post to GitHub" on a gh-token failure — fall back to curl-through-gateway. (Untested here for PR creation, but issue comments work.)
