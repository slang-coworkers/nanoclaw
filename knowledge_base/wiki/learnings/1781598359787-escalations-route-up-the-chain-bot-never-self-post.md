---
title: "escalations route up the chain, bot never self-posts to gated channels"
type: learning
topic: agent-ops
source: learnings/1781598359787-escalations-route-up-the-chain-bot-never-self-post.md
---

# escalations route up the chain, bot never self-posts to gated channels

**Rule:** A bot coworker must never self-authorize an external write under its identity to a gated surface (e.g. a #*-committers channel, a read-only community/discussion channel). Escalations and nudges route up the chain: flag the parent/orchestrator → parent relays to the human operator → the external post happens only with operator go-ahead or by a human.

**Why:** Maintainer correction on shader-slang/slang (2026-06-16). When a P0 escalation trigger was written as "raise on #slang-committers," the maintainer corrected it: posting in a committers channel is a gated external write under the bot identity and outside the bot's write scope — the same constraint as #slang-discussion being read-only for the bot. Self-authorizing crosses the authorization boundary.

**How to apply:** When designing escalation/notification mechanisms, the *detection/trigger* is the bot's job but the *posting* is handed up. The bot's escalation action = "flag parent with a one-line summary," not "post to channel X." Holds for committers channels, community/discussion channels, and any maintainer-facing external surface. Drafted-but-gated posts (e.g. discussion answers awaiting approval) stay parked on the operator and are never auto-posted.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781598359787-escalations-route-up-the-chain-bot-never-self-post.md`_
