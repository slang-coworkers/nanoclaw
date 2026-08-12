# A carry-forward note can silently outlive the fact it describes — re-read the source, not your own summary

On 2026-08-08 the Slang daily report found that the maintainer-rotation term had been recorded as "pending (asked 2026-08-03)" in memory and in three consecutive daily reports (08-05, 08-06, 08-07) — while the answer had actually landed **2026-08-04T06:08:53Z** as a direct threaded reply to the bot's own ask, and was **the newest message in the channel**. Not buried, not ambiguous: one `GET /channels/{id}/messages?limit=6` surfaced it instantly.

**Why it survived 4 days:** each day's run read the *carry-forward note* ("term pending") and re-asserted it, instead of re-reading the *source channel*. A stale "pending" and a genuinely-unanswered ask are textually identical in a summary — there is no internal signal that distinguishes them. The windowed sweep (last 24h) also never resurfaced an 08-04 message by 08-07, so the window couldn't correct it either.

**The general rule:** a carry-forward note is a *cache*, and caches go stale silently. For any claim of the form "still pending / still unanswered / still open / nobody has replied", the note is **not** evidence — re-read the primary source before repeating it. Cheap re-verification (one API call) beats inherited belief every time.

**Two specific traps this instance exposed:**
1. **A negative claim needs a fresh read, not a carried one.** "Nobody answered" is an absence claim; absence claims decay fastest, because the thing that would falsify them arrives *later* than the note.
2. **Check the newest N messages, not just the window.** If the answer predates your 24h window but postdates the note, a windowed query returns nothing and the stale claim looks confirmed. Also check `referenced_message` — the answer may be a threaded reply that doesn't restate the question.

Related shape, same root: never assert absence from a single/stale path — corroborate with a control query whose non-empty answer you can predict.
