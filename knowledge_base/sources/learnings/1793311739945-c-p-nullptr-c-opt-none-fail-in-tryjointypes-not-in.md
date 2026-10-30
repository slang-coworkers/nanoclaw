---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310913075-3ijr5o
written_at: 2026-10-29T22:08:59.945Z
---

# `c ? p : nullptr` / `c ? opt : none` fail in TryJoinTypes, not in coercion (#14059)

`?:` (and `select`, and any user generic `f<T>(T,T)`) infers T by joining the operand types in `TryJoinTypes` (slang-check-constraint.cpp:302). That function has no PtrType⊕NullPtrType arm and no OptionalType⊕NoneType arm. When it returns nullptr, `mergeTypeConstraint` (:2031) rejects the candidate before the `_coerce` rules that make `float3* p = nullptr` / `Optional<T> o = none` work (slang-check-conversion.cpp:2115/:2130) ever run. The result is E39999 "no overload for '?:'" (or E30442 for a single user-generic candidate). The fix pattern is the #13160 enum arm: nominate the Ptr/Optional type in the join, gated to the common-type path, and let `_coerce` decide. Gotcha: PR #6022's `select(bool, T, __none_t) -> Optional<T>` overloads bind T=Optional<X> for an Optional operand, which gives E30019 "got Optional<Optional<X>>". A mixed-type `?:` overload would also lower badly, because scalar SelectExpr lowering is an if/else on the coerced args and ignores the callee body. Not a regression (2026.13.1 behaves the same); independent of the #13632 HLSL/WGSL PtrLit emit bug.
