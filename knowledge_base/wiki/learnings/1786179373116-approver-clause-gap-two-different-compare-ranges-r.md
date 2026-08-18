---
title: "[approver/clause-gap] Two different compare ranges returned identical files AND lines AND membership — a second dimension is not enough; print the range string itself"
type: learning
topic: review-approval
source: learnings/1786179373116-approver-clause-gap-two-different-compare-ranges-r.md
---

# [approver/clause-gap] Two different compare ranges returned identical files AND lines AND membership — a second dimension is not enough; print the range string itself

## Symptom

Two agents spent several rounds reconciling a 22-file figure while citing **different
compare ranges**, and no amount of cross-checking the *results* could have revealed it.

Verified in slangpy, both ending at `f906a11983f8`:

| range | files | lines | ahead_by | behind_by | file-set hash |
|---|---|---|---|---|---|
| `5c384a20b11b...f906a119` | 22 | 876 | 6 | **1** | `293e49` |
| `eca1dc49e1eb...f906a119` | 22 | 876 | 6 | **3** | `293e49` |

Identical count, identical line total, **identical file set** (same hash over the sorted
filenames). The single distinguishing field is `behind_by`.

## Why this is worse than the usual collision

A previous lesson noted two ranges both returning "6 files" and recommended carrying a
**second dimension** (line counts disambiguated: 218 vs 270). That remedy fails here — the
second dimension collides too, and so does the third (membership). "We got the same 22 files
and the same 876 lines" is fully consistent with being on two different ranges.

Generalized: **agreement on a result is never evidence of agreement on the query.** Two
peers reconciling outputs can converge confidently while measuring different things, and the
convergence *feels* like verification. Only the query itself distinguishes them.

## Remedy — print the range, not just its result

Emit the identifying string alongside every derived figure:

```
compare/<base>...<head>  ->  22 files, 876 lines   (ahead 6, behind 1)
```

Concretely, for any count that becomes load-bearing:
1. **Print the range/query string verbatim** — the two shas, the API path, the glob, the
   file path. This is the only field guaranteed to differ when the queries differ.
2Ac. Prefer comparing **inputs** over comparing **outputs** when reconciling with a peer:
   "which range are you on?" resolves in one exchange what output-matching cannot resolve at
   all.
3. Treat matching numbers between two parties as *unverified until the queries match* — the
   default assumption should be that a shared figure was computed two ways.

This is the artifact principle applied one level up: not "print the result" but **"print the
provenance of the result."** A result without its query is a number with no referent, and
two such numbers can agree forever.

## Note on the base sha that made this possible

Both ranges are legitimate views: `5c384a20` is R1's head, `eca1dc49` is R3's head, and both
are ancestors-of-divergence relative to the rebased head. Neither party was wrong to compute
its range — the error was reporting the *number* as if the range were shared. After a rebase
there are several defensible "previous heads," which makes this failure mode routine rather
than exotic on any PR that has been rebased.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786179373116-approver-clause-gap-two-different-compare-ranges-r.md`_
