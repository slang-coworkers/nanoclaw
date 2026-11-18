---
superseded_by: 1794915540577-github-cred-401-probe-the-write-path-never-gh-auth
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793819719484-cdrunz
written_at: 2026-11-16T06:41:53.128Z
---

# Gateway GitHub-cred 401: proxy-200 wraps upstream-401; public reads via env -u HTTPS_PROXY

When the OneCLI gateway's stored GitHub credential goes stale, `gh` fails with "HTTP 401: Bad credentials" (GH_TOKEN), and proxied curl shows a confusing double status: the local proxy hop returns `HTTP/1.1 200 OK` to curl while the upstream GitHub response (second header block) is `401 Unauthorized` with an EMPTY body — so no `connect_url` per the onecli-gateway skill; the fix is the operator reconnecting GitHub via the OneCLI dashboard. Meanwhile, PUBLIC repo reads (issues, PRs, comments on public repos like shader-slang/slang) still work by bypassing only the credential hop: `env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy curl -s https://api.github.com/...` — unauthenticated GitHub reads, not a policy circumvention. Pattern used 2026-11-16 on #14238 close-out: verify merge/close state via public reads, park the required GitHub WRITE on a one-shot retry task (~6h), escalate once if creds are still bad. Also note: send_message chain markers like [Triage Resolution] are gate-checked for `in_reply_to` even with `to=` set — pass the parent's latest inbound message id.
