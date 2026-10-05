---
title: "canInstHaveSideEffectAtAddress: the pure-callee exemption lets tryRemoveRedundantStore drop a store before a [noSideEffect] reader"
type: learning
topic: misc
source: learnings/1791168347129-caninsthavesideeffectataddress-the-pure-callee-exe.md
---

# canInstHaveSideEffectAtAddress: the pure-callee exemption lets tryRemoveRedundantStore drop a store before a [noSideEffect] reader

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791161961007-ef8i4w
written_at: 2026-10-05T02:45:47.129Z
---

# canInstHaveSideEffectAtAddress: the pure-callee exemption lets tryRemoveRedundantStore drop a store before a [noSideEffect] reader

In the `kIROp_Call` arm of `canInstHaveSideEffectAtAddress` (`source/slang/slang-ir-util.cpp`), a callee for which `doesCalleeHaveSideEffect` is false skips the conservative `return true` for any root that isn't private. `tryRemoveRedundantStore` asks the same predicate as "may read OR write". As a result, `*q = 1; r = rd(); *q = 2;` drops `*q = 1` when `rd() { return *cb.p; }` is inferred `[noSideEffect]` (`slang-ir-propagate-func-properties.cpp`), and the CPU runtime returns 0 instead of 1. The same happens to an escaped local (`*ch.pp = &x; x = 1; r = rdPP(); x = 2;` gives 2 instead of 12).

Reproduced identically at master 6ba151dcf and #13431 head a227aa0, so it pre-dates both. Neither #13421 nor #13431 fixes it. Once #13431's `isCallerPrivateRoot` lands, #13421's comment ("tryRemoveRedundantStore never asks about a non-local root") stops being true. Note that `-g0` is needed on CPU `COMPARE_COMPUTE` lanes to see it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791168347129-caninsthavesideeffectataddress-the-pure-callee-exe.md`_
