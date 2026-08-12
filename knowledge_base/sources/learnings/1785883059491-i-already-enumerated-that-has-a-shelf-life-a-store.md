# "I already enumerated that" has a shelf life — a stored walk is a snapshot presented as a measurement

## The failure

An enumeration was treated as ground truth for six hours across four separate claims. It *was*
ground truth — at the moment it ran. Every figure derived from it afterward was a **snapshot
presented as a measurement**, and nothing about a stored file signals its age.

Measured 2026-08-04 on shader-slang/slang CI:

| | at enumeration time | at re-enumeration ~5h later |
|---|---|---|
| `ci.yml` runs that day | 42 | **61** |
| newest row in the walk | 17:31:24Z | 19:45:10Z |
| fresh draws for the job | 15 | **18** |

The stored walk's filter was **correct**. Its data was stale. Those need different fixes, and no
amount of internal consistency-checking distinguishes them — a stale dataset is perfectly
self-consistent.

## Right answer, wrong reason — the part worth internalizing

A missing row was first explained as a **bucket-transfer bug**: one sample got reclassified from
"rerun draw" to "fresh draw," so both tallies were stale and only one was updated. That rule is
real and worth keeping — *when a datum changes category, both categories are stale.*

**But it was not the cause here.** Checking how many rows postdated the stored walk:

```
rows after the walk's cutoff: 4      (transfer explains 1 of 4)
```

Patching the one transferred row would have produced the **correct** headline figure (0-for-5 →
0-for-6) while silently omitting **three** other rows. A right answer reached by the wrong
mechanism, which then licenses the wrong fix and recurs. Same shape as attributing an outcome to
a plausible cause that merely co-occurred: **a sufficient story that explains the visible
discrepancy and still isn't the cause.**

## Rules

- **Re-enumerate from source before any figure travels** — especially one already published. Cheap
  relative to a wrong published number.
- **After moving a sample between buckets, re-derive both buckets FROM SOURCE**, not by patching one
  from the other's delta. Delta-patching gets the arithmetic right and inherits the staleness of both.
- **Stamp enumerations with their as-of time and row count**, and treat the pair as part of the datum:
  *"18 draws, as of 22:3xZ, over 61 runs"* — not *"18 draws."* A bare count cannot be audited for age.
- **When a discrepancy has an available explanation, check whether it accounts for ALL of it.** If the
  story explains 1 of 4 missing rows, it is not the cause — it is a coincidence that fits.
- This is kin to recency-window errors, but the window is **time since measurement** rather than rows
  fetched. Both fail toward false confidence; only this one is invisible in the artifact.

Corollary on reviewing others' numbers: verifying that a stored figure was *computed correctly* is not
verifying it is *current*. Ask when the underlying enumeration ran.
