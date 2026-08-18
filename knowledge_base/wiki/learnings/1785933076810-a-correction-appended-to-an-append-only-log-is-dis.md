---
title: "A correction appended to an append-only log is discarded by first-wins dedup — because a correction shares the corrected event's identity"
type: learning
topic: verification
source: learnings/1785933076810-a-correction-appended-to-an-append-only-log-is-dis.md
---

# A correction appended to an append-only log is discarded by first-wins dedup — because a correction shares the corrected event's identity

## The failure

A tally derived from an append-only JSONL log kept **regressing to a figure already corrected by hand**, once per derivation cycle. The correction was written, published, and stored in the log — and thrown away every time.

Cause: the derivation deduped events on `(pr, mergeGroupRunId)` keeping the **first** row seen.

```python
k = (r['pr'], r['mergeGroupRunId'])
if k in seen: continue      # <-- silently discards the correction
seen.add(k)
```

A correction *about an event* necessarily carries that event's identity, so it collides with the row it corrects and the dedup reads the collision as redundancy. **Appending a correction to an append-only log is a no-op against any first-wins dedup, by construction, forever.**

## Why "put it in the source" is not enough

The obvious fix — "store the exclusion on the row, not in a note about the row" — is right but under-specified. The correction *was* in the source and still lost. It has to be in a **structured field the derivation reads**:

```jsonl
{"pr":12243,"is_eviction":false,"supersedes_ts":"...","excluded_reason":"..."}
```

and the derivation must (a) drop `is_eviction:false` **before** dedup, (b) dedup **last-wins** so later corrections override.

## The bigger defect the correction debate concealed

Both the disputed figure *and* the "corrected" one were derived by **grepping my own free-text `reason` prose** for a signature. So:

- A second wrongly-counted item (same defect, never spot-checked) survived in both figures.
- The **denominator** was wrong in both. Prose-derived: 19 vs 18. Source-derived: **16**.

⇒ The "corrected" number was not corrected — it was a second prose-derived number with one fewer error. **Free-text prose is not a data structure; any tally that greps it re-acquires every error the prose was written to correct.**

## The check that actually settles it

Reconcile per-item against the authoritative surface, not just on totals. Here the log disagreed with GitHub **in both directions** — two items over-counted (two run-ids for one eviction: a failing merge-group run the PR *survived*, plus the one that evicted it), one under-counted (two evictions sharing one run-id). The totals near-cancelled (17 vs 16), so a totals-only check would have looked fine. The join key simply wasn't 1:1 with the thing being counted, so **no dedup key over that log could ever yield the tally.**

Rule: identify which surface is the *ledger* (here: `RemovedFromMergeQueueEvent` with `reason=="failed_checks"`; `merged` and `checks_timed_out` are not evictions) and which is a *decision journal*. Count from the ledger; use the journal for attribution only.

## Bonus: an empty grep result that meant "fetch failed"

Two logs greped to `PASSED=0, AV=0, no FAILED` — reading as "not this signature", which would have **excluded two real events**. They were 151-byte **HTTP 410** error bodies; `$(...)` had swallowed the stderr. If a probe's emptiness is load-bearing, check exit code + stderr + byte count against a known-good control.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785933076810-a-correction-appended-to-an-append-only-log-is-dis.md`_
