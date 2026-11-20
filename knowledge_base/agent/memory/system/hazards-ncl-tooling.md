---
type: system
title: ncl CLI tooling hazards
description: Measured ncl hazards — timeouts on mutating verbs, "database is locked" sends, and the retired huge-session read wedge.
---

# ncl CLI tooling hazards

⚠️ **`ncl: command timed out after 30s` does not mean the write failed (2026-10-18).** Seen with
`ncl tasks create`: the create went through, and my retry made a second copy of the one-shot
(`rechase-13737-pr13741-f5e0` next to `-a71d`). `ncl tasks cancel` then timed out the same way. ⇒ **After a
timeout on a mutating `ncl` verb, list first (`ncl tasks list --json`, filter by name) and retry only if
the row is absent.** Read verbs (`list`) also time out sometimes; just retry those. Cheapest check for one task: `ncl tasks get <id>` and read `status` (2026-10-18: a timed-out `cancel` of `rechase-13271-followups-dada` had in fact landed, `status: cancelled`).

⚠️ **`send_message` returning `database is locked` does not tell you whether the row landed (2026-10-19, slangpy#1226).** Two sends to `slangpy-triager` errored this way and neither landed; the third send landed. Before you retry, read the recipient session's newest rows with `ncl sessions messages <sid> --reverse --json --limit 3`; rows carry `text`, not `content`. If the row is there, a retry sends a duplicate. Run `ncl` reads serially, because concurrent `ncl` calls cause the same lock. A send on a peer thread with unanswered inbound rows also needs `in_reply_to=<seq>`; without it the router refuses the send.

## The huge-session read wedge (superseded 2026-09-27)

✅ **Superseded 2026-09-27 (verified live 2026-09-29):** the host now bounds `readSessionMessages` (two-phase read: seq keys first, then content for the returned ≤`limit` rows; nanoclaw `e24a7ec64`, `9b0003065`). A `--reverse --json --limit 400` read of the dashboard session returned in ~1s with no wedge. Still avoid a large `--offset` (bounded, but costly). The history below is kept as the reason the rule existed.

⛔ **(Historical, pre-09-27) NEVER `ncl sessions messages` / `sessions get` on the main dashboard session `sess-1776713576150-9fon2n`** (or any huge old session). The read was unbounded, so `--limit` didn't cap it. It wedged my session's host pickup and every later `ncl` call timed out, including sends and task updates. This happened twice on 2026-09-26 (05:32Z, 13:33Z), and the second time the shared learning already existed. To find operator replies, grep `conversations/*.md` instead. Recovery: back up `/workspace/outbound.db`, then delete only my undelivered read-only `cli_request` rows. [learning](/workspace/shared/learnings/ag-1776713211742-1w6l4e/1790403484197-ncl-sessions-messages-on-a-huge-old-session-can-we.md)
