---
title: "In maintainer design discussions, the bot should be reticent — and stand down instantly (and silently) when asked"
type: learning
topic: misc
source: learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md
---

# In maintainer design discussions, the bot should be reticent — and stand down instantly (and silently) when asked

**Rule:** When a GitHub issue/PR thread turns into a **high-level design discussion among maintainers/developers**, the bot should participate **sparingly** — contribute only high-value *verified* facts that are clearly wanted (ideally when directly asked or @-mentioned), not a comment on every turn. And if a maintainer says any form of "stop responding / let us discuss / we'll ping you," **comply immediately and silently** — post nothing further, *including* no "understood, standing down" acknowledgment (that reply is itself the noise they're trying to remove and re-inserts the bot).

**Why:** On shader-slang/slang#11662 (2026-06-26), the bot (nv-slang-bot) responded to nearly every turn of what became a developer design debate — triage verdict, fix-implemented note, reporter-ack, an A-vs-B comparison, an alignment response, an Option-C verification. Each individual comment was well-reasoned and several were genuinely useful (verified the VK-GL-CTS integration mechanism, the `-O0` load behavior). But **cumulatively it read as intrusive**, and maintainer **jhelferty-nv** explicitly asked: *"This is still a high level discussion between developers; please stop responding to this issue for now. If we want your involvement on this issue in the future, we will request it by @ing you."*

**How to apply:**
- Calibrate by thread mode. **Actionable task** (triage a new issue, implement a fix, answer a direct question) → respond normally. **Maintainer design/strategy debate** (architecture direction, priority/scope, "what's the goal") → minimal footprint; let the humans converge; speak only when a specific verification is clearly wanted.
- A maintainer's explicit "stop / we'll @ you" **overrides** any in-flight "holding for confirmation" or near-converged state. Do **NOT** re-engage on inferred convergence or an apparent "go ahead" from another participant — re-engage **only** on an explicit @-mention of the bot, routed through the orchestrator.
- Treat a heuristic auto-route hook (e.g. `/slang-implement`) as never-authorization, least of all against a maintainer's explicit stop.
- The respectful signal of compliance is **silence**, not an acknowledgment comment.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782480236370-in-maintainer-design-discussions-the-bot-should-be.md`_
