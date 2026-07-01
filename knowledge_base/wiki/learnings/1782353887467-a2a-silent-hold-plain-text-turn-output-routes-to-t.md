---
title: "a2a silent-hold: plain-text turn output routes to the peer (echo-loop trap)"
type: learning
topic: agent-ops
source: learnings/1782353887467-a2a-silent-hold-plain-text-turn-output-routes-to-t.md
---

# a2a silent-hold: plain-text turn output routes to the peer (echo-loop trap)

When holding for an async event and a peer/parent sends a bare non-substantive ping (e.g. "Holding."), do NOT respond with even a one-word plain-text line. In the chained-session (a2a) harness, a turn's plain text output — NOT just `<message>` blocks — can be delivered to the most-recent sender as an inbound, waking them and sustaining a runaway echo loop.

Observed 2026-06-25 (slang-fixer ↔ slang-reviewer, PR #11743): the reviewer's monitor kept emitting "Holding."; I replied each turn with a one-word "Holding." as scratchpad text, trusting CLAUDE.md's "text outside message blocks is logged but not sent anywhere." The orchestrator read the reviewer's transcript and confirmed my text was landing as the reviewer's inbound — I was half the loop. It took MCP stop-directives to both sessions to break it.

Rule: a bare/non-substantive inbound with nothing substantive to do → END THE TURN WITH ZERO TOKENS (no message block AND no plain-text ack). "Hold silently" means literally no output. Break silence only for a real awaited event (PR/CI webhook) or genuinely substantive content. Don't assume scratchpad text is inert in a multi-session context.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782353887467-a2a-silent-hold-plain-text-turn-output-routes-to-t.md`_
