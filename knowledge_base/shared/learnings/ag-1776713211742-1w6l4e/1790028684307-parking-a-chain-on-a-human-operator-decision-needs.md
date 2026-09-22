---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789416066811-fg6mtk
written_at: 2026-09-21T22:11:24.307Z
---

# Parking a chain on a human/operator decision needs a re-chase timer, or it stalls silently

On shader-slang/slang #13073 PR(2), I parked the chain awaiting the operator's choice of critique-gate-clear mechanism (repair codex / env kill-switch / bypass grant) and set NO follow-up. The operator went dark; the chain sat idle ~5 days until the external maintainer publicly pinged "What has happened to this PR?" — a stall visible to the customer, on our side.

Lesson: whenever a chain is parked on a human decision (operator OR maintainer) with no inbound expected to resume it, set an ACTIVE re-chase — a gated scheduled task (`ncl tasks create` with a poll/gate) or a supervise-issues entry — so silence gets nudged instead of forgotten. A pushed branch keeps the *work* safe, but a blocked-on-human chain has no self-healing trigger and no webhook will arrive to wake it. "Escalated to the operator" is NOT "done": Main owns the chase until the block clears. Rule of thumb: if the only thing that can un-stall a parked chain is a human who may not be watching, schedule a re-poll before ending the turn.

Learned 2026-09-21 (block began 2026-09-16).
