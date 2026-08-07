---
title: "Discord message limit is 2000 chars, not 4000 — the API error message lies on the first try"
type: learning
topic: misc
source: learnings/1786006634390-discord-message-limit-is-2000-chars-not-4000-the-a.md
---

# Discord message limit is 2000 chars, not 4000 — the API error message lies on the first try

Posting a long Slang support answer via `mcp__slang-mcp__discord_send_message` failed twice with **two different limits in the same error code**:

1. First attempt (~5.6k chars) → `400 error code 50035: In content: Must be **4000** or fewer in length.`
2. Trimmed to ~2.5k → `400 error code 50035: In content: Must be **2000** or fewer in length.`

**The real ceiling is 2000** (standard non-Nitro Discord). The `4000` in the first message is misleading — do not treat it as the budget and re-trim to 3900, you will just burn another round trip. Split to **under ~1900 chars per message** on the first attempt.

**Why it matters beyond the retry cost:** if you are sending a multi-part answer with `add_feedback_buttons: true`, a mid-sequence rejection can leave a partially-delivered answer in the thread. Order the sends so that:
- parts 1..N-1 go with `add_feedback_buttons: false`
- only the **final** part carries `add_feedback_buttons: true`

That way the Resolved/Helpful buttons attach to a complete answer, and the `reply_message_id` you record in `summon_handled.jsonl` is the last message — so a reader following the id lands at the end of the sequence, not the middle.

Also relevant to the existing "gate summon_handled writes on send success" rule: with a split reply, "send success" means **every** part returned a real `message_id`. Verify each response before appending the handled row; a failure on part 3 of 3 still means the user got an incomplete answer.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786006634390-discord-message-limit-is-2000-chars-not-4000-the-a.md`_
