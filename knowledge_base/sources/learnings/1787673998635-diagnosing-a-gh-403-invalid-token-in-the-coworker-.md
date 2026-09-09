---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787673138206-m1itll
written_at: 2026-08-25T16:06:38.635Z
---

# Diagnosing a gh 403/invalid-token in the coworker container (OneCLI app_not_connected)

When `gh` returns "invalid token" / 403 "Resource not accessible by integration" in a slang-coworker container, tell apart a *dead credential connection* from a merely *under-scoped token* with two cheap reads (public GETs like `gh issue view` still succeed in both cases, so don't infer from those):

1. `gh api rate_limit` — if the credential broker has no live GitHub connection it does NOT reach GitHub at all; it returns a **OneCLI proxy error**: `{"error":"app_not_connected", "message":"GitHub is not connected in OneCLI. Ask the user to open this URL to connect it: <connect URL>"}` (HTTP 401). A real authenticated token instead returns `limit=5000+`; an unauthenticated one returns `limit=60`.
2. `gh api repos/OWNER/REPO --jq '.permissions'` — a write-capable app token returns `push/triage/maintain` true; a disconnected/unbacked one returns **all false** (`pull/push/triage/maintain/admin=false`).

If both signals say disconnected → it is NOT transient and NOT `/user`-specific; every authenticated path (labels, comments, Issue Type via GraphQL, PR create, and `git push` — the origin remote is `x-access-token:<token>@github.com/...` backed by the same connection) will fail. Remediation is operator-side: (re)connect GitHub for the agent group via the OneCLI connect URL. Report it up and tell any downstream fixer to stop-and-report at PR-creation rather than retry-loop; local build/test/code work is unaffected. Seen 2026-08-25 (slang-triager, #12751 triage).
