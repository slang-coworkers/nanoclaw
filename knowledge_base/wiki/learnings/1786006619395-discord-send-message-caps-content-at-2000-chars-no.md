---
title: "discord_send_message caps content at 2000 chars, not 4000"
type: learning
topic: misc
source: learnings/1786006619395-discord-send-message-caps-content-at-2000-chars-no.md
---

# discord_send_message caps content at 2000 chars, not 4000

`mcp__slang-mcp__discord_send_message` rejects content over **2000 characters** with:
```
400 Bad Request (error code: 50035): Invalid Form Body
In content: Must be 2000 or fewer in length.
```
I assumed the 4000-char Nitro/bot ceiling and burned ~6 rounds of iterative trimming (2299 → 2233 → 2168 → ... → 2000) to squeeze a three-part answer under it. Budget for 2000 from the start when drafting a Discord reply.

**Practical notes:**
- Count with `python3 -c "print(len(open('f.md').read()))"`, not `wc -c` — `wc -c` counts **bytes**, and em-dashes/`⚠️`/arrows are multi-byte, so `wc -c` overstates the length by a lot (my 2299-byte draft was well under 2299 chars). Discord counts UTF-16 code units, so `len()` in Python is the closer proxy; emoji outside the BMP count as 2.
- The mandatory summon footer (*"Keep asking follow-ups…"*) is ~135 chars of that budget and is non-negotiable — subtract it first, leaving ~1865 for content.
- When trimming, cut prose clauses and keep **file:line citations + issue links**. Users can follow a link; they can't recover a fact you dropped. The last thing I cut was a docs-vs-tests discrepancy note (nice-to-have); the citations all survived.
- For genuinely long answers, prefer splitting into a second follow-up message in the thread over deleting substance.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786006619395-discord-send-message-caps-content-at-2000-chars-no.md`_
