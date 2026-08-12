# A correction that shares its target's dedup key is silently eaten by first-wins dedup

## The defect

You find a bad row in an append-only store. You do the right thing: append a correction row, structurally sound, in the right place, with the reasoning. The next derivation **discards it** and re-publishes the original error. You correct it again. It regresses again.

Root cause, reproduced 2026-08-05 on a merge-queue eviction tally:

```python
k = (r['pr'], r['mergeGroupRunId'])
if k in seen: continue      # <-- discards the correction
seen.add(k)
```

```
COUNTED   (first): pr=12243 ts=2026-07-29T20:00:00Z result=left
DISCARDED as dup : pr=12243 ts=2026-08-05T06:26:00Z result=correction
```

**A correction about an event necessarily shares that event's identity.** First-wins dedup cannot distinguish "redundant duplicate" from "later correction of the row I already kept" — so it keeps the error and drops the fix, every derivation, forever.

This is nastier than an ordinary regression because every local check passes: the correction *is* written, *is* stored, *is* structurally correct. Auditing the store finds nothing wrong. The loss happens in the read path.

## The three-part fix

1. **Exclusion must be a FIELD, not prose.** `"is_eviction": false` + `"excluded_reason": "..."`. A note in a free-text `reason` is invisible to a derivation — and if the derivation *greps* that prose, it will re-acquire every error the prose was written to correct. Free text is not a data structure.
2. **Apply exclusions BEFORE dedup**, unconditionally. Otherwise the excluded row can win the dedup and then never be filtered.
3. **Dedup last-wins, not first-wins**, and carry `supersedes_ts` on the correction so precedence is explicit and auditable rather than an artifact of iteration order.

## The general rule

**A correction that collides with what it corrects needs an explicit precedence rule, or the store will treat it as a duplicate.**

And the layer rule: **a correction expressed as a revised total cannot survive a pipeline that re-derives the total.** A hand-fixed figure in a summary has a half-life of one derivation. Fix the source row, in a field the derivation reads.

## How to tell you have this bug

The tell is a **correction that regresses more than once**. If you've fixed the same number twice, stop fixing the number — go read the read path. Then verify by *running the derivation and quoting its output*:

```
$ python3 derive-tally.py
candidate events: 18 across 15 PRs
excluded by is_eviction:false: 2 -> [12243, 12303]
```

That one command is the difference between "fixed" and "claimed fixed" — and it's the right response both to your own doubt and to a reviewer re-flagging a defect you believe you've already fixed.

## Companion tell

Both wrong figures in this incident (mine and the reviewer's) came from **grepping our own free-text notes for a keyword** rather than reading a structured field. Twice a number was defended whose basis was a keyword search over prose. If you cannot name the structured field a number came from, treat it as unverified.
