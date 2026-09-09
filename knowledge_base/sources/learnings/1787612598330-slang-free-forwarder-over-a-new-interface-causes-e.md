---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787610264809-74zrzx
written_at: 2026-08-24T23:03:18.330Z
---

# Slang: free forwarder over a new interface causes E99997 codegen circularity for the interface's own witnesses

When adding a **user-facing interface that re-exposes an existing free intrinsic** (e.g. giving `T:IReal` a `pow`), the natural design — an interface method requirement whose per-conformer witness *forwards to the existing free function*, plus a `[OverloadRank(-10)] pow<T:IReal>` free forwarder so users can still write `pow(a,b)` — **fails at full codegen with `error[E99997] ... unexpected: circularity during codegen`** (only under `-target cpp`/export; it type-checks and even emits fine in some partial paths, so probes that don't force codegen give a false green).

**Root cause:** the free `pow<T:IReal>(x,y)` forwarder joins the overload set at *every* `pow(...)` call site. Deciding whether it applies requires knowing `T:IReal` conformance — i.e. the witness table the compiler is *currently generating*. A witness body that itself calls `pow(this,y)` therefore depends on its own witness → cycle. Distinct method names do NOT help (verified); indirection through a wrapper that still calls free `pow` does NOT help (verified).

**Fix (verified end-to-end, correct CPU values scalar+vector):** the witness must reach the backend through a spelling that is **not** overloaded with an `IReal` forwarder. Define an internal intrinsic wrapper `__<fn>Impl<T:__BuiltinFloatingPointType>` whose body is the `__target_switch { case cpp: __intrinsic_asm "$P_pow($0,$1)"; ... }` directly (NOT a call to free `pow`). Then:
- scalar witness `extension<T:__BuiltinFloatingPointType> T : IReal { T rpow(T y){ return __powImpl(this,y); } }`
- vector witness `extension<T:__BuiltinFloatingPointType, let N:int> vector<T,N> : IReal { ... r[i]=__powImpl(this[i],y[i]); }` — bound on `__BuiltinFloatingPointType` (NOT `T:IReal`, else the vector lacks its `IFloat`/`IComparable` conformance: E38100 missing `equals`/`lessThan`).
- free forwarder `[OverloadRank(-10)] T pow<T:IReal>(T x, T y){ return x.rpow(y); }`.

Also: an interface requirement **default body** cannot delegate to a `__BuiltinFloatingPointType`-constrained impl (`This` is only known as the interface → E39999 no overload) — conformance must be per-conformer where `This` is concrete.

Repro/fix probed against shader-slang/slang @ 2ec76d46ec for #12591 (FP interface tower: IFloatingPoint/IReal). The `__<fn>Impl` intrinsic wrapper duplicates the intrinsic string of the existing free `pow`; ideally the existing free fn would delegate to the same wrapper (one source of truth), but that touches ~74 functions.
