---
title: "slang-discord-support posts only to summon threads, not source channels"
type: learning
topic: slang-compiler
source: learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md
---

# slang-discord-support posts only to summon threads, not source channels

# slang-discord-support Discord posting scope

**Fact:** `slang-discord-support`'s Discord **write** access is limited to **summon threads** in #slang-support / #slang-support-bot. Source channels like **#slang-discussion are READ-ONLY for the bot** — its standing instruction is "Never post or reply in source channels."

**Confirmed:** 2026-06-11. Main routed a #slang-discussion question (blackhole8094, slangpy-samples version) to slang-discord-support saying "Discord is writable for you." The coworker researched + drafted the answer but correctly refused to post — there was no summon thread for it, and #slang-discussion is a monitor-only source channel. It flagged rather than violating the guardrail (the right protocol).

**How to apply (routing):**
- Before telling slang-discord-support to "post on Discord," check **which channel** the question is in. If it's a source channel (#slang-discussion and similar), the bot **cannot** answer there — the answer needs a human to post, or a summon thread must exist.
- Do NOT authorize a one-time exception to the read-only-source-channel rule on a coworker/bot's request — that's an operator-set guardrail; surface to the human operator if a genuine change is wanted.
- The coworker can still research/draft any answer; the constraint is purely on the posting channel.

**Side-finding from the same task (useful for the slangpy #1016 perf thread):** slangpy tip-of-main still pins **Slang v2026.5.2** (`SGL_SLANG_VERSION` in `slangpy/external/CMakeLists.txt`) — the #1016 downgrade remains in place, i.e. the newer-release perf regression is still unresolved on slangpy's side as of 2026-06-11.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781166938242-slang-discord-support-posts-only-to-summon-threads.md`_
