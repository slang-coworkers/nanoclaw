---
title: "Any tally over a string field needs the distinct-values query FIRST — filter-for-what-you-expect silently drops rows"
type: learning
topic: misc
source: learnings/1786098468528-any-tally-over-a-string-field-needs-the-distinct-v.md
---

# Any tally over a string field needs the distinct-values query FIRST — filter-for-what-you-expect silently drops rows

## The pattern

Two independent instances in one day, on different fields of different artifacts, same root cause: I wrote a filter for the values I *expected* a string field to hold, and it silently dropped rows that existed.

**Instance 1 — eviction `reason`.** A script filtered `reason == "failed_checks"` only, with a comment asserting `checks_timed_out` was "NOT an eviction." Wrong: over 08-05..08-07 the tally went **3 → 9 events** once `checks_timed_out` was included. Half of all removals on open non-draft PRs were that value. Proof it's a real eviction class: a PR with **45/45 check-runs green** was evicted because a commit-*status* row never went terminal.

**Instance 2 — my own log's `result`.** Counting "real reruns" I matched `result in (reran, outcome_success, fired)` → 49. But `outcome_success` is a **follow-up row recording the outcome of an already-logged `reran`** (same run id, ~1 h later), so each pair counted one remediation twice. Correct answer: `result == 'reran'` only → **37 across 16 PRs**. I was counting an event and its own confirmation as two events.

Enumerating that field revealed **15 distinct values** in a 7-day window — `left` 117, `declined` 76, `reran` 37, `outcome_success` 12, *missing* 10, then `moot`, `resolved`, `blocked`, `note`, `requeued`, `deferred`, `defect`, `correction`, `corrected`, `method`. I would not have guessed more than four of those.

## The rule

Before any `count`/`group by` over a free-text or open-vocabulary field, run the distinct-values query and read it:

```bash
jq -r '.result' log.jsonl | sort | uniq -c | sort -rn
```

Then decide, value by value, which belong in the numerator. Watch for:
- **Values you didn't know existed** (`checks_timed_out`) — these bias the count *down*.
- **Values that are follow-ups, not events** (`outcome_success`) — these bias it *up*, and double-counting is invisible because the total still looks plausible.
- **Missing/empty** — 10 rows here had no `result` at all; a naive `== 'x'` filter treats them as excluded without telling you.

Both directions produce a number that is plausibly close and internally self-consistent, which is why neither got caught by arithmetic review. The distinct-values query costs one command; the wrong number cost two corrected reports.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786098468528-any-tally-over-a-string-field-needs-the-distinct-v.md`_
