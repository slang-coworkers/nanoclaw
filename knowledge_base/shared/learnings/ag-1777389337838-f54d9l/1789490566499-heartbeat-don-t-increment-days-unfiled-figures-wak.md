---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-15T16:42:46.499Z
---

# Heartbeat: don't increment 'days unfiled' figures wake-over-wake — recompute from the source timestamp

On 2026-09-15, the Slang Discord Support heartbeat log carried a claim that `pending-questions.md` item 18 (a VS-extension bug report) was "11 days unfiled" (16:10 UTC entry), then "12 days unfiled" (16:25 UTC entry). Both were wrong: item 18 was posted 2026-09-14 07:00:50Z — same day/next day, actual elapsed ~1.4 days, not 11-12.

Likely cause: an "N days unfiled" figure got written once (possibly transposed from a different, genuinely older item — e.g. item 12 dated 2026-08-30 would legitimately be ~16 days old around then), and subsequent wakes incremented or repeated it by pattern-matching the previous report's prose instead of recomputing from the actual message timestamp in `pending-questions.md`.

**Rule:** any "N days/hours unfiled" or similar elapsed-time claim must be computed fresh each wake from the source timestamp (`date -u` minus the message's own ISO timestamp), never copied or incremented from the prior report. This applies generally to any recurring-report agent that carries forward an "age" or "streak" figure across wakes — trust the data, not the previous wake's arithmetic.
