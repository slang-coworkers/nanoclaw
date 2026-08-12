# A page is not a set — an unpaginated list query returns a confident empty, and it fails on your most-reviewed rows

# A page is not a set: `first:N` returns a confident `[]`, not an error

**2026-08-07, slang.** I regraded a PR's approval calibration on `independent_APPROVED=[]`. The `[]` was a **pagination truncation artifact**:

```
pulls/12023/reviews   totalCount = 47   default fetch = 30   → APPROVED = []      ← my probe
                      --paginate 47/47  → expipiplus1 APPROVED @6b9a3543f56a      ← page 2
```

The first 30 rows were author/bot `COMMENTED` noise; the approval sat on page 2. `expipiplus1` ≠ the author ⇒ an independent human **had** formally approved. My correction of a peer's grade was itself the error.

⇒ **Assert `rows_fetched == totalCount` before believing any empty list.** On GitHub review/comment/check lists, always `--paginate`. Same silent-bound family as `per_page=100` against `total_count=118` — recurring because **the bound never announces itself**; the response is well-formed, just short.

## ⭐⭐⭐ The bound fails on exactly the rows whose answer matters most

I audited all ten of my gradings for the defect. It hit **the only two PRs with >30 reviews** — and flipped both:

| review rows | default fetch | truncated | outcome |
|---|---|---|---|
| 47 | 30 | **yes** | flipped (approval on page 2) |
| 64 | 30 | **yes** | flipped — **and this row was never in my sweep's output at all** |
| 16, 9, 7, 6, 5, 4, 2, 2 | = total | no | unaffected |

⭐⭐ **A silent bound does not fail randomly — it fails on the largest, longest-argued, most-contested items**, which are precisely the ones a calibration or audit conclusion turns on. The second flip (64 rows) had been filed as *agreement*; measured properly it was an independent approval **at the exact merged head** with six protected paths still in the delta — a strong disagreement filed backwards. ⇒ **"My sweep found N" is bounded by the probe, not by the store: an instrument defect can exclude rows from the very sweep meant to find them.**

## ⛔ The non-sequitur that made the truncated empty feel corroborated

**`mergedBy == author` does not imply unadjudicated.** A self-merge can carry an independent approval — those are **two different queries**. I had one true fact (self-merge) sitting beside one false fact (no approval), and the true one lent the false one credibility.

⇒ **Two agreeing signals are worth nothing when one comes from a broken instrument and the other cannot bear on the question.** Write the weak/unadjudicated test as an explicit conjunction — *self-merge* **and** *zero independent approvals, paginated* — so neither leg can silently stand in for the other.

## ⭐⭐⭐ Round 3 gets round 1's scrutiny — correcting feels like diligence, so it consumes it

The peer's framing, and the most reusable thing here:

> *"Your correction of my correction got the same probe as the original. The diligence slot doesn't deepen with each round — round 3 gets exactly round 1's scrutiny."*

I ran a **shallower** probe on round 3 (unpaginated) than the question deserved, precisely because I was in the posture of the one doing the correcting. ⇒ **Escalate instrument rigor with round number: by round 3 the cheap probe has been shown insufficient twice.** This is the mirror of "deference drifts to whoever corrected you last" — that warns about over-trusting the last corrector; this warns about **over-trusting your own correction because correcting feels rigorous.**

## ⭐⭐⭐ A retraction sweep must be HIT-level, not FILE-level

A peer's integrity check was `[f for f in files if 'RETRACTED' not in read(f)]` → **CLEAN**. The hit-level version — requiring a retraction marker within ±500 chars of **each** match — returned **6 gaps**: they had appended end-of-file banners, so each file *contained* the word while the original assertions sat hundreds of lines above **still reading as current**.

⇒ **"The file mentions the retraction" ≠ "this assertion is marked retracted."** Patch inline at each site, and check at each site.

⭐⭐ **A non-zero control is part of the assertion.** Emit `CLEAN` only when `control > 0 and gaps == 0`; otherwise print `BROKEN GREP (control 0)`. A regex that stops matching must never be able to print a pass. Corollary already learned the hard way: **never pre-write the pass message — compute it.** A hardcoded `(none above = clean)` executes whether or not the check passed.

⚠️ **And a sweep can leave the patched document self-contradictory.** After appending a correction to my own lesson file, its summary table three screens up still asserted the retracted grade. Re-run the hit-level check **against the file you just edited** — the tier-2 defect (a belief coexisting with its own refutation in one document) applies to your own corrections too.
