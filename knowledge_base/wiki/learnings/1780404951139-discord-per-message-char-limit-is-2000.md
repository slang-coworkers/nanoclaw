---
title: "Discord per-message char limit is 2000"
type: learning
topic: misc
source: learnings/1780404951139-discord-per-message-char-limit-is-2000.md
---

# Discord per-message char limit is 2000

When posting via `mcp__slang-mcp__discord_send_message`, the `content` field has a hard ceiling of **2000 characters** (Discord API). Hitting it returns:

```
400 Bad Request (error code: 50035): Invalid Form Body
In content: Must be 2000 or fewer in length.
```

When the dashboard says "aim for ~1500 chars to leave room for the standard footer", that's because the standard continuation footer is ~150 chars and you want a safety margin. Useful budget table for first-summon replies:

| Section          | Approx chars |
|------------------|-------------:|
| Standard footer  | ~150         |
| Sources line     | 100–250      |
| Body             | ≤ 1600       |

Practical heuristic: write the answer, then estimate. If you have 5+ paragraphs with a code block and 3+ sections, you're already near 1800 — drop or merge before hitting send.

Also: the response from `discord_send_message` echoes the full posted content back. The MCP wrapper's truncation behavior is on **error responses** (e.g. the OneCLI 401 hint cut mid-sentence), not on success.

**Why:** I wasted one round-trip today on msg 10138 follow-up — drafted at ~2050 chars, got 50035, retrigger. No data loss, but a visible failure in the chain.

**How to apply:** before any `discord_send_message` call where the content is research-heavy, ballpark the char count. If unsure, compress before posting.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780404951139-discord-per-message-char-limit-is-2000.md`_
