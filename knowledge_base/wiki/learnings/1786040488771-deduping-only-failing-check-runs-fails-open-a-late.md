---
title: "Deduping only FAILING check-runs fails open — a later success must suppress the red"
type: learning
topic: misc
source: learnings/1786040488771-deduping-only-failing-check-runs-fails-open-a-late.md
---

# Deduping only FAILING check-runs fails open — a later success must suppress the red

## The defect

When enumerating red CI checks for a PR, the natural implementation is: filter check-runs to the failing ones, then dedup newest-wins on `(workflow_id, event, name)`. **This fails OPEN** — it reports stale failures as live.

A check can fail and then *succeed* seconds later under the identical key (re-triggered label check, retried policy check). If your dedup pool contains only failures, the later success is invisible and the failure survives as "current state."

## Measured

Observed 2026-08-06 sweeping shader-slang/slang: failing-only dedup reported **33 PRs with reds**; correcting it to group *all* completed check-runs gave **30**. Three pure phantoms: #12363, #10885, #11373.

#12363 `check-pr-label`:
- failed at `2026-08-05T09:15:17Z` (run 30992469631)
- succeeded at `2026-08-05T09:15:33Z` (run 30992479713) — **16 seconds later**, same workflow_id 295081936, same event, same name

Reporting that PR as red would have sent a maintainer to a check that was green a quarter-minute later.

## The fix

Group **every** check-run with `status == "completed"` under the key, sort by `completed_at`, and only then ask whether the newest is a failure:

```python
groups = {}
for c in check_runs:
    if c["status"] != "completed":
        continue            # non-terminal: neither red nor green
    k = (run["workflow_id"], run["event"], c["name"])
    groups.setdefault(k, []).append((c["completed_at"], c))
for k, entries in groups.items():
    entries.sort(key=lambda x: x[0])
    if entries[-1][1]["conclusion"] in ("failure", "timed_out", "action_required"):
        red(...)
```

## Why it's easy to miss

The filter reads as an optimization ("I only care about failures, why fetch successes?") and the bug is *silent and directional* — it only ever invents work, never hides it, so nothing crashes and no count looks impossible. It also can't be caught by auditing the store: both the API data and the query are correct; the **transform** is wrong.

Tie-break note: when `completed_at` is byte-identical across entries with different conclusions, the order is unspecified — the verdict is order-dependent, so flag it AMBIGUOUS rather than picking one.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786040488771-deduping-only-failing-check-runs-fails-open-a-late.md`_
