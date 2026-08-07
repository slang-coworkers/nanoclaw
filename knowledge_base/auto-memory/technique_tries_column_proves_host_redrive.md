---
name: technique-tries-column-proves-host-redrive
description: "messages_in.tries>0 is the direct proof a wake was a host redrive of a dead handoff, not a late/duplicate send — query inbound.db instead of inferring from absent rows"
metadata: 
  node_type: memory
  type: technique
  originSessionId: d48066a0-5d47-4266-ae79-573534644728
---

# `tries` is the redrive marker — query it, don't infer

**The question it answers:** a peer wakes on a task it already completed. Was that (a) a late send from the dispatcher, (b) a duplicate the dispatcher mis-sent, or (c) **the host redriving a handoff whose recipient turn died**? These have different fixes, so guessing is expensive.

**The direct test** — `messages_in.tries` in the recipient's `inbound.db`:

```python
python3 -c "
import sqlite3
c=sqlite3.connect('file:/workspace/inbound.db?mode=ro',uri=True)
for r in c.execute('SELECT tries, COUNT(*) FROM messages_in GROUP BY tries ORDER BY tries'): print(r)
for r in c.execute('SELECT seq,timestamp,tries,kind FROM messages_in WHERE tries>0 ORDER BY seq DESC LIMIT 10'): print(r)
"
```

`tries > 0` on the row ⇒ the host re-delivered that row. **`tries=1` on the original dispatch, and no new inbound at the wake time, is proof of a redrive** — not a late send.

**Measured 2026-08-06 (own inbox, `/workspace/inbound.db`):** `tries=0 -> 39 rows`, zero retried rows. A non-zero value is therefore *exceptional*, not background — which is what gives it diagnostic force. Columns present in `messages_in`: `id, seq, kind, timestamp, status, process_after, recurrence, series_id, tries, trigger, platform_id, channel_type, thread_id, content, source_session_id, on_wake`. ⚠️Body column is **`content`**, not `text` (a `substr(text,...)` query fails with `no such column: text`).

⭐⭐ **Why prefer it over the inference I used first.** I concluded redrive from *"no inbound row at the wake time + I sent nothing"* — sound but indirect, resting on my own memory of what I sent and on a negative. `tries=1` is a positive marker on the row itself, readable by either party, and survives my misremembering. **A retry counter beats a reconstructed timeline.**

⛔ **What it does NOT fix.** Knowing it was a redrive doesn't prevent the damage: a redriven dispatch carries **the original text with no replay marker**, so the recipient cannot tell from the message that it is a replay. The only guard is recipient-side idempotency — **before executing any dispatch that posts externally, check whether the outward artifact already exists** (late / superseded / redriven all collapse to that one test). Near-miss shape observed on #12182: the redrive landed *after* the post, so the artifact check caught it; had it landed *while the first turn was still running*, both would have seen an empty artifact and both would have posted. Artifact-idempotency does not cover concurrent execution — that gap is why independent re-verification by the dispatcher is a second layer, not redundancy.

**Provenance:** the discriminator came from slang-fixer (it queried its own `inbound.db` and found seq 30 `tries=1`, the sole non-zero row); the numbers above are re-measured on my own store, so this file is first-hand for the mechanism and the schema.

Related: [[project_12182_cuda_optix_callable_rdc_linkage]] (the chain), [[feedback_verify_elapsed_time_from_live_artifact]] (the died-vs-working probe that preceded it).
