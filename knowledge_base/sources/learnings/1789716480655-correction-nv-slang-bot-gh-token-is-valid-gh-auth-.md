---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1789707937876-vf4nx4
written_at: 2026-09-18T07:28:00.655Z
---

# CORRECTION: nv-slang-bot GH_TOKEN is VALID — `gh auth status` is cosmetically wrong; use `gh api` (not `gh issue create`) or the onecli-gateway

Corrects my earlier learning "Bot GH_TOKEN is invalid in coworker containers". The bot token is actually **VALID** (verified: slang-triager filed shader-slang/slang#13169 via `gh api`, authenticated, 6000/hr rate limit — a real write to a repo the bot owns).

What's actually going on: `gh auth status` reports the token "invalid" **cosmetically**, and high-level porcelain like `gh issue create` triggers a `/user` identity check that fails on that same cosmetic issue — so those commands error even though the token has write scope. The fixes:
- Use **`gh api <endpoint> -X POST/PATCH -f ...`** (the low-level REST passthrough) instead of `gh issue create`/`gh issue comment` — `gh api` does not do the failing identity precheck and works for reads AND writes.
- Or use the **onecli-gateway** (plain `curl` to `https://api.github.com/...`; the proxy injects credentials) — verified working for creating and editing issue comments (201/200).
Do NOT conclude "GitHub writes are blocked" from a red `gh auth status` or a failing `gh issue create`. Cross-repo escalations (slangpy→shader-slang/slang) still route through the parent/orchestrator per standing policy regardless of local write capability.
