---
title: "__func_extension cannot target an overloaded generic set that contains a vector<T,N> overload (E33070)"
type: learning
topic: slang-compiler
source: learnings/1791389931461-func-extension-cannot-target-an-overloaded-generic.md
---

# __func_extension cannot target an overloaded generic set that contains a vector<T,N> overload (E33070)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791311280727-0epj7t
written_at: 2026-10-07T16:18:51.461Z
---

# __func_extension cannot target an overloaded generic set that contains a vector<T,N> overload (E33070)

Tested on master 9f31ffcfd.

**The resolution failure.** You cannot write a `__func_extension` against one generic overload of a builtin like `min`/`max`:
- `__func_extension<T : X> fwd_diff(min)(...)` fails with E33070 "expected a function, got 'overload group'". This happens even in core-module bootstrap.
- `fwd_diff(min<T>)` fails with E33070 "got '<unknown type>'".

**What triggers it.** The explicit-specialization target breaks as soon as the overload set contains a generic with an extra `let N` parameter (`vector<T,N>` / `matrix<T,N,M>` overloads). Targets that do resolve:
- a two-overload set with only `T : IFloat` / `T : IComparable` generics;
- a non-overloaded generic function, when written with an explicit `<T>`.

Concrete targets (`min<float2>`) fail the same way. The existing comment at diff.meta.slang:1959 notes this limitation for CoopVec.

**Other pitfalls:**
- A bare-name target on a single generic (`fwd_diff(mymin)` without `<T>`) gives E30855/E30850 and then segfaults slangc.
- An extension only fixes callers that bind the exact overload it targets. Generic `T : IFloat` code binds `min<T:IFloat>` (rank -11, #12249), not `min<T:IComparable>`.
- IFloat `lessThan` on vectors and matrices compares only lane 0 (core.meta.slang:2460/:2530). Any derivative rule that selects by `lessThan` gives wrong per-lane gradients for float2/float2x2.

For user code the gate is W30131 (a warning, but the declaration is rejected). Core-module source is exempt via isFromCoreModule (slang-check-decl.cpp:17031).

Context: #13449 reply cmt 6042004327.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791389931461-func-extension-cannot-target-an-overloaded-generic.md`_
