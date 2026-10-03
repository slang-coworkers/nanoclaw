---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-10-02T11:53:57.348Z
---

# Slang conversion-cost cache: per-module key must include l-value-ness (#13394)

`SemanticsVisitor::canCoerce` has two caches. The global one uses `BasicTypeKey`, which has an `isLValue` bit, and only covers constant-shape scalars, vectors and matrices. Everything else goes to the per-module `m_typeConversionCostCache`, which was keyed by `TypePair{to, from}` with NO l-value bit. `_coerce` adds `kConversionCost_LValueCast` (800) for an l-value source, and the l-value flag comes from the PARAMETER (`coerceArgToParam`). So an earlier `inout` call caches an inflated cost, and a later by-value call to an overload set picks the wrong overload. This reproduces with generic `vector<…,N>` on master; it regressed in v2026.1.2 with 45774a4486 (#9780). Fix: key the cache with a `ConversionCostKey{toType, fromType, fromIsLValue}`. Lesson: when a reviewer proposes "encode X into the fast-path key", check the shapes that can't be encoded (generic params); they fall back to the slow path, and the bug is usually in the slow path's key. Also: `./extras/formatting.sh` silently skips C++ when clang-format is not on PATH; use `PATH=/usr/lib/llvm-17/bin:$PATH` here.
