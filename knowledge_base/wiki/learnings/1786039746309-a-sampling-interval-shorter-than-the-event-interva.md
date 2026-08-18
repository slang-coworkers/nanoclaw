---
title: "A sampling interval shorter than the event interval makes 'no progress' indistinguishable from 'stalled' — and a ready causal story is what makes the false reading persuasive"
type: learning
topic: misc
source: learnings/1786039746309-a-sampling-interval-shorter-than-the-event-interva.md
---

# A sampling interval shorter than the event interval makes "no progress" indistinguishable from "stalled" — and a ready causal story is what makes the false reading persuasive

## The near-miss

A `slang-test` suite run entered its serialized retry phase under heavy machine load (loadavg 120 on
8 cores). I checked liveness by comparing the log size twice, 45 s apart:

```
18:05:10   910602 bytes
18:05:55   910602 bytes      → "STALLED"
```

Two corroborating observations made the conclusion feel settled:
- `pgrep -cf test-server` → **0** child servers alive
- the log contained `JSON RPC failure: waitForResult()` / `hasMessage()` lines

So I had a complete causal story: *dead RPC child ⇒ parent hung.* I was about to truncate the phase.

Re-sampled over a longer window first:

```
T0      910602
T+90s   910921        → progressing (+319 bytes)
ps -o time  →  1m11s CPU over 1h44m elapsed
```

**Not stalled** — advancing at a few retries per minute. My 45 s window simply fell between writes.

## The rule

**Choose the sampling window from the expected event interval, not from your patience.** If a process
emits an event every ~30–60 s, a 45 s sample has a large chance of catching zero events, and
"zero events" is byte-identical to "dead."

Cheap discriminators, in increasing strength:
1. **Size delta over a window several times the expected gap** (here 90 s+, ideally minutes).
2. **CPU time** (`ps -o etime,time`): a hung process accrues no CPU; a slow one does. Distinguishes
   *waiting* from *spinning* too.
3. **`/proc/<pid>/wchan`** or `stat` flag — `S`/`Sl` (sleeping on I/O) vs `R`.
4. A **known-terminating marker** in the output rather than inferring from volume.

## Why it was persuasive — the transferable half

The dead-child + RPC-error story was *true as far as it went*: children had died, RPC errors were
real. It just did not entail a hang, because the parent was recovering and retrying serially.

⭐ **A ready causal explanation is what converts a measurement artifact into a confident wrong
conclusion.** Absent the story I would have re-sampled; with it, the short window's silence read as
confirmation. This is the same structure as an instrument whose failure is indistinguishable from its
negative result — except the defective instrument here was **my sampling interval**, not the tool.

Practical guard: when a measurement *confirms* a story you already believe, that is the moment to
re-measure with a different method — not the moment to act. Ask *"what interval would this check need
for its silence to mean what I think it means?"*

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786039746309-a-sampling-interval-shorter-than-the-event-interva.md`_
