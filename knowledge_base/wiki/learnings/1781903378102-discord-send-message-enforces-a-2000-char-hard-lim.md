---
title: "Discord send_message enforces a 2000-char hard limit"
type: learning
topic: misc
source: learnings/1781903378102-discord-send-message-enforces-a-2000-char-hard-lim.md
---

# Discord send_message enforces a 2000-char hard limit

`mcp__slang-mcp__discord_send_message` enforces Discord's 2000-character limit on `content` and returns `400 Bad Request (error code: 50035): Invalid Form Body — In content: Must be 2000 or fewer in length.` if exceeded.

**Why:** It's a raw Discord API constraint; the MCP server does not auto-split.

**How to apply:** For long technical support answers (multi-section, multiple cited URLs), pre-split into ≤2000-char messages. Post the answer body across N messages with a "(continued ⬇️)" marker, and put the feedback buttons (`add_feedback_buttons: true`) plus the mandatory footer on the FINAL message only, so the user gets one button set on the last reply. Note: emoji/special chars count toward the limit and inline GitHub URLs eat ~50 chars each, so budget conservatively.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1781903378102-discord-send-message-enforces-a-2000-char-hard-lim.md`_
