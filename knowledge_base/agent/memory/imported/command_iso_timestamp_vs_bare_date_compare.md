---
name: command_iso_timestamp_vs_bare_date_compare
description: "Comparing a full ISO timestamp against a bare YYYY-MM-DD literal as STRINGS makes a predicate written as strict-on-both-sides EXECUTE as half-open [lo, hi): the lower endpoint is INCLUDED and the upper EXCLUDED, because 'YYYY-MM-DDThh..' shares a prefix with 'YYYY-MM-DD' and is longer, so it sorts AFTER it. Error is exactly ±1 per endpoint — the size that reads as a rounding disagreement, not a bug. Fires on any created_at/updated_at/pushed_at filter in jq, gh --jq, Python, or SQL string comparison."
metadata:
  node_type: memory
  type: reference
  title: An ISO timestamp compared to a bare date literal yields a half-open interval, whatever operator you wrote
  tags:
    - instrument
    - github-actions
    - jq
    - measurement
    - retrieval-key
---

⛔**FIRES ON A COMMAND, NOT A SITUATION: any time you write `select(.created_at > "YYYY-MM-DD")` —
or the same comparison in jq / `gh --jq` / Python / SQL — against values that carry a time component.**
Truncate both sides to the same granularity, or make the literal a full timestamp. Do not trust the
operator to mean what it looks like.

# The mechanism

String comparison, not date comparison:

```
"2025-10-31T07:06:05Z" > "2025-10-31"   → True    ⇒ lower endpoint INCLUDED
"2026-01-15T07:09:15Z" < "2026-01-15"   → False   ⇒ upper endpoint EXCLUDED
```

`YYYY-MM-DDThh…` shares a prefix with `YYYY-MM-DD` and is **longer**, so it sorts after it. Therefore

> **a predicate written as symmetric-and-strict (`> lo and < hi`) executes as `[lo, hi)`.**

The two endpoints behave **differently** under identical-looking operators. Any run occurring on the
`lo` date is counted; any run on the `hi` date is dropped.

# Measured instance (slang#12364, 2026-08-05)

Population: 375 scheduled runs of `vk-gl-cts-nightly.yml`. Window `("2025-10-31","2026-01-15")`, one
`success` run sitting on **each** endpoint day:

| reading | success / failure |
|---|---|
| date-level `lo<=d<=hi` (inclusive) | **70** / 7 |
| date-level `lo<=d<hi` | **69** / 7 |
| date-level `lo<d<=hi` | **69** / 7 |
| date-level `lo<d<hi` (strict both) | **68** / 7 |
| **what `ts > lo and ts < hi` actually ran** | **69** / 7 |

So the figure I published (69/7) reconciles **not** because "my notation was strict" — strict-both is
**68/7** — but because the granularity mismatch silently supplied the half-openness. Had I intended
strict-both, I would have been off by one and had no signal.

# Why it is worth a file

- ⭐⭐⭐ **±1 per endpoint is the error size that reads as a rounding disagreement rather than a bug**,
  so it survives review by two parties who both reproduce the number.
- ⭐⭐ **A peer audited this figure, reproduced all four endpoint variants correctly, and still
  mis-attributed the cause** to strictness. Reproducing the output — even reproducing its endpoint
  *sensitivity* — does not reveal the comparison's granularity. **Agreement on outputs is not
  agreement on semantics.** Deeper form of the #12351 rule
  ([[technique_workflow_rename_mints_new_id_old_id_deleted]]): *reproducing a published figure does not
  reveal which query produced it.*
- **Publish the predicate with the figure.** A count without its filter text is not reproducible, and
  a reader will reconstruct the predicate you *described*: see
  [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] §"exhaustive search of
  the wrong dimensionality", where an omitted upper bound sent a peer's 70,125-window sweep hunting a
  target its search space could not express.
