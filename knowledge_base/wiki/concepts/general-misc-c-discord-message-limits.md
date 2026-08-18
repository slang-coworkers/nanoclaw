---
title: Discord message limits — the real cap is 2000 chars, and the first error message lies
type: concept
group: general
tags: [discord, mcp, message-limit, formatting]
source_count: 2
---

## TL;DR

`mcp__slang-mcp__discord_send_message` rejects content over **2000 characters** (standard non-Nitro Discord) with `400 error code 50035: Invalid Form Body`. Budget for 2000 from the start; do not trust the ceiling the first error reports.

- The real ceiling is **2000**, not 4000. A first over-length attempt can report `Must be 4000 or fewer` — misleading; re-trimming to ~3900 just burns another round trip. Split to **under ~1900 chars per message** on the first attempt.
- Count with `python3 -c "print(len(open('f.md').read()))"`, **not `wc -c`** — `wc -c` counts bytes, and em-dashes / `⚠️` / arrows are multi-byte, so it overstates length. Discord counts UTF-16 code units, so Python `len()` is the closer proxy (emoji outside the BMP count as 2).
- The mandatory summon footer (~135 chars) is non-negotiable — subtract it first, leaving ~1865 for content.
- When trimming, cut prose clauses and keep **file:line citations + issue links** — users can follow a link, not recover a dropped fact.
- For long answers, prefer splitting into a follow-up message in the thread over deleting substance.

## Details

The `4000` in a first-attempt error is not the budget — one investigator burned ~6 rounds of iterative trimming (2299 → 2233 → … → 2000) assuming the Nitro/bot ceiling. Two attempts can even return *two different limits under the same error code 50035* (4000 then 2000). Treat 2000 as the hard cap and split accordingly. See [discord_send_message caps content at 2000 chars, not 4000](../learnings/1786006619395-discord-send-message-caps-content-at-2000-chars-no.md) and [Discord message limit is 2000 chars, not 4000 — the API error message lies on the first try](../learnings/1786006634390-discord-message-limit-is-2000-chars-not-4000-the-a.md).

**Multi-part answers with feedback buttons:** a mid-sequence rejection can leave a partially-delivered answer in the thread, so order the sends with `add_feedback_buttons: false` on parts 1..N-1 and `true` only on the **final** part — the Resolved/Helpful buttons then attach to a complete answer, and the recorded `reply_message_id` lands the reader at the end of the sequence. "Send success" for a split reply means *every* part returned a real `message_id`; verify each response before appending a handled row (a failure on part 3 of 3 still means the user got an incomplete answer).
