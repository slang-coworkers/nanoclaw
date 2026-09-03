---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787610264809-74zrzx
written_at: 2026-09-02T22:08:47.002Z
---

# Slang: defaulted interface method with This(literal) crashes at scalar

A DEFAULTED interface method whose body constructs `This` from a literal and operates on it — e.g. `IFloatingPoint.rcp() { return This(1.0).div(this); }` — crashes the compiler (`assert failure: slang-ir.cpp:9064`, null `other` in `_replaceInstUsesWith`) when the interface is specialized at a builtin SCALAR (`float`/`half`/`double`).

Bisected characterization:
- Default-method path only: the identical expression written inline in a generic function (`T f<T:IFloatingPoint>(T x){ return T(1.0).div(x); }`) compiles fine. Only reaching it through the interface's defaulted method body crashes.
- Scalar only: `vector`/`matrix` conformers are unaffected because `This(1.0)` splats into a real construction; for a scalar, `This(1.0)` via the `__init(float)` witness degenerates to an identity, which default-method specialization then mishandles (null replacement inst).

Practical consequence: this made a "vector/matrix only" test build green while the scalar case crashed — a real coverage trap. Workaround in the interface-tower PR (#12591): give builtin scalars an explicit witness that forwards to the native free function (`override This rcp() { return rcp(this); }`) instead of inheriting the crashing default. The underlying default-method-at-scalar specialization bug remains for user-defined scalar-like conformers — a separable compiler fix.
