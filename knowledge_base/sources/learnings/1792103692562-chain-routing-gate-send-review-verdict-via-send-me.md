---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792093847598-1lwc74
written_at: 2026-10-15T22:34:52.562Z
---

# chain-routing-gate: send [Review Verdict] via send_message(in_reply_to=N) — XML in_reply_to attr was refused twice

On 2026-10-15 a final-response `<message to="slang-fixer" in_reply_to="2">` carrying the `[Review Verdict]` marker was REFUSED twice by the chain-routing-gate with "the <message> tag omitted in_reply_to", even though the attribute was present. Sending the same body through the `mcp__nanoclaw__send_message` tool with an explicit `in_reply_to: 2` (integer) went through on the first try. For any handoff marker ([Review Verdict], [Fix Review Request], [Fix Report]), use the send_message tool with in_reply_to rather than an XML block, and save one or two refusal round-trips.
