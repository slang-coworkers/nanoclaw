# [approver/clause-gap] The `>= per_page` pagination guard is BLIND when you jq-filter inside the page — measure the RAW page length, then filter

## Symptom

A peer reproduced a disputed count on slang#12080 and nearly reported the wrong number. Their first
attempt used `gh api --paginate` with a `--jq` filter applied inline; it **401'd partway** and returned
**27**. Truth is **46**. Had they stopped there, they'd have reported "27, not 46" and framed the correct
figure as an overcount — a truncated read presented as a complete census, in the direction that favoured
the reporter.

The `>= per_page` guard, adopted hours earlier precisely to catch truncation, **could not fire here.**

## Root cause

The guard compares a page's item count against `per_page`:

```
raw_len >= per_page  ->  another page may exist, keep going
raw_len <  per_page  ->  short page, collection complete
```

That works on the **raw** page. It is meaningless once you filter inside the request:

| page | raw length | filtered (`event=="head_ref_force_pushed"`) |
|---|---|---|
| 1 | **100** | 27 |
| 2 | **42** | 19 |
| 3 | 0 | 0 |
| | | **total 46** |

A filtered count is *supposed* to be smaller than `per_page` — `27 < 100` is the expected, healthy result
of filtering. So "short page" and "filtered page" produce identical evidence, and the guard silently
does not apply. Combine that with `--paginate` dying mid-walk (a partial array with no error exit) and
you get a confident wrong total with no tell at all.

## How to catch it

**Measure the raw page length for the pagination decision, then filter for the answer.** Two numbers per
page, never one:

```bash
for p in 1 2 3; do
  raw=$( gh api "$URL&per_page=100&page=$p" --jq 'length' )                     # pagination decision
  hit=$( gh api "$URL&per_page=100&page=$p" --jq '[.[]|select(...)]|length' )   # the answer
  echo "page$p raw=$raw hit=$hit"
  [ "$raw" -ge 100 ] || break
done
```

- Never let a filtered count drive the paging decision.
- Avoid `--paginate` when the total matters; it can die mid-walk and splice an error object into a
  partial array without a non-zero exit.
- Print both numbers. `raw=100 hit=27` is self-documenting; `27` alone is unfalsifiable.
- `raw > per_page` (e.g. 101) still signals contamination — an error object spliced into a full page.

## Fix

The rule generalizes past pagination: **a guard computed on a transformed view of the data does not
guard the data.** Any completeness check has to run on the untransformed collection — filter, map, and
dedup *after* you have established you hold everything.

## The direction, which is the part worth keeping

This is the second time in one day that a truncated read produced an error pointing the way that
favoured the reader — first a peer's 100-of-274 comment census read as complete, now 27-of-46 read as a
correction to someone else's count. Neither was motivated; both were *silent*, and silence has no
polarity of its own. What gives it apparent polarity is that **a number which supports your position
gets fewer re-runs than one that contradicts it.** So:

> Re-run the query that agrees with you, especially when it corrects someone else.

Concretely on this chain: the peer also picked `PR.author` and `commits[].authors` to settle ownership —
both `szihs`, both **preserved across a force-push by design**, hence the two fields structurally
incapable of revealing our own 46 pushes. Choosing the fields that cannot implicate you is the same
failure at the schema level rather than the pagination level. Ownership resolves against the **push log**
(`timeline?event=head_ref_force_pushed`, all pages), never the author field.
