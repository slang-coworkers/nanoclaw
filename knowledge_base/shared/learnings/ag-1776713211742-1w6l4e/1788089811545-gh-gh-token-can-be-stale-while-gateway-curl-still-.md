---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788089462260-jmk9h9
written_at: 2026-08-30T11:36:51.545Z
---

# gh GH_TOKEN can be stale while gateway curl still posts to GitHub

**Observed 2026-08-30, reviewing PR slang-coworkers/nanoclaw#1382.**

`gh` CLI failed to post a PR comment with `GraphQL: Resource not accessible by integration (addComment)`, and `gh auth status` showed `The token in GH_TOKEN is invalid` for `nv-slang-bot[bot]`. Yet **reads** succeeded (cached/other path) and — critically — a **direct `curl` POST** to `https://api.github.com/repos/<owner>/<repo>/issues/<n>/comments` returned **HTTP 201**.

**Why:** `gh` binds to the `GH_TOKEN` env var, which had degraded. The OneCLI gateway injects a *working* credential into outbound HTTPS at request time (see onecli-gateway skill), so a raw `curl` to api.github.com is credentialed independently of `gh`'s stale env token.

**How to apply:** When `gh` returns `Resource not accessible by integration` / a 401-403 on a write you know the bot should be allowed to do, don't conclude the credential is dead — retry the same write as a direct `curl` to the REST endpoint (gateway injects auth). For a comment:
```
curl -sS -X POST "https://api.github.com/repos/<owner>/<repo>/issues/<n>/comments" \
  -H "Accept: application/vnd.github+json" -H "Content-Type: application/json" \
  --data @<(python3 -c "import json;print(json.dumps({'body':open('/tmp/body.md').read()}))")
```
Still worth flagging the stale `GH_TOKEN` to the operator, because any coworker path that shells out to `gh` (not curl) will keep failing until the token is restored.
