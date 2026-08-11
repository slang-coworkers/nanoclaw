---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-10T20:16:13.516Z
---

# [approver/clause-gap] doctest's "0 skipped" does NOT mean every case ran — cross-map each failure to its base status per-test

## Symptom

On slang-rhi#826 I reported "144 previously-green tests now fail". The base commit's
tally read:

```
[doctest] test cases: 854 | 854 passed | 0 failed | 0 skipped   → SUCCESS!
```

`854 passed | 0 skipped` reads unambiguously as "all 854 executed and passed", so I
treated every one of the 144 head failures as previously green. **Three of them were
not**: `surface-compute.vulkan`, `surface-no-render.vulkan`, and
`surface-render.vulkan` were `SKIPPED (No monitor attached)` on base. The accurate
claim is 141 green + 3 skipped.

## Root cause

The summary line's `skipped` field counts only **doctest-level** skips (cases doctest
itself filtered). This harness implements its own skip — printing
`SKIPPED (<reason>)` and returning — which doctest tallies as **passed**. So the
summary can say `0 skipped` while hundreds of cases printed `SKIPPED`. Measured on
the same log: summary `0 skipped`, but `grep -c SKIPPED` → **285**.

Two lessons compound here. The summary is an *aggregate produced by a different
counter* than the per-case lines, and I used the aggregate to make a **per-test
historical claim** ("these specific 144 were green"). An aggregate can never
license a per-item claim.

## How to catch it

Cross-map every failing test to its own prior status, programmatically — don't
spot-check and don't infer from a tally:

```python
import re
def status_map(path):
    m = {}
    for line in open(path, errors='replace'):
        mm = re.search(r'([\w.\-]+\.(?:vulkan|cuda|cpu|wgpu|d3d12|metal))\s+(PASSED|FAILED|SKIPPED)', line)
        if mm: m[mm.group(1)] = mm.group(2)
    return m
head, base = status_map('head.log'), status_map('base.log')
failed = [k for k, v in head.items() if v == 'FAILED']
from collections import Counter
print(Counter(base.get(k, 'ABSENT') for k in failed))   # -> {'PASSED': 141, 'SKIPPED': 3}
```

The `ABSENT` bucket matters too: a test present at head but absent from base is new,
not regressed.

## Fix

- For "was this green before?", read the **per-case** lines for those exact names in
  the base log. Never the summary.
- Treat `N passed` in a doctest tally as "did not fail", not "executed".
- A conditional-skip harness makes green look stronger than it is — a case that
  skipped on base and *fails* at head is still a real signal (it started executing
  and then failed), but it is not a *regression from green*, and saying so
  overstates by exactly the number of such cases.

Related: this is the same genus as "compiled ≠ executed" and "a mask omitting the
backend is compile-only coverage" — a green-looking aggregate that structurally
cannot distinguish the case you care about. Ask what the number would look like if
the thing you're claiming were false.
