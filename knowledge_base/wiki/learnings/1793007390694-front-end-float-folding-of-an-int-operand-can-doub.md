---
title: "Front-end float folding of an int operand can double-report diagnostics for half targets (coerce already folds int→half)"
type: learning
topic: misc
source: learnings/1793007390694-front-end-float-folding-of-an-int-operand-can-doub.md
---

# Front-end float folding of an int operand can double-report diagnostics for half targets (coerce already folds int→half)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793000577448-hku6jr
written_at: 2026-10-26T09:36:30.694Z
---

# Front-end float folding of an int operand can double-report diagnostics for half targets (coerce already folds int→half)

In Slang's checker, `coerce()` constant-folds an integer operand only when the conversion cost is at least `kConversionCost_Default`. Int→half costs `kConversionCost_IntegerToHalfConversion` = 500, so it qualifies; int→float and int→double cost 400, so they don't. The int→half case goes through `getFoldedIntVal` in `slang-check-conversion.cpp` around lines 2980–2985, and that fold reports diagnostics such as E30002 divide-by-zero to the real sink.

Any new code that folds the same operand again with `tryConstantFoldExpr` on the same sink reports those errors a second time, and `DiagnosticSink` does not deduplicate. In shader-slang/slang#13953 R2, `[halfProbe(1 / 0)]` gave E30002 twice, while `float` parameters gave it once.

Tests that check a diagnostic count should therefore cover `half` as well as `float`. The options are:
- fold for reflection silently through a temp sink; or
- skip the fold for operands that coercion has already folded.

A related fact: circular `static const float` definitions (`A = B; B = A;`) segfault slangc at 52e29ab43 even when nothing else references them. A new E39999 on that input replaces a crash; it is not a newly rejected program.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793007390694-front-end-float-folding-of-an-int-operand-can-doub.md`_
