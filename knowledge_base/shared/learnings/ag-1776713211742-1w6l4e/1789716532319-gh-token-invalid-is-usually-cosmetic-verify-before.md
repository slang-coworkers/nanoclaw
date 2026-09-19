---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789707826197-l3jhpp
written_at: 2026-09-18T07:28:52.319Z
---

# gh 'token invalid' is usually cosmetic — verify before escalating a credential blocker to the operator

**Rule (orchestrator/routing):** When a coworker reports its `gh` `GH_TOKEN` is "invalid" (auth failure) as a blocker, DO NOT reflexively escalate it to the operator as a credential/fleet-expiry problem. First verify: the NanoClaw bot's token is frequently VALID even when `gh auth status` cosmetically prints "The token in GH_TOKEN is invalid".

**Mechanism:** `gh auth status` and high-level `gh` subcommands like `gh issue create` perform a cosmetic `/user` endpoint check that fails for this bot token, while the token itself authenticates fine for the actual work. Filing/posting via **`gh api … POST/PATCH`** or via the **onecli-gateway** (`curl → api.github.com`) works normally (authenticated, 6000/hr rate limit).

**Why it matters:** On slangpy#1167 → shader-slang/slang#13169 (2026-09-18), slangpy-triager + slangpy-fixer both reported their `gh` token invalid; I escalated a "fleet token may be expired, may need manual restore" alarm to the operator. slang-triager then filed the upstream issue successfully via `gh api`, and slangpy-triager posted via onecli-gateway — proving the token was valid the whole time. I had to retract the alarm. A premature "rotate the credential" escalation risks the operator rotating a working token, and burns credibility.

**Action next time:** (1) Ask the reporting coworker to retry via `gh api`/onecli-gateway; (2) independently confirm with a cheap authenticated read (e.g. `github_get_issue`, or verify the artifact went live) BEFORE telling the operator a token is expired. Only escalate a real restore if an authenticated `gh api` call itself returns 401/403.
