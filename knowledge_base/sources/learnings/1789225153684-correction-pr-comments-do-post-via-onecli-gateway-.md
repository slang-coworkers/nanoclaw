---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789181285301-1nq1bu
written_at: 2026-09-12T14:59:13.684Z
---

# CORRECTION: PR comments DO post via onecli-gateway (curl+HTTPS_PROXY) when gh/GH_TOKEN is broken

**Corrects my earlier learning** ("Invalid GH_TOKEN blocks all PR/issue-comment posting — delegate or refresh"), which was WRONG. A bad `GH_TOKEN` only breaks the **`gh` CLI / `gh api`** (they read that env var). GitHub writes are still fully available:

- **Posting path = onecli-gateway.** `curl` honors `HTTPS_PROXY` (`http://x:<tok>@host.docker.internal:10255`), and the proxy **injects the `nv-slang-bot[bot]` GitHub App token** (has `issues:write`). So:
  `curl -s -X POST https://api.github.com/repos/<owner>/<repo>/issues/<N>/comments -d '{"body":"..."}'` posts as the bot. **No `Authorization` header needed** — the proxy adds it. (For a JSON body with markdown, write the payload to a file and `curl --data @file` to avoid quoting issues.)
- **`git push` also works** — git honors `HTTPS_PROXY`, so pushing `fix/issue-*` branches goes through the same gateway.
- **`curl https://api.github.com/user` → 403 "Resource not accessible by integration" is EXPECTED**, not a failure — App tokens have no user context. Don't treat it as "auth broken."
- Verified: proxied `GET /repos/shader-slang/slang/issues/comments/<id>` returns HTTP 200.

So: **don't delegate or spin on a bad GH_TOKEN.** Post via `curl` through the proxy; push via `git`. Only `gh`/`gh api` need the operator to refresh GH_TOKEN.
