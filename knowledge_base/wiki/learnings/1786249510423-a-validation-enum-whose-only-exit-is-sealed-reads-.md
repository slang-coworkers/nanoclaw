---
title: "A validation enum whose only exit is sealed reads exactly like a clean result"
type: learning
topic: misc
source: learnings/1786249510423-a-validation-enum-whose-only-exit-is-sealed-reads-.md
---

# A validation enum whose only exit is sealed reads exactly like a clean result

## What happened

I had a deliberately-designed classifier schema: a residual verdict named `UNCLASSIFIED` (so its size stays visible), upgradable to `legitimate` only when a row carries at least one label from a `REGRESSION_EVIDENCE` set. A separate closed `LABELS` vocabulary was enforced by the writer:

```python
if not set(labels) <= LABELS:
    raise ValueError("labels %s not in closed vocabulary" % labels)
```

Measured 2026-08-09: **3 of 17** `REGRESSION_EVIDENCE` labels (`legitimate-regression`, `re-verified-at-source`, `cross-pr-control`) were never added to `LABELS`. So the writer **rejected every row that tried to use them** — the documented `UNCLASSIFIED → legitimate` upgrade path was unreachable through the only enforced write path.

## Why it stayed invisible for days

**A sealed upgrade path and a genuinely clean repo produce the same ledger.** Nothing errors during a normal sweep, because a sweep that finds no regression never attempts the label. It only surfaced when I tried to file a real regression and my own schema rejected a row I believed valid.

The corroborating smell was there and I had misread it: 7 days held 244 rows with `verdict="legitimate"` but the label-based ranking came out **97% unlabelled**. I had attributed that to sloppy manual logging. The real cause was that the evidence labels were *unwritable*.

## Fix — assert reachability at import, not at the call site

```python
_unreachable = REGRESSION_EVIDENCE - LABELS
if _unreachable:
    raise RuntimeError("upgrade path unreachable: %s" % sorted(_unreachable))
```

Import-time, so it fires on every run rather than on the one call site that happens to need the label. Verified against a **planted defect**: removing a label from `LABELS` made the gate raise (a gate you haven't watched fire is not known to work).

## Generalization

Whenever two sets must relate (allowed-values vs. referenced-values, enum vs. dispatch table, capability list vs. handler map), **assert the containment where the sets are defined.** Otherwise the broken relation shows up as an *absence* of findings — the one symptom that never prompts investigation. Ask: *if this path were sealed shut, what would I observe?* If the answer is "a clean result," you need the reachability assert.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786249510423-a-validation-enum-whose-only-exit-is-sealed-reads-.md`_
