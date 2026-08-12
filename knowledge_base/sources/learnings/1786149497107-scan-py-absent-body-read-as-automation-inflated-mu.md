# scan.py absent-body read as automation inflated must_nudge 146 vs 21

# A missing field is not an empty field — and the defect failed toward manufacturing work

**Measured 2026-08-08, supervisor tick 124.** `/supervise-issues` `scan.py::is_automation_note`
opened with:

```python
body = (comment.get("body") or "").strip().lower()
if not body:
    return True  # an empty body cannot contain an ask
```

`pull-universe.sh` emits comments as `{author, at, is_bot, kind}` — **no `body` key at all**
(verified: 1417 comment objects across 716 chains, **0** carrying `body`). The documented input
schema in scan.py's own module docstring also lists no `body`. So *every* comment on *every* chain
was classified as automation boilerplate, `compute_ball` saw an empty list, and `ball` collapsed to
`none` for **283/283** chains.

## Why it mattered

| | as-shipped | control (absence → unknown) |
|---|---|---|
| `ball` | `none`: 283 | `human` 201 / `ours` 70 / `none` 12 |
| `awaiting_us` | **0** | 15 |
| `must_nudge` | **146** | **21** |

Prior tick was 24. The broken instrument would have sent **125 spurious nudges** into coworker
sessions — waking settled chains and burning a model turn each.

⭐⭐⭐ **The defect failed toward producing work, not toward hiding it.** An instrument that
over-generates findings costs more than one that under-reports, because you *act* on findings. The
6× jump from the prior tick was the only cheap tell; a plausible 30 would have shipped silently.

## The detector that actually caught it

Not the delta — an **internal contradiction**: 146/146 nudge rows read `ball: none`, while 271/283
chains demonstrably had comments. A row asserting "no GitHub conversation" about a chain with a
maintainer review on it is self-refuting. ⇒ **When a classifier collapses an entire dimension to one
value, suspect the classifier before the population.** `Counter(r['ball'] for r in rows)` returning a
single key across 283 independent chains is not a finding, it's a defect signature.

## The part I nearly got wrong

I was about to write my own regression test and call it new coverage. **The pre-fix code failed
11 of its own 36 tests** (`python3 test_scan.py` → `FAILED (failures=11)`), including
`test_user_pat_bot_reply_counts_as_us`, which asserts `ball == 'human'` on a bodyless payload. The
intended semantics were *always* "absence ≠ automation"; the regression shipped with a red suite
nobody ran. ⇒ ⭐⭐ **Run the existing suite BEFORE authoring a new test — a red suite tells you the
contract, and "my fix makes 38/38 pass" is a much stronger claim than "my new test passes."**

## Fix

Fail **open** on an absent `body` (return `False` — not automation), so ball-direction is computed
from the author/timestamp fields that *are* in the schema; the body-marker filter applies only when
a producer actually supplies bodies. Kept the present-but-empty case returning `True` and pinned
both with tests (`test_body_absent_is_not_automation`, `test_explicit_empty_body_is_still_automation`).
Gate armed: both fail pre-fix, 38/38 pass post-fix.

## Generalizes to

Any predicate over an optional field in a cross-process payload. `dict.get(k) or default` silently
merges three distinct states — **absent** (no evidence), **present-and-empty** (evidence of
emptiness), **present-with-value**. When the producer and consumer are separate programs, the
absent case is the *common* one and usually means "unknown", so collapsing it into a truthy
predicate branch inverts the classifier. Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]
(instrument yields a confident wrong number), [[technique_keeping_this_store_reachable]]
(every check needs its FAILURE distinguishable from its NEGATIVE result).
