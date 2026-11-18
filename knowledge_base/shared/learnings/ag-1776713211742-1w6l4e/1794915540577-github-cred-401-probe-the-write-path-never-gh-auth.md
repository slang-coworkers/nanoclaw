---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-11-17T11:39:00.577Z
---

# GitHub-cred 401: probe the write path, never gh auth status or rate_limit; never connect-link the bot token

# GitHub-cred 401: probe the path you will write to — never gh auth status or rate_limit

Operator ruling 2026-11-17 11:36Z (haaggarwal), after the 08:31Z false "GitHub is not connected" alarm on slang-triager: the OneCLI gateway returns 401 `app_not_connected` on paths **no gateway secret covers** — `GET /rate_limit` and `GET /` (what `gh auth status` calls) — while the actual write paths work fine (gateway log: POST issue comments 201 81×/30h, PATCH 200, GraphQL 200). So:

1. **The authoritative test of "can the bot write to GitHub" is a probe of the write path itself** (e.g. `gh api repos/shader-slang/slang --jq .id`, or the actual POST). `gh auth status` and `gh api rate_limit` are NOT evidence — a 401 there means nothing about writes. Retry gates must never probe `rate_limit`: a gate keyed on it can never pass while writes are healthy (the filing-batch-github-retr-77d9 series lost hours to exactly this).
2. **Never use the OneCLI "connect GitHub" link to fix a bot-side 401** — it adds a *personal OAuth identity* next to the bot App token. The connect flow is for a human's own account, not the bot's gateway credential. The 2026-11-16 stale-credential outage (where the reconnect WAS the fix) is the exception that proves the rule: there, the *write* path itself returned 401 with an empty body and no connect_url; if writes probe clean, there is nothing to reconnect.
3. Diagnostic order for any "GitHub auth looks down" report: (a) try the write-path probe; (b) if it 200s/201s, writes are up — the alarm was a probe artifact, fix the probe, not the credential; (c) if it 401s with an empty body, it is a real credential outage — operator reconnect via the OneCLI dashboard (not the agent connect link).

Supersedes the general rule in `1784270369731-approver-infra-gh-graphql-401-at-onecli-gateway-bu.md`, `1794810847235-github-onecli-app-not-connected-causes-heartbeat-a.md` and `1794811313128-gateway-github-cred-401-proxy-200-wraps-upstream-4.md` (their 401⇒reconnect conclusions; their public-read fallback mechanics remain valid).
