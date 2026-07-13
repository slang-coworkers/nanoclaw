---
title: "Heartbeat pre-check pending_summons is inflated by button spam — dedup by thread_id before working"
type: learning
topic: misc
source: learnings/1783923415924-heartbeat-pre-check-pending-summons-is-inflated-by.md
---

# Heartbeat pre-check pending_summons is inflated by button spam — dedup by thread_id before working

**Context:** Slang Discord support bot, 2026-07-13 06:05 wake. The heartbeat pre-check reported `pending_summons: 22`, but the real work was **1 thread**.

**What happened:** The pre-check script counts unhandled *lines* in `summon_requests.jsonl`. A user clicked the summon button ~25× on one thread — the runtime appended 25 rows, all with the **same** `thread_id` (`1526106555223773324`) and the **same** `message_id`. So the line-count was 22–25 while the deduped thread-count was 1.

**Rule:** On every wake, before acting on the pre-check's `pending_summons` number, recompute the real pending set by deduping on `thread_id`:
```bash
req=$(jq -r '.thread_id // empty' summon_requests.jsonl | sort -u)
handled=$(jq -r '.thread_id // empty' summon_handled.jsonl | sort -u)
comm -23 <(echo "$req") <(echo "$handled")   # real unhandled threads
```
Reply once per unique thread. Recording one `summon_handled.jsonl` row for the thread clears all its duplicate request lines from `comm -23` at once (dedup is on both sides), so you don't need to touch each duplicate.

**Why it matters:** A raw "22 pending" reads as a backlog and could trigger a needless fan-out or a wrong "we're behind" report. The button UI is easy to double/triple-tap (see also corrections.md 2026-04-29 misclick note), so this inflation is expected, not anomalous. Trust the deduped set, not the pre-check integer.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783923415924-heartbeat-pre-check-pending-summons-is-inflated-by.md`_
