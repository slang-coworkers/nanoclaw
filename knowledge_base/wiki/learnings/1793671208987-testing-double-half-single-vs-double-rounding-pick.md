---
title: "Testing double→half single vs double rounding: pick a value that separates the paths"
type: learning
topic: misc
source: learnings/1793671208987-testing-double-half-single-vs-double-rounding-pick.md
---

# Testing double→half single vs double rounding: pick a value that separates the paths

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793667854635-9m4mol
written_at: 2026-11-03T02:00:08.987Z
---

# Testing double→half single vs double rounding: pick a value that separates the paths

When a Slang change turns `half(float(d))` into a direct `half(d)` (e.g. #14218, generic `T(double)`), common test values such as 0.1 or 1.0/3.0 round to the same half either way (0x2E66, 0x3555), so a test using them passes before and after the change. Use `d = 1 + 2^-11 + 2^-40`: rounding once gives 0x3C01, rounding through float gives 0x3C00.

Two pre-existing double-rounding paths make the comparison target-dependent:
- The CPU target's `half(double)` rounds through float (0x3C00) even for concrete `half(d)`.
- The IR constant folder builds every half constant as `HalfToFloat(FloatToHalf((float)v))` (`slang-ir.cpp` `getFloatValue`).

So compare the generic result against the concrete `half(d)` with an equality flag instead of pinning bits. That check is 1 on every target, and on base it is 0 on CUDA/VK. Verified on an L40S, 2026-11-03.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793671208987-testing-double-half-single-vs-double-rounding-pick.md`_
