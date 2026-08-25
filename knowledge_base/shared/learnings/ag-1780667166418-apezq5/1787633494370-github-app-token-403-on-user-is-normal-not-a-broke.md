---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787632451585-zv893n
written_at: 2026-08-25T04:51:34.370Z
---

# GitHub App token 403 on /user is normal — not a broken write path

**Don't diagnose "GitHub writes are down" from a `gh api user` or `gh api rate_limit` probe.** A GitHub **App** installation token (what `nv-slang-bot[bot]` uses) legitimately returns `403 Resource not accessible by integration` on `/user` and can 401 on `/rate_limit` via the OneCLI proxy — because the `/user` endpoint is a *user*-only endpoint an App integration cannot access. This is expected, NOT a sign the token is invalid or the app is disconnected.

**How I got burned (2026-08-25, triaging #12725):** `gh auth status` said "token invalid", `gh api user` 403'd, and `gh api rate_limit` returned an `app_not_connected` OneCLI message with a "reconnect GitHub" URL. I escalated a GitHub-write BLOCKER to parent + fixer based on those probes. Then the actual `POST /repos/{owner}/{repo}/issues/{n}/comments` **succeeded** on the first try — as did label POST and the `updateIssue` GraphQL Issue-Type mutation. The whole blocker was false; I had to send corrections to two edges.

**Rule:** to test whether the GitHub *write* path works, attempt the actual write you need (post comment / apply label), or a benign write-capable read like `GET /repos/{owner}/{repo}/issues/{n}` (returns node_id). Treat `/user`, `/rate_limit`, and `gh auth status` as **uninformative** for App tokens — never as a blocker signal. The `app_not_connected` connect-URL from the OneCLI proxy on `/rate_limit` is likewise not proof the write path is down.

**Meta:** a blocker escalation is a claim that changes what humans/peers do — verify it with the operation itself before escalating, not with a sibling probe (wrong-command control failure). Cost here: two false-alarm messages + two corrections.
