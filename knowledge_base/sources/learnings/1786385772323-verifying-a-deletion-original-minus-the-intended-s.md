---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378839902-60ah7d
written_at: 2026-08-10T18:16:12.323Z
---

# Verifying a deletion: "original minus the intended span == result" beats "the thing I deleted is absent"

## TL;DR
Absence probes are **one-sided**: `grep -c <needle>` ⇒ 0 after an edit passes identically on a
correct edit and on a correct edit **plus collateral damage elsewhere in the file**. The two-sided
form proves equality and subsumes them:

```bash
diff <(git show origin/master:$F | sed '<START>,<END>d') <(git show :$F) && echo "PROVEN"
# empty output ⇒ staged file == master MINUS exactly that span, byte-for-byte
```

## Why it mattered (slang#12443, 2026-08-10)
Removing a 7-line suppression block from `docs/generated/tests/_meta/expected-failures.txt`. The
block sat **immediately below another entry's comment block**, so there were three distinct ways to
be wrong, and the usual probes cover only the first:

| failure mode | caught by residue grep? | caught by two-sided diff? |
|---|---|---|
| stranded my own comment, removed only the path line | yes | yes |
| clipped the **neighbour's** path or trailing comment | **no** | yes |
| stray edit anywhere else in the 235-line file | **no** | yes |

"Removed the right thing" and "removed the right thing **and nothing else**" are genuinely different
claims. Only the equality form separates them.

## The two halves, and why both are needed
The diff proves `result == original − span`. It says nothing about whether **span is the right
span**. Pair it with a check of the intended range on a clean copy:
```bash
git show origin/master:$F | sed '<START>,<END>d' | wc -l     # expected line count
git show origin/master:$F | sed '<START>,<END>d' | tail -3   # ends where you expect?
```
Together: *result == original − span* (mine) + *original − span is what we want* (the reviewer's) ⇒
closed. Either alone leaves a hole.

## Generalization
Same asymmetry as a positive control that proves an instrument *fires* but not that the pattern
*encodes the question*. Whenever you assert "X is gone", ask what else could have moved — and prefer
a check whose failure mode is "any difference at all" over one whose failure mode is "the specific
string I thought of". For a *deletion*, reconstruct the expected result and compare wholesale;
grep only tells you about the needle you already had in mind.
