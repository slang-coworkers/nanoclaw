---
type: chain
title: slang#14222 — generic `T(v)` over __BuiltinFloatingPointType converts a uint through int (values ≥ 2^31 go negative)
description: Bot-filed (nv-slang-bot via slang-triager) 2026-11-03 as side find S1 from the #14062 review (slang-reviewer). Type=Bug + reproduced. FILED-ONLY until #14062 PR #14218 merges.
tags: [front-end, overload-resolution, generics, floating-point, side-find, filed-only]
---

# slang#14222: generic `T(uintVar)` picks `__init(int)`

**Ask.** `T fromUint<T : __BuiltinFloatingPointType>(uint v) { return T(v); }`. With v = 3000000000 it returns
-1294967296. With 2147483648 it returns -2147483648, and with 4294967295 it returns -1. `float` gives the same
values. Concrete `double(v)` is correct. There is no diagnostic. `T : IFloat` and `T(3000000000u)` show the same
bug. Cause: `uint→int` costs 300 (slang-ast-support-types.h:135) and `uint→float` costs 400 (:141), so
`IArithmetic.__init(int)` (core.meta.slang:207) beats `IFloat.__init(float)` (:344). Not a regression
(v2025.15–master). The triager re-verified it on 7f506f4c9 (cpu/cuda/vk). #12311 (closed) has the same root
but is a different case. Workaround: `convertBuiltinScalar<T>`. Candidate fix: `__init(uint)` in the same
extension block as #14218, which does not cover the unsealed `T : IFloat`.

**Decision (Main, 11-03 02:40Z): filed-only.** The fix touches the same core.meta.slang block as the
reviewed draft #14218, so a parallel PR would conflict with it. The trigger is in
`recheck-14062-pr14218-55f1` (11-10 02:30Z): when #14218 merges, dispatch this issue to slang-fixer on
`gh-issue-shader-slang/slang-14222`. Parent chain: [14062](14062-generic-float-literal-rounds-through-float.md).

- 11-03: `issue_opened` webhook for #14222 arrived; no dispatch (already owned by this chain, filed-only). Timer `recheck-14062-pr14218-55f1` checked: pending for 11-10 02:30Z, and its prompt covers #14222.
- 11-04 17:19Z: **jkwak-work self-assigned #14222 and milestoned it.** It is held under rung 4 (human owner), so the bot does not dispatch it. The recheck timer prompt already skips issues a human owns. 11-05: the dashboard asked for a triage; I replied with the verdict, P2 front-end overload resolution (core.meta.slang), held for jkwak-work.
