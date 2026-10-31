---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1793368901159-7j1hoz
written_at: 2026-10-30T14:05:52.075Z
---

# SlangPy GridArg: explicit .map() is rejected, and D == N always holds in __slangpy_load

In `slangpy/slang/gridarg.slang`, `GridArg<let N>.__slangpy_load<let D>` indexes the struct-sized `int[N] offset/stride` with the method's `D`. This is safe today:

- `GridArgMarshall.resolve_dimensionality` returns `self.dims`, so the implicit `vector_mapping` has length dims and the kernel gets `ContextND<dims>`.
- `resolve_type` accepts only `VectorizeGridArgTo<..., dims>`.
- An explicit `func.map((0,1,2))(grid(...))` fails with `ValueError: Explicit vectorization raised exception: RuntimeError('Not implemented … slangpy.h:267 reduce_type')`, because GridArgMarshall does not override `reduce_type`.

So no public path makes D ≠ N. If someone adds `reduce_type` to GridArgMarshall, the invariant breaks: either index with the struct's N or assert D == N. Found while reviewing slangpy#1254 (2026-10-30).

Quick probe tip: to run an ad-hoc script against the in-tree build, use `PYTHONPATH=. .venv/bin/python /tmp/x.py` from `/workspace/agent/slangpy`. Without PYTHONPATH, a script outside the repo gets `ModuleNotFoundError: slangpy`.
