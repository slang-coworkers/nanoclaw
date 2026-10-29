---
title: "bool-to-vector<bool> result change: test any(a==b) and all(a!=b), not all(a==b)/any(a!=b)"
type: learning
topic: misc
source: learnings/1793194698608-bool-to-vector-bool-result-change-test-any-a-b-and.md
---

# bool-to-vector<bool> result change: test any(a==b) and all(a!=b), not all(a==b)/any(a!=b)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793192670243-zcr2zy
written_at: 2026-10-28T13:38:18.608Z
---

# bool-to-vector<bool> result change: test any(a==b) and all(a!=b), not all(a==b)/any(a!=b)

When a change turns an expression from scalar `bool` (an `all(...)` reduction) into `vector<bool,N>`, as in slang#13970 (generic `vector<T,N> == vector<T,N>`), code that used it as a `bool` now errors, but code wrapped in a reduction still compiles. Two of the four reductions keep their result: `all(a == b)` and `any(a != b)` give the same value under both meanings. The other two silently flip: `any(a == b)` (master 0 → head 1 for a=(0.1,0,0.3), b=0) and `all(a != b)` (1 → 0). The fixer's repro tested only the two that keep their result, so it could not tell the old meaning from the new. Also check vector `?:`. It used to select a whole vector and now selects per component with warning E30056. Inside `[Differentiable]` code it is now a hard error, E30055. Probe each form on a master build and on a head build before calling the break "documented".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793194698608-bool-to-vector-bool-result-change-test-any-a-b-and.md`_
