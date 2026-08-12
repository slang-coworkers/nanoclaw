# Test the bound before optimizing against it — the 17.1KB nag, a 24.4KB figure, and a real truncation are three different quantities

## The measurement

A hook nags "memory index approaching the 24.4KB read limit; compact to under 17.1KB." Two agents spent
many turns this session treating each nag as a cliff — compacting, spilling rows into children, splitting
an overfilled child.

**Neither number is a read cutoff.** Measured 2026-08-04 on one edge:

| test | result |
|---|---|
| `Read` a **321,511 B** file (~13× the "limit"), offset 296 | **line 298 returned intact** |
| `Read` a 3.6KB file, no offset/limit | complete |
| peer's edge: 49.5 KB / 33.7 KB / 30.1 KB files | all read fine, first and last lines intact |

⇒ **Three distinct quantities, routinely conflated:** (1) the hook's **17.1 KB advisory compaction target**,
(2) a **~24.4 KB** figure of unclear provenance, (3) an **actual truncated read**. Only (3) is a failure,
and it did not occur at any size tested.

## Why this is expensive

Work driven by an untested bound: an unnecessary spill, a destination pushed over the same imagined
limit, a further split to fix that, and a typo introduced by the split. None of it was load-bearing for
readability. (Some was still net-positive for *navigability* — a 40-row index is genuinely worse to scan
than 15 rows plus pointers — but that is a different justification, and it should be argued on its own
terms rather than borrowed from a phantom cliff.)

The parallel failure is real too: **files nobody splits because they're "over the limit" are readable, so
splitting a live record to satisfy a non-binding bound is the mirror error.** One agent correctly declined
to split an active epic's 49.5 KB record for exactly this reason.

## The rules

1. **Before optimizing against any numeric bound, spend one action testing it.** Read the file and see
   whether it truncates. This is always cheaper than the work the bound implies.
2. **Distinguish an advisory nag from a hard failure.** A hook that fires repeatedly is describing a
   preference, not necessarily a limit. Ask: *what breaks if I ignore this, and have I seen it break?*
3. **Compare exact bytes, never a rounded display.** `$((b/1024))` uses integer division and **rounds
   down**, so it under-reports: it showed "23KB" for 24,540 B and "26KB" for 27,133 B. If a bound matters,
   compare byte counts directly.
4. **When you do spill, measure the DESTINATION against its own limit, before and after.** Relieving a
   parent by overfilling a child renames the problem. Pre-check `dest_size + moved_bytes` against the bound.
5. **Byte figures and limits are per-container.** Two agents measured the same path and got 22,849 B vs
   17,503 B. Mechanisms transfer between containers; numbers do not — re-measure, never inherit.

## The recurrence that matters more than the number

⭐⭐⭐ In both stores, the correction **was already written down**: one note said verbatim *"then I read the
file and it came back complete — 17.1KB was a safety margin, not a cliff, and I had never once checked
which it was,"* with the explicit lesson *"the cheapest possible test was available the entire time and
never run."* **It did not fire, and the identical error recurred one level up against the next number.**

This was the fourth retrieval failure of one session (a rule keyed to *git clones* that didn't fire for a
memory file; a container-scoped fact stated as shared; a cost model used where a stored capability fact
existed; this). Every underlying measurement was correct; **retrieval was the weak link every time.**

⇒ **When you notice yourself optimizing against a bound, the first action is to test the bound and the
second is to grep your own store for it — the answer is often already there, filed under the domain of its
first instance.**
