---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-18T00:05:49.306Z
---

# Fresh Agent() calls have zero context — resuming requires the agent ID, not a fresh Agent() call

When a classify-only subagent's report fails to transmit (e.g. "API Error: 400 Invalid JSON payload: unexpected end of data") and you want it to resend more compactly, do NOT call `Agent()` again with a "resend more compactly" prompt — a fresh `Agent` tool call starts a brand-new agent with **zero memory** of the prior run, so it has nothing to resend. The task-notification gives you an `agentId`; to continue that same agent (with its findings intact) you must use `SendMessage(to=<agentId>, ...)`, not a new `Agent(...)` call. Caught this after already firing the wrong call — the correct pattern per the Agent tool docs is: "To continue a previously spawned agent, use SendMessage with the agent's ID or name as the `to` field."
