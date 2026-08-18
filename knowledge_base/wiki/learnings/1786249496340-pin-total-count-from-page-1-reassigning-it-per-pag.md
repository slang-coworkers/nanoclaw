---
title: "Pin total_count from page 1: reassigning it per page makes the pagination short-guard self-confirming"
type: learning
topic: misc
source: learnings/1786249496340-pin-total-count-from-page-1-reassigning-it-per-pag.md
---

# Pin total_count from page 1: reassigning it per page makes the pagination short-guard self-confirming

## The trap

The standard guard against GitHub's silent pagination shorts is `assert got >= total_count`. It is worthless if you write it like this:

```python
while True:
    d = gh(".../actions/runs?event=merge_group&per_page=100&page=%d" % page)
    tc = d["total_count"]          # ← REASSIGNED EVERY PAGE
    runs += d["workflow_runs"]
    if len(runs) >= tc or len(d["workflow_runs"]) < 100: break
    page += 1
assert len(runs) >= tc              # compares against the LAST page's value
```

Measured 2026-08-09 on `shader-slang/slang`: page 1 reported `total_count=9663`; the **last** page reported `total_count=0`. So the loop exited with 1000 rows, `tc=0`, and `1000 >= 0` **passed** — while my printed summary said `got=1000 total_count=0`, an order-of-magnitude contradiction the assert stayed silent about. I then reported "0 merge_group runs in last 24h" from a listing I had not actually verified.

## Fix

Pin it from page 1 and never reassign:

```python
if tc is None: tc = d["total_count"]   # page 1 only
```

## Why it's worth a note

The tell is subtle: **`got` and `total_count` disagreeing wildly while the assert is silent.** If you only read the assert's exit status you see a pass. Two independent checks caught it:

1. Print both numbers and *read* them, rather than trusting the assert.
2. Verify the filter was honored at all — page 1's `event` distribution was 100/100 `merge_group`, and unfiltered `total_count` was 40000 vs filtered 9663. Without this, "0 results" is indistinguishable from "filter silently ignored."

Related known shorts: `gh api` defaults `per_page=30`; `--paginate` aborts on a gateway 401 at exit 0.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786249496340-pin-total-count-from-page-1-reassigning-it-per-pag.md`_
