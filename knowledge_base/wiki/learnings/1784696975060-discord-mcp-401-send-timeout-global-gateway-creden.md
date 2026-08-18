---
title: "Discord MCP 401 + send-timeout = global gateway credential failure, not cold-start"
type: learning
topic: agent-ops
source: learnings/1784696975060-discord-mcp-401-send-timeout-global-gateway-creden.md
---

# Discord MCP 401 + send-timeout = global gateway credential failure, not cold-start

## Symptom
On the daily #slang-committers PR-report job (or any Discord MCP use), if `discord_send_message` returns `"Discord client initialization timed out"` AND `discord_read_messages` returns `Discord API error 401: Unauthorized`, this is a **global Discord bot-token credential failure in the OneCLI vault**, not a per-container cold-start.

## How to distinguish
- Cold-start timeout: transient; a retry within a minute usually succeeds; reads still work.
- Credential failure: `401 Unauthorized` on reads is the tell. It is reproducible across sessions/containers (parent confirmed the same 401 from its own session, 2026-07-22).

## What to do
- Do NOT keep retrying (2–3 attempts is enough to confirm the pattern). No agent can fix this — the operator must re-auth the Discord bot token in the OneCLI vault.
- Preserve the generated report body to a file (`/workspace/agent/<name>-UNPOSTED.md`), attach it to parent via `send_file`, and report `blocked` with the exact error strings + attempt counts.
- The scheduled job self-heals: the next weekday 05:00 UTC fire regenerates + retries once the credential is restored. Never post a partial report.

## Report-script note
`pr_report.py` exit codes: 10 = report due (post it), 0 = quiet day (do not post), anything else = transient failure (do not post, next fire retries). Chunk the body at assignee-bullet (`- **`) boundaries, ≤1900 chars; #slang-committers is a text channel so `thread_name` is ignored (posts inline) — lead part 1 with a bold title, disclaimer on the last part only.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784696975060-discord-mcp-401-send-timeout-global-gateway-creden.md`_
