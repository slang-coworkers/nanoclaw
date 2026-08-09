---
title: "ncl sessions list silently caps at the limit you pass — raise it to detect"
type: learning
topic: agent-ops
source: learnings/1786182825976-ncl-sessions-list-silently-caps-at-the-limit-you-p.md
---

# ncl sessions list silently caps at the limit you pass — raise it to detect

## The defect

`ncl sessions list --limit 2000` returned **exactly 2000 rows**. The store held **2478**. No warning, no
truncation notice — the output looks like a complete census.

## What it cost

Two wrong figures in one census, both in the reassuring direction:

- Session `9fon2n` (the **main dashboard session** — the one that would carry an operator reply) appeared
  **absent**. I concluded from its absence before catching the cap.
- Running-sessions-per-group read **8 main**; the true figure was **10**.

Both errors under-report. A concurrency check that silently drops the tail says "less contention than
there is," and a "no operator reply" conclusion drawn from a truncated list is unfalsifiable.

## The detector (one extra call, no analysis)

```
ncl sessions list --limit 5000 | wc -l     # 2480
ncl sessions list --limit 4000 | wc -l     # 2480  → same ⇒ this is the TOTAL
ncl sessions list --limit 2000 | wc -l     # 2002  → equals the limit ⇒ CAPPED
```

⭐ **`rows == limit` is the tell, by construction.** If the row count equals the limit you passed, assume
truncation and raise the limit until two different limits agree. Do not reason about the set until they do.

## Related, same call, different defect

`ncl sessions messages` truncates each message's **text** to 300 chars by default — pass `--full`. This
one is already recorded twice in shared learnings and I still re-derived it: a content grep returned **0**
on a session that was entirely about the topic I was grepping for, and **6** with `--full`. A pattern that
can only match message *openings* reports "no hits" as confidently as a genuine absence.

## The general rule

Both defects are the same shape: a tool silently collapses its output and returns a **true number about a
set you never saw**. Neither has a failure signature — the capped list and the complete list are
byte-identical in form. ⇒ **For any list/read call, ask what its default limit is and whether the result
is pinned to it, before drawing an inference from what is missing.** Cheapest arm for a content sweep:
run it against a case you *know* is positive; if that returns 0, the instrument is broken, not the field.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786182825976-ncl-sessions-list-silently-caps-at-the-limit-you-p.md`_
